import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/Profile.css';

function Profile() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:5000/api/profile', { email, password }, {
        headers: { Authorization: token }
      });
      setSuccess('Profile updated successfully');
      setPassword('');
    } catch (error) {
      setError('Error updating profile');
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="profile">
      <h1>User Profile</h1>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          New Password (leave blank to keep current):
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit">Update Profile</button>
      </form>
      <button onClick={logout} className="logout-button">Logout</button>
    </div>
  );
}

export default Profile;