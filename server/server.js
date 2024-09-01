const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database connection
const db = new sqlite3.Database('./database.sqlite');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    reset_token TEXT,
    reset_token_expiry INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    price REAL,
    image TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total_amount REAL,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token, 'your_jwt_secret', (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = decoded.id;
    next();
  });
};

// User routes
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], (err) => {
      if (err) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      res.status(201).json({ message: 'User registered successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
    res.json({ token });
  });
});

// User profile route
app.get('/api/profile', verifyToken, (req, res) => {
  db.get('SELECT id, email FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// Update user profile route
app.put('/api/profile', verifyToken, async (req, res) => {
  const { email, password } = req.body;
  let updates = { email };
  
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updates.password = hashedPassword;
  }

  db.run('UPDATE users SET ? WHERE id = ?', [updates, req.userId], (err) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json({ message: 'Profile updated successfully' });
  });
});

// Order history route
app.get('/api/orders', verifyToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  db.all(`SELECT o.*, 
    (SELECT COUNT(*) FROM orders WHERE user_id = ?) as total_count
    FROM orders o 
    WHERE o.user_id = ? 
    ORDER BY o.created_at DESC 
    LIMIT ? OFFSET ?`, 
    [req.userId, req.userId, limit, offset], 
    (err, orders) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    
    const orderIds = orders.map(order => order.id);
    db.all(`SELECT oi.*, p.name as product_name 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id IN (${orderIds.join(',')})`, 
      (err, items) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      
      const ordersWithItems = orders.map(order => ({
        ...order,
        items: items.filter(item => item.order_id === order.id)
      }));

      res.json({
        orders: ordersWithItems,
        totalPages: Math.ceil(orders[0]?.total_count / limit) || 0,
        currentPage: page
      });
    });
  });
});

// Create order route
app.post('/api/orders', verifyToken, (req, res) => {
  const { items, totalAmount } = req.body;
  db.run('INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)', 
    [req.userId, totalAmount, 'pending'], function(err) {
    if (err) return res.status(500).json({ error: 'Server error' });
    const orderId = this.lastID;
    
    const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
    items.forEach(item => {
      stmt.run(orderId, item.id, item.quantity, item.price);
    });
    stmt.finalize();

    res.status(201).json({ message: 'Order created successfully', orderId });
  });
});

// Admin routes
const isAdmin = (req, res, next) => {
  // For simplicity, we're assuming user with id 1 is admin
  if (req.userId !== 1) return res.status(403).json({ error: 'Access denied' });
  next();
};

app.post('/api/products', verifyToken, isAdmin, (req, res) => {
  const { name, description, price, image } = req.body;
  db.run('INSERT INTO products (name, description, price, image) VALUES (?, ?, ?, ?)',
    [name, description, price, image], function(err) {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.status(201).json({ message: 'Product created successfully', productId: this.lastID });
  });
});

app.put('/api/products/:id', verifyToken, isAdmin, (req, res) => {
  const { name, description, price, image } = req.body;
  const { id } = req.params;
  db.run('UPDATE products SET name = ?, description = ?, price = ?, image = ? WHERE id = ?',
    [name, description, price, image, id], function(err) {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json({ message: 'Product updated successfully' });
  });
});

app.delete('/api/products/:id', verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json({ message: 'Product deleted successfully' });
  });
});

// Product routes
app.get('/api/products', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  db.all(`SELECT *, 
    (SELECT COUNT(*) FROM products WHERE name LIKE ?) as total_count 
    FROM products 
    WHERE name LIKE ? 
    LIMIT ? OFFSET ?`, 
    [`%${search}%`, `%${search}%`, limit, offset], 
    (err, products) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json({
      products,
      totalPages: Math.ceil(products[0]?.total_count / limit) || 0,
      currentPage: page
    });
  });
});

app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  });
});

// Password reset request
app.post('/api/reset-password-request', async (req, res) => {
  const { email } = req.body;
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

  db.run('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?', 
    [resetToken, resetTokenExpiry, email], 
    (err) => {
      if (err) return res.status(500).json({ error: 'Server error' });

      // Send email with reset token
      const transporter = nodemailer.createTransport({
        // Configure your email service here
      });

      const mailOptions = {
        from: 'youremail@example.com',
        to: email,
        subject: 'Password Reset',
        text: `To reset your password, click on this link: http://localhost:3000/reset-password/${resetToken}`
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          return res.status(500).json({ error: 'Error sending email' });
        }
        res.json({ message: 'Password reset email sent' });
      });
    }
  );
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  db.run('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ? AND reset_token_expiry > ?', 
    [hashedPassword, token, Date.now()], 
    function(err) {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (this.changes === 0) return res.status(400).json({ error: 'Invalid or expired token' });
      res.json({ message: 'Password reset successful' });
    }
  );
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});