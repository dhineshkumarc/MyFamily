import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  // Hide topbar on the display kiosk route
  if (location.pathname === '/display') return null;

  const goBack = () => {
    if (window.history && window.history.length > 1) window.history.back();
    else window.location.href = '/';
  };

  return (
    <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="home-back-btn" onClick={goBack} aria-label="Go back">←</button>
        <Link to="/" className="navbar-logo">My Family</Link>
      </div>

      <nav>
        <ul className="nav-links">
          {/* Header nav links removed per user request */}
        </ul>
      </nav>
    </header>
  );
}
