import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <h1>Welcome to Our E-commerce Store</h1>
        <p>Discover amazing products at great prices!</p>
        <Link to="/shop" className="cta-button">Shop Now</Link>
      </section>
      <section className="featured-products">
        <h2>Featured Products</h2>
        {/* Add featured products here */}
      </section>
      <section className="special-offers">
        <h2>Special Offers</h2>
        {/* Add special offers here */}
      </section>
    </div>
  );
}

export default Home;