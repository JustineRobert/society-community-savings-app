/**
 * Privacy Policy Page Component
 * Production-ready legal document display
 * - Comprehensive data protection policy
 * - Scrollable content with section navigation
 * - Print-friendly layout
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Mobile responsive
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, Home, FileText, Shield } from 'lucide-react';
import './LegalPages.css';

const PrivacyPolicy = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (e) => {
    setShowScrollTop(e.target.scrollTop > 300);
  };

  const scrollToTop = () => {
    const scrollElement = document.querySelector('.legal-content');
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="legal-page">
      <div className="legal-header">
        <div className="legal-header-content">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">Last updated: January 15, 2026</p>
          <p className="legal-description">
            We are committed to protecting your privacy and ensuring you have a positive experience
            on our platform.
          </p>
        </div>
      </div>

      <div className="legal-container">
        {/* Sidebar Navigation */}
        <aside className="legal-sidebar">
          <nav className="legal-nav" role="navigation" aria-label="Privacy Policy Sections">
            <a href="#section-1" className="nav-link">
              1. Introduction
            </a>
            <a href="#section-2" className="nav-link">
              2. Information We Collect
            </a>
            <a href="#section-3" className="nav-link">
              3. How We Use Your Data
            </a>
            <a href="#section-4" className="nav-link">
              4. Data Security
            </a>
            <a href="#section-5" className="nav-link">
              5. Data Sharing
            </a>
            <a href="#section-6" className="nav-link">
              6. Your Rights
            </a>
            <a href="#section-7" className="nav-link">
              7. Cookies & Tracking
            </a>
            <a href="#section-8" className="nav-link">
              8. Retention Period
            </a>
            <a href="#section-9" className="nav-link">
              9. Children's Privacy
            </a>
            <a href="#section-10" className="nav-link">
              10. Changes to Policy
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="legal-content" onScroll={handleScroll}>
          <article className="legal-article">
            {/* Section 1 */}
            <section id="section-1" className="legal-section">
              <h2>1. Introduction</h2>
              <p>
                TITech Community Capital ("we", "us", "our", or "Company") operates the Community
                Savings App platform (the "Platform"). This page informs you of our policies
                regarding the collection, use, and disclosure of personal data when you use the
                Platform.
              </p>
              <p>
                We use your data to provide and improve the Platform. By using the Platform, you
                consent to our collection and use of personal information in accordance with this
                policy.
              </p>
            </section>

            {/* Section 2 */}
            <section id="section-2" className="legal-section">
              <h2>2. Information We Collect</h2>
              <p>
                We collect various types of information in connection with your use of the Platform:
              </p>

              <h3>Personal Data You Provide:</h3>
              <ul>
                <li>
                  <strong>Account Information:</strong> Name, email address, phone number, date of
                  birth
                </li>
                <li>
                  <strong>Financial Information:</strong> Bank account details, payment methods,
                  transaction history
                </li>
                <li>
                  <strong>Profile Information:</strong> Savings goals, group memberships, preferred
                  communication methods
                </li>
                <li>
                  <strong>Contact Information:</strong> Address, phone number, optional emergency
                  contact details
                </li>
              </ul>

              <h3>Automatically Collected Information:</h3>
              <ul>
                <li>
                  <strong>Device Information:</strong> Device type, operating system, browser type
                </li>
                <li>
                  <strong>Usage Data:</strong> Pages visited, time spent, clicks, interactions on
                  the Platform
                </li>
                <li>
                  <strong>Location Data:</strong> General location data (city/country level, not
                  precise GPS)
                </li>
                <li>
                  <strong>IP Address:</strong> Collected for security and fraud prevention purposes
                </li>
                <li>
                  <strong>Cookies:</strong> Session and persistent cookies to enhance user
                  experience
                </li>
              </ul>

              <h3>Information from Third Parties:</h3>
              <ul>
                <li>Payment processors for transaction verification</li>
                <li>Financial institutions for account verification</li>
                <li>Mobile network operators for mobile money integration</li>
                <li>Fraud prevention services for security purposes</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="section-3" className="legal-section">
              <h2>3. How We Use Your Data</h2>
              <p>We process your personal data for the following purposes:</p>
              <ul>
                <li>
                  <strong>Account Management:</strong> Creating and managing your account,
                  authentication, and verification
                </li>
                <li>
                  <strong>Service Delivery:</strong> Processing transactions, managing savings
                  groups, and facilitating loans
                </li>
                <li>
                  <strong>Communication:</strong> Sending you transactional emails, notifications,
                  and updates about your account
                </li>
                <li>
                  <strong>Security:</strong> Detecting and preventing fraud, protecting your
                  account, and maintaining platform security
                </li>
                <li>
                  <strong>Legal Compliance:</strong> Complying with applicable laws, regulations,
                  and legal obligations
                </li>
                <li>
                  <strong>Analytics:</strong> Understanding user behavior and improving platform
                  functionality
                </li>
                <li>
                  <strong>Customer Support:</strong> Responding to your inquiries and providing
                  technical assistance
                </li>
                <li>
                  <strong>Marketing:</strong> Sending promotional materials (only with your explicit
                  consent)
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="section-4" className="legal-section">
              <h2>4. Data Security</h2>
              <p>
                We implement comprehensive security measures to protect your personal data from
                unauthorized access, alteration, disclosure, or destruction:
              </p>
              <ul>
                <li>
                  <strong>Encryption:</strong> All data in transit is encrypted using
                  industry-standard SSL/TLS encryption
                </li>
                <li>
                  <strong>Secure Storage:</strong> Data at rest is encrypted using AES-256
                  encryption
                </li>
                <li>
                  <strong>Access Controls:</strong> Only authorized employees with a legitimate need
                  have access to personal data
                </li>
                <li>
                  <strong>Regular Audits:</strong> We conduct regular security audits and
                  penetration testing
                </li>
                <li>
                  <strong>Monitoring:</strong> Real-time monitoring for suspicious activities and
                  unauthorized access attempts
                </li>
                <li>
                  <strong>Incident Response:</strong> We have a documented incident response plan
                  for potential data breaches
                </li>
              </ul>
              <p className="highlight">
                <strong>Note:</strong> While we strive to protect your personal data, no security
                system is completely impenetrable. We cannot guarantee absolute security of your
                information.
              </p>
            </section>

            {/* Section 5 */}
            <section id="section-5" className="legal-section">
              <h2>5. Data Sharing</h2>
              <p>We may share your personal data in the following circumstances:</p>

              <h3>Required Sharing:</h3>
              <ul>
                <li>
                  <strong>Service Providers:</strong> With third-party vendors who provide services
                  on our behalf (payment processors, cloud providers)
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law, court order, or
                  government request
                </li>
                <li>
                  <strong>Group Members:</strong> Limited profile information with members of your
                  savings group as necessary for group functionality
                </li>
                <li>
                  <strong>Financial Institutions:</strong> Bank verification and payment processing
                  information
                </li>
              </ul>

              <h3>Data Protection Agreements:</h3>
              <p>
                All third-party processors are bound by confidentiality agreements and are required
                to maintain the same level of data protection as we do.
              </p>

              <h3>Data We Don't Share:</h3>
              <ul>
                <li>Your password (encrypted and stored securely)</li>
                <li>
                  Your transaction history (except with payment processors for processing purposes)
                </li>
                <li>Your account credentials (never shared with any third party)</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="section-6" className="legal-section">
              <h2>6. Your Rights</h2>
              <p>
                Depending on your location, you may have the following rights regarding your
                personal data:
              </p>

              <h3>Right to Access:</h3>
              <p>
                You have the right to request and obtain a copy of your personal data we hold about
                you.
              </p>

              <h3>Right to Rectification:</h3>
              <p>You can request that we correct any inaccurate or incomplete personal data.</p>

              <h3>Right to Erasure:</h3>
              <p>
                You may request deletion of your account and associated personal data, subject to
                legal and regulatory retention requirements.
              </p>

              <h3>Right to Data Portability:</h3>
              <p>
                You can request your data in a structured, commonly used format for transfer to
                another service.
              </p>

              <h3>Right to Withdraw Consent:</h3>
              <p>
                You can withdraw your consent for marketing communications at any time by updating
                your preferences.
              </p>

              <h3>Right to Object:</h3>
              <p>
                You can object to certain types of data processing, including for marketing
                purposes.
              </p>

              <p>
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:privacy@communitysavings.app">privacy@communitysavings.app</a>. We
                will respond to your request within 30 days.
              </p>
            </section>

            {/* Section 7 */}
            <section id="section-7" className="legal-section">
              <h2>7. Cookies & Tracking Technologies</h2>
              <p>
                The Platform uses cookies and similar tracking technologies to enhance your user
                experience:
              </p>

              <h3>Types of Cookies We Use:</h3>
              <ul>
                <li>
                  <strong>Essential Cookies:</strong> Required for authentication and basic platform
                  functionality
                </li>
                <li>
                  <strong>Preference Cookies:</strong> Remember your settings and preferences
                </li>
                <li>
                  <strong>Performance Cookies:</strong> Collect information about how you use the
                  Platform
                </li>
                <li>
                  <strong>Marketing Cookies:</strong> Track your activities for targeted advertising
                  (if consented)
                </li>
              </ul>

              <h3>Cookie Management:</h3>
              <p>
                You can control cookie preferences through your browser settings. Please note that
                disabling essential cookies may affect the functionality of the Platform.
              </p>

              <h3>Third-Party Analytics:</h3>
              <p>
                We use Google Analytics and similar services to understand user behavior. These
                services may set their own cookies. You can opt-out by modifying your tracking
                preferences.
              </p>
            </section>

            {/* Section 8 */}
            <section id="section-8" className="legal-section">
              <h2>8. Data Retention</h2>
              <p>
                We retain your personal data for as long as necessary to provide our services and
                comply with legal obligations:
              </p>

              <h3>Retention Periods:</h3>
              <ul>
                <li>
                  <strong>Active Account Data:</strong> Retained while your account is active
                </li>
                <li>
                  <strong>Transaction Records:</strong> Retained for 7 years for audit and
                  compliance purposes
                </li>
                <li>
                  <strong>Communication Records:</strong> Retained for 2 years
                </li>
                <li>
                  <strong>Marketing Data:</strong> Retained until you opt-out
                </li>
                <li>
                  <strong>Legal Holds:</strong> Data subject to legal disputes retained as required
                </li>
              </ul>

              <p>
                Upon account deletion, your data will be permanently deleted within 30 days, except
                where retention is required by law or for fraud prevention.
              </p>
            </section>

            {/* Section 9 */}
            <section id="section-9" className="legal-section">
              <h2>9. Children's Privacy</h2>
              <p>
                The Platform is not intended for users under the age of 18. We do not knowingly
                collect personal data from children. If we become aware that we have collected data
                from a child, we will take steps to delete such information and terminate the
                child's account.
              </p>
              <p>
                If you believe we have collected data from a child, please contact us immediately at
                <a href="mailto:privacy@communitysavings.app">privacy@communitysavings.app</a>.
              </p>
            </section>

            {/* Section 10 */}
            <section id="section-10" className="legal-section">
              <h2>10. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy periodically to reflect changes in our practices,
                technology, legal requirements, or other factors. The updated version will be
                effective immediately upon posting to the Platform.
              </p>
              <p>
                Your continued use of the Platform after changes are posted constitutes your
                acceptance of the revised Privacy Policy. We encourage you to review this policy
                regularly to stay informed about how we protect your information.
              </p>
              <p>
                If changes materially affect your rights, we will provide at least 30 days' notice
                before implementing such changes.
              </p>
            </section>

            {/* Contact Section */}
            <section className="legal-section contact-section">
              <h2>Privacy Contact Information</h2>
              <p>
                If you have questions, concerns, or requests regarding this Privacy Policy, please
                contact our Data Protection Officer:
              </p>
              <div className="contact-info">
                <p>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:privacy@communitysavings.app">privacy@communitysavings.app</a>
                </p>
                <p>
                  <strong>Data Protection Officer:</strong>{' '}
                  <a href="mailto:dpo@communitysavings.app">dpo@communitysavings.app</a>
                </p>
                <p>
                  <strong>Phone:</strong> <a href="tel:+256XXX">+256 (394) 324760</a>
                </p>
                <p>
                  <strong>Mailing Address:</strong> TITech Community Capital Ltd, Plot 69-71 Jinja Road, Kampala, Uganda
                </p>
              </div>
            </section>
          </article>

          {/* Scroll to Top Button */}
          {showScrollTop && (
            <button className="scroll-to-top" onClick={scrollToTop} aria-label="Scroll to top">
              <ChevronUp size={20} />
            </button>
          )}
        </main>
      </div>

      {/* Footer Navigation */}
      <div className="legal-footer-nav">
        <Link to="/terms" className="legal-link">
          <FileText size={16} />
          Terms of Service
        </Link>
        <Link to="/" className="legal-link">
          <Home size={16} />
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
