/**
 * Terms of Service Page Component
 * Production-ready legal document display
 * - Scrollable content with sticky navigation
 * - Print-friendly layout
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Mobile responsive
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, Home, FileText } from 'lucide-react';
import './LegalPages.css';

const TermsOfService = () => {
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
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">Last updated: January 15, 2026</p>
        </div>
      </div>

      <div className="legal-container">
        {/* Sidebar Navigation */}
        <aside className="legal-sidebar">
          <nav className="legal-nav" role="navigation" aria-label="Terms of Service Sections">
            <a href="#section-1" className="nav-link">
              1. Acceptance of Terms
            </a>
            <a href="#section-2" className="nav-link">
              2. User Rights & Responsibilities
            </a>
            <a href="#section-3" className="nav-link">
              3. User Conduct
            </a>
            <a href="#section-4" className="nav-link">
              4. Payment Terms
            </a>
            <a href="#section-5" className="nav-link">
              5. Loan Agreements
            </a>
            <a href="#section-6" className="nav-link">
              6. Savings Groups
            </a>
            <a href="#section-7" className="nav-link">
              7. Financial Transactions
            </a>
            <a href="#section-8" className="nav-link">
              8. Dispute Resolution
            </a>
            <a href="#section-9" className="nav-link">
              9. Limitation of Liability
            </a>
            <a href="#section-10" className="nav-link">
              10. Governing Law
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="legal-content" onScroll={handleScroll}>
          <article className="legal-article">
            {/* Section 1 */}
            <section id="section-1" className="legal-section">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing and using the TITech Community Capital ("Platform"), you accept and agree
                to be bound by the terms and provision of this agreement. If you do not agree to
                abide by the above, please do not use this service.
              </p>
              <p>
                We reserve the right to update these terms at any time. It is your responsibility to
                review these terms periodically for changes. Your continued use of the Platform
                following the posting of revised Terms means that you accept and agree to the
                changes.
              </p>
            </section>

            {/* Section 2 */}
            <section id="section-2" className="legal-section">
              <h2>2. User Rights & Responsibilities</h2>
              <p>
                As a user of the TITech Community Capital ("Platform"), you are granted a limited, non-exclusive,
                non-transferable license to use the Platform in accordance with these Terms of
                Service.
              </p>
              <h3>User Responsibilities:</h3>
              <ul>
                <li>
                  You are responsible for maintaining the confidentiality of your account
                  credentials
                </li>
                <li>
                  You agree to accept responsibility for all activities that occur under your
                  account
                </li>
                <li>You agree to provide accurate and complete information during registration</li>
                <li>You are responsible for complying with all applicable laws and regulations</li>
                <li>You must not use the Platform for any illegal or unauthorized purpose</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="section-3" className="legal-section">
              <h2>3. User Conduct</h2>
              <p>You agree that you will not, under any circumstances:</p>
              <ul>
                <li>Harass, threaten, embarrass, or cause distress or discomfort to any person</li>
                <li>Engage in any form of fraud, misrepresentation, or deception</li>
                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                <li>Transmit any harmful, malicious, or offensive content</li>
                <li>Violate any intellectual property rights</li>
                <li>Engage in any activity that disrupts the normal functioning of the Platform</li>
                <li>Post or transmit any unsolicited commercial messages or spam</li>
                <li>Attempt to reverse engineer, decompile, or discover any underlying code</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="section-4" className="legal-section">
              <h2>4. Payment Terms</h2>
              <p>
                TITech Community Capital facilitates financial transactions between group members. The
                following terms apply to all payments processed through the Platform:
              </p>
              <h3>Payment Processing:</h3>
              <ul>
                <li>All payments must be made through authorized payment methods</li>
                <li>We use industry-standard encryption to protect your financial information</li>
                <li>
                  You authorize us to charge your selected payment method for transactions you
                  initiate
                </li>
                <li>Processing times may vary depending on your financial institution</li>
                <li>Failed payments will result in transaction cancellation</li>
              </ul>
              <h3>Refund Policy:</h3>
              <ul>
                <li>Refunds are processed within 5-10 business days</li>
                <li>Certain transactions may not be eligible for refund</li>
                <li>Refund disputes must be reported within 30 days of the transaction</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="section-5" className="legal-section">
              <h2>5. Loan Agreements</h2>
              <p>
                The TITech Community Capital facilitates informal lending between group members. The
                following terms apply:
              </p>
              <ul>
                <li>Loan terms are agreed upon directly between borrower and lender</li>
                <li>The Platform does not guarantee loan repayment or enforce loan conditions</li>
                <li>Loan disputes must be resolved between the parties involved</li>
                <li>Interest rates and repayment schedules are determined by mutual agreement</li>
                <li>The Platform is not liable for loan defaults or disputes</li>
              </ul>
              <p className="highlight">
                <strong>Important:</strong> TITech Community Capital is not a financial institution and
                does not provide financial advice. Always seek professional legal and financial
                counsel before entering into loan agreements.
              </p>
            </section>

            {/* Section 6 */}
            <section id="section-6" className="legal-section">
              <h2>6. Savings Groups</h2>
              <p>
                Users may create or join savings groups on the Platform. The following terms apply
                to group participation:
              </p>
              <ul>
                <li>Group administrators have the right to set group rules and policies</li>
                <li>Group members agree to abide by group rules</li>
                <li>The Platform is not responsible for group member disputes</li>
                <li>Users can leave groups at any time by notifying the group administrator</li>
                <li>Group data remains the property of the group members</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="section-7" className="legal-section">
              <h2>7. Financial Transactions</h2>
              <p>All financial transactions on the Platform are subject to the following terms:</p>
              <ul>
                <li>You are responsible for verifying transaction details before confirmation</li>
                <li>Transaction records are maintained for audit and compliance purposes</li>
                <li>The Platform may suspend suspicious transactions for fraud protection</li>
                <li>
                  Transaction fees, if applicable, will be clearly disclosed before processing
                </li>
                <li>You agree to comply with all forex and currency regulations</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="section-8" className="legal-section">
              <h2>8. Dispute Resolution</h2>
              <p>
                In the event of a dispute, we encourage you to contact us first to attempt
                resolution:
              </p>
              <ul>
                <li>Email: disputes@communitysavings.app</li>
                <li>Phone: +256 (782) 397907</li>
                <li>Mailing Address: Community Savings Ltd, Kampala, Uganda</li>
              </ul>
              <p>
                If a dispute cannot be resolved through our customer service team, the matter may be
                escalated to mediation or arbitration in accordance with the laws of Uganda, without
                resorting to litigation except as authorized below.
              </p>
            </section>

            {/* Section 9 */}
            <section id="section-9" className="legal-section">
              <h2>9. Limitation of Liability</h2>
              <p className="highlight">
                TITech Community Capital IS PROVIDED ON AN "AS IS" BASIS. WE MAKE NO WARRANTY, EXPRESS
                OR IMPLIED, REGARDING THE PLATFORM'S OPERATION OR THE INFORMATION, CONTENT, OR
                MATERIALS INCLUDED ON THE PLATFORM.
              </p>
              <p>
                To the fullest extent permissible by applicable law, TITech Community Capital disclaims
                all warranties, express or implied, including, but not limited to, implied
                warranties of merchantability and fitness for a particular purpose.
              </p>
              <p>
                TITech Community Capital will not be liable for any indirect, incidental, special,
                consequential, or punitive damages resulting from your use of or inability to use
                the Platform or the services, even if we have been advised of the possibility of
                such damages.
              </p>
            </section>

            {/* Section 10 */}
            <section id="section-10" className="legal-section">
              <h2>10. Governing Law</h2>
              <p>
                These Terms of Service are governed by and construed in accordance with the laws of
                Uganda, and you irrevocably submit to the exclusive jurisdiction of the courts
                located in Uganda.
              </p>
              <p>
                If any provision of these Terms is held to be invalid or unenforceable, the
                remaining provisions will continue in full force and effect.
              </p>
            </section>

            {/* Contact Section */}
            <section className="legal-section contact-section">
              <h2>Contact Information</h2>
              <p>For questions about these Terms of Service, please contact:</p>
              <div className="contact-info">
                <p>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:legal@communitysavings.app">legal@communitysavings.app</a>
                </p>
                <p>
                  <strong>Phone:</strong> <a href="tel:+256782397907">+256 (782) 397907</a>
                </p>
                <p>
                  <strong>Mailing Address:</strong> TITech Community Capital Ltd, Kampala, Uganda
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
        <Link to="/privacy" className="legal-link">
          <FileText size={16} />
          Privacy Policy
        </Link>
        <Link to="/" className="legal-link">
          <Home size={16} />
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default TermsOfService;
