import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/OrderHistory.css';

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchOrders(currentPage);
  }, [currentPage]);

  const fetchOrders = async (page) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/orders?page=${page}`, {
        headers: { Authorization: token }
      });
      setOrders(response.data.orders);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  return (
    <div className="order-history">
      <h1>Order History</h1>
      {orders.map(order => (
        <div key={order.id} className="order">
          <h2>Order #{order.id}</h2>
          <p><strong>Total Amount:</strong> ${order.total_amount.toFixed(2)}</p>
          <p><strong>Status:</strong> {order.status}</p>
          <p><strong>Date:</strong> {new Date(order.created_at).toLocaleString()}</p>
          <h3>Items:</h3>
          <ul>
            {order.items.map(item => (
              <li key={item.id}>
                {item.product_name} - Quantity: {item.quantity}, Price: ${item.price.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="pagination">
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default OrderHistory;