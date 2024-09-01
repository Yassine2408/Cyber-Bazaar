import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import '../styles/Header.css';

function Header() {
  const { user, logout, isAdmin } = useAuth();
  const { cart } = useCart();

  return (
    <header className="header">
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/shop">Shop</Link></li>
          {user ? (
            <>
              <li><Link to="/profile">Profile</Link></li>
              <li><Link to="/order-history">Order History</Link></li>
              {isAdmin() && <li><Link to="/admin">Admin Dashboard</Link></li>}
              <li><button onClick={logout}>Logout</button></li>
            </>
          ) : (
            <>
              <li><Link to="/login">Login</Link></li>
              <li><Link to="/register">Register</Link></li>
            </>
          )}
          <li><Link to="/cart">Cart ({cart.length})</Link></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;