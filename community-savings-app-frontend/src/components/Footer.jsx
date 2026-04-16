/**
 * Footer Component
 * Displays links to legal documents, company info, and social media
 * - Responsive layout
 * - Accessibility compliant
 * - Production-ready styling
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Footer Main Content */}
        <div className="footer-main">
          {/* Company Info */}
          <div className="footer-section">
            <h3 className="footer-title">Community Savings</h3>
            <p className="footer-description">
              Empowering communities through digital savings and lending solutions.
            </p>
            <div className="footer-social">
              <a href="tel:+256XXX" className="social-link" aria-label="Call us">
                <Phone size={20} />
              </a>
              <a href="mailto:info@communitysavings.app" className="social-link" aria-label="Email us">
                <Mail size={20} />
              </a>
              <a href="#" className="social-link" aria-label="Visit us">
                <MapPin size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-section-title">Quick Links</h4>
            <ul className="footer-links">
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                <Link to="/groups">Savings Groups</Link>
              </li>
              <li>
                <Link to="/create-group">Create Group</Link>
              </li>
              <li>
                <a href="mailto:support@communitysavings.app">Support</a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="footer-section">
            <h4 className="footer-section-title">Legal</h4>
            <ul className="footer-links">
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <a href="mailto:legal@communitysavings.app">Contact Legal</a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="footer-section">
            <h4 className="footer-section-title">Contact</h4>
            <ul className="contact-info">
              <li>
                <a href="mailto:info@communitysavings.app">info@communitysavings.app</a>
              </li>
              <li>
                <a href="tel:+256XXX">+256 (782) 397907</a>
              </li>
              <li>Kampala, Uganda</li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <p className="copyright">
              &copy; {currentYear} Community Savings App. All rights reserved.
            </p>
            <div className="footer-legal-bottom">
              <Link to="/terms" className="footer-link-small">Terms</Link>
              <span className="divider">•</span>
              <Link to="/privacy" className="footer-link-small">Privacy</Link>
              <span className="divider">•</span>
              <a href="mailto:legal@communitysavings.app" className="footer-link-small">Legal</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
