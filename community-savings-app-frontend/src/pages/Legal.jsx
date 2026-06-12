/**
 * Legal Page Component - Comprehensive Legal Information
 * Production-ready consolidated legal documentation
 * - Terms of Service
 * - Privacy Policy
 * - Disclaimer
 * - Scrollable content with sticky navigation
 * - Print-friendly layout
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Mobile responsive
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, Home } from 'lucide-react';
import './Legal.css';

const Legal = () => {
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
      {/* Header */}
      <div className="legal-header">
        <div className="legal-header-content">
          <h1 className="legal-title">Legal Information</h1>
          <p className="legal-subtitle">Terms of Service, Privacy Policy & Disclaimer</p>
          <p className="legal-description">
            Please read all legal documents carefully. We recommend reviewing our Terms of Service
            and Privacy Policy to understand your rights and responsibilities when using TITech Community
            Capital Platform.
          </p>
        </div>
      </div>

      <div className="legal-container">
        {/* Sidebar Navigation */}
        <aside className="legal-sidebar">
          <nav className="legal-nav" role="navigation" aria-label="Legal Sections">
            <div className="nav-section">
              <h5 className="nav-section-title">Terms of Service</h5>
              <a href="#tos-1" className="nav-link">
                1. Acceptance of Terms
              </a>
              <a href="#tos-2" className="nav-link">
                2. User Rights & Responsibilities
              </a>
              <a href="#tos-3" className="nav-link">
                3. User Conduct
              </a>
              <a href="#tos-4" className="nav-link">
                4. Payment Terms
              </a>
              <a href="#tos-5" className="nav-link">
                5. Loan Agreements
              </a>
              <a href="#tos-6" className="nav-link">
                6. Limitation of Liability
              </a>
            </div>

            <div className="nav-section">
              <h5 className="nav-section-title">Privacy Policy</h5>
              <a href="#pp-1" className="nav-link">
                1. Information We Collect
              </a>
              <a href="#pp-2" className="nav-link">
                2. How We Use Information
              </a>
              <a href="#pp-3" className="nav-link">
                3. Data Security
              </a>
              <a href="#pp-4" className="nav-link">
                4. Your Privacy Rights
              </a>
              <a href="#pp-5" className="nav-link">
                5. Cookies & Tracking
              </a>
              <a href="#pp-6" className="nav-link">
                6. Third-Party Services
              </a>
            </div>

            <div className="nav-section">
              <h5 className="nav-section-title">Disclaimer</h5>
              <a href="#disclaimer" className="nav-link">
                General Disclaimer
              </a>
              <a href="#financial-disclaimer" className="nav-link">
                Financial Disclaimer
              </a>
              <a href="#contact-legal" className="nav-link">
                Contact Legal
              </a>
            </div>
          </nav>

          <div className="legal-nav-actions">
            <Link to="/dashboard" className="nav-action-link" title="Return to Dashboard">
              <Home size={18} /> Dashboard
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="legal-content" onScroll={handleScroll}>
          <article className="legal-article">
            {/* ==================== TERMS OF SERVICE ==================== */}
            <section className="legal-major-section">
              <h2 className="major-title">Terms of Service</h2>
              <p className="section-update">Last updated: January 15, 2026</p>

              {/* TOS Section 1 */}
              <section id="tos-1" className="legal-section">
                <h3>1. Acceptance of Terms</h3>
                <p>
                  By accessing and using the TITech Community Capital ("Platform"), you accept and
                  agree to be bound by the terms and provision of this agreement. If you do not
                  agree to abide by the above, please do not use this service.
                </p>
                <p>
                  We reserve the right to update these terms at any time. It is your responsibility
                  to review these terms periodically for changes. Your continued use of the Platform
                  following the posting of revised Terms means that you accept and agree to the
                  changes.
                </p>
              </section>

              {/* TOS Section 2 */}
              <section id="tos-2" className="legal-section">
                <h3>2. User Rights & Responsibilities</h3>
                <p>
                  As a user of the TITech Community Capital Platform, you are granted a limited, non-exclusive,
                  non-transferable license to use the Platform in accordance with these Terms of
                  Service.
                </p>
                <h4>User Responsibilities:</h4>
                <ul>
                  <li>
                    You are responsible for maintaining the confidentiality of your account
                    credentials
                  </li>
                  <li>
                    You agree to accept responsibility for all activities that occur under your
                    account
                  </li>
                  <li>
                    You agree to provide accurate and complete information during registration
                  </li>
                  <li>
                    You are responsible for complying with all applicable laws and regulations
                  </li>
                  <li>You must not use the Platform for any illegal or unauthorized purpose</li>
                  <li>
                    You are responsible for keeping your contact information current and accurate
                  </li>
                </ul>
              </section>

              {/* TOS Section 3 */}
              <section id="tos-3" className="legal-section">
                <h3>3. User Conduct</h3>
                <p>You agree that you will not, under any circumstances:</p>
                <ul>
                  <li>
                    Harass, threaten, embarrass, or cause distress or discomfort to any person
                  </li>
                  <li>Engage in any form of fraud, misrepresentation, or deception</li>
                  <li>
                    Attempt to gain unauthorized access to our systems or other users' accounts
                  </li>
                  <li>Transmit any harmful, malicious, or offensive content</li>
                  <li>Violate any intellectual property rights</li>
                  <li>
                    Engage in any activity that disrupts the normal functioning of the Platform
                  </li>
                  <li>Post or transmit any unsolicited commercial messages or spam</li>
                  <li>Attempt to reverse engineer, decompile, or discover any underlying code</li>
                  <li>
                    Use the Platform for money laundering or other illegal financial activities
                  </li>
                  <li>Engage in any form of discrimination based on protected characteristics</li>
                </ul>
              </section>

              {/* TOS Section 4 */}
              <section id="tos-4" className="legal-section">
                <h3>4. Payment Terms</h3>
                <p>
                  TITech Community Capital facilitates financial transactions between group members.
                  The following terms apply to all payments processed through the Platform:
                </p>
                <h4>Payment Processing:</h4>
                <ul>
                  <li>All payments must be made through authorized payment methods</li>
                  <li>We use industry-standard encryption to protect your financial information</li>
                  <li>
                    You authorize us to charge your selected payment method for transactions you
                    initiate
                  </li>
                  <li>Processing times may vary depending on your financial institution</li>
                  <li>Failed payments will result in transaction cancellation</li>
                  <li>You are responsible for any fees charged by your financial institution</li>
                </ul>
                <h4>Refund Policy:</h4>
                <ul>
                  <li>Refunds are processed within 5-10 business days of approval</li>
                  <li>Certain transactions may not be eligible for refund</li>
                  <li>Refund disputes must be reported within 30 days of the transaction</li>
                  <li>Refund eligibility is determined on a case-by-case basis</li>
                </ul>
              </section>

              {/* TOS Section 5 */}
              <section id="tos-5" className="legal-section">
                <h3>5. Loan Agreements</h3>
                <p>
                  The TITech Community Capital Platform facilitates informal lending between group members. The
                  following terms apply:
                </p>
                <ul>
                  <li>Loan terms are agreed upon directly between borrower and lender</li>
                  <li>The Platform does not guarantee loan repayment or enforce loan conditions</li>
                  <li>Loan disputes must be resolved between the parties involved</li>
                  <li>Interest rates and repayment schedules are determined by mutual agreement</li>
                  <li>The Platform is not liable for loan defaults or disputes</li>
                  <li>All loan agreements should be documented in writing</li>
                  <li>Users acknowledge the risks associated with informal lending</li>
                </ul>
                <div className="highlight">
                  <strong>Important:</strong> TITech Community Capital is not a financial institution
                  and does not provide financial advice. Always seek professional legal and
                  financial counsel before entering into loan agreements.
                </div>
              </section>

              {/* TOS Section 6 */}
              <section id="tos-6" className="legal-section">
                <h3>6. Limitation of Liability</h3>
                <p>
                  To the fullest extent permitted by law, TITech Community Capital shall not be liable
                  for any indirect, incidental, special, consequential, or punitive damages,
                  including lost profits, even if advised of the possibility of such damages.
                </p>
                <p>
                  In no event shall TITech Community Capital's total liability to you exceed the amount
                  you have paid to TITech Community Capital in the 12 months preceding the event giving
                  rise to liability.
                </p>
                <p>
                  Some jurisdictions do not allow the exclusion of certain warranties or limitation
                  of liability, so some of the above limitations may not apply to you. In such
                  cases, our liability will be limited to the maximum extent permitted by applicable
                  law.
                </p>
              </section>
            </section>

            {/* ==================== PRIVACY POLICY ==================== */}
            <section className="legal-major-section">
              <h2 className="major-title">Privacy Policy</h2>
              <p className="section-update">Last updated: January 15, 2026</p>

              {/* PP Section 1 */}
              <section id="pp-1" className="legal-section">
                <h3>1. Information We Collect</h3>
                <p>
                  We collect information you provide directly to us, such as when you create an
                  account, including:
                </p>
                <h4>Personal Information:</h4>
                <ul>
                  <li>Name and email address</li>
                  <li>Phone number and physical address</li>
                  <li>Date of birth and identification information</li>
                  <li>Financial information (bank account details, payment method)</li>
                  <li>Profile picture and biographical information</li>
                </ul>
                <h4>Automatically Collected Information:</h4>
                <ul>
                  <li>
                    Device information (device type, operating system, unique device identifiers)
                  </li>
                  <li>Log information (IP address, access times, pages viewed, referrer URL)</li>
                  <li>Location information (with your permission)</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </section>

              {/* PP Section 2 */}
              <section id="pp-2" className="legal-section">
                <h3>2. How We Use Information</h3>
                <p>We use the information we collect to:</p>
                <ul>
                  <li>Provide, maintain, and improve the Platform and our services</li>
                  <li>Process transactions and send related information</li>
                  <li>Send promotional communications (with your opt-in consent)</li>
                  <li>Respond to your comments, questions, and requests</li>
                  <li>Prevent fraud and enhance the security of the Platform</li>
                  <li>Comply with legal obligations and enforce our terms</li>
                  <li>Monitor and analyze trends, usage, and activities</li>
                  <li>
                    Personalize your experience and deliver content relevant to your interests
                  </li>
                </ul>
              </section>

              {/* PP Section 3 */}
              <section id="pp-3" className="legal-section">
                <h3>3. Data Security</h3>
                <p>
                  We implement appropriate technical and organizational measures to protect your
                  personal information against unauthorized access, alteration, disclosure, or
                  destruction. These measures include:
                </p>
                <ul>
                  <li>End-to-end encryption for sensitive data transmission</li>
                  <li>Secure password hashing and salting</li>
                  <li>Regular security audits and penetration testing</li>
                  <li>Limited access to personal information to authorized personnel only</li>
                  <li>Secure data storage with redundant backups</li>
                  <li>SSL/TLS encryption for all communications</li>
                </ul>
                <p>
                  However, no method of transmission over the Internet is 100% secure. While we
                  strive to protect your information, we cannot guarantee absolute security.
                </p>
              </section>

              {/* PP Section 4 */}
              <section id="pp-4" className="legal-section">
                <h3>4. Your Privacy Rights</h3>
                <p>
                  Depending on your location, you may have certain rights regarding your personal
                  information, including:
                </p>
                <ul>
                  <li>
                    <strong>Right to Access:</strong> You have the right to request and obtain a
                    copy of your personal data
                  </li>
                  <li>
                    <strong>Right to Rectification:</strong> You can request correction of
                    inaccurate information
                  </li>
                  <li>
                    <strong>Right to Erasure:</strong> You may request deletion of your data under
                    certain conditions
                  </li>
                  <li>
                    <strong>Right to Data Portability:</strong> You can request your data in a
                    portable format
                  </li>
                  <li>
                    <strong>Right to Withdraw Consent:</strong> You can withdraw consent for data
                    processing at any time
                  </li>
                  <li>
                    <strong>Right to Lodge Complaints:</strong> You can file complaints with
                    applicable data protection authorities
                  </li>
                </ul>
                <p>
                  To exercise any of these rights, please contact us using the information provided
                  in the Contact Legal section.
                </p>
              </section>

              {/* PP Section 5 */}
              <section id="pp-5" className="legal-section">
                <h3>5. Cookies & Tracking</h3>
                <p>
                  We use cookies and similar tracking technologies to enhance your experience on the
                  Platform. These include:
                </p>
                <h4>Types of Cookies:</h4>
                <ul>
                  <li>
                    <strong>Essential Cookies:</strong> Required for basic functionality and
                    security
                  </li>
                  <li>
                    <strong>Performance Cookies:</strong> Help us understand how you use the
                    Platform
                  </li>
                  <li>
                    <strong>Functional Cookies:</strong> Remember your preferences and settings
                  </li>
                  <li>
                    <strong>Marketing Cookies:</strong> Track your interactions for targeted
                    communications
                  </li>
                </ul>
                <p>
                  You can control cookies through your browser settings. However, disabling some
                  cookies may affect the functionality of the Platform.
                </p>
              </section>

              {/* PP Section 6 */}
              <section id="pp-6" className="legal-section">
                <h3>6. Third-Party Services</h3>
                <p>
                  We may share your information with third-party service providers who assist us in
                  operating the Platform and providing services to you, including:
                </p>
                <ul>
                  <li>Payment processors and financial service providers</li>
                  <li>Cloud storage and hosting providers</li>
                  <li>Analytics and monitoring services</li>
                  <li>Email service providers</li>
                  <li>Customer support platforms</li>
                </ul>
                <p>
                  These third parties are bound by confidentiality agreements and are required to
                  use your information only for the purposes of providing services to us. We do not
                  sell your personal information to third parties.
                </p>
              </section>
            </section>

            {/* ==================== DISCLAIMER ==================== */}
            <section className="legal-major-section">
              <h2 className="major-title">Disclaimer</h2>

              {/* General Disclaimer */}
              <section id="disclaimer" className="legal-section">
                <h3>General Disclaimer</h3>
                <p>
                  The TITech Community Capital Platform is provided on an "as-is" and "as-available" basis
                  without any representations, warranties, or conditions of any kind, either express
                  or implied, including any implied warranties of merchantability, fitness for a
                  particular purpose, or non-infringement.
                </p>
                <h4>Warranty Disclaimers:</h4>
                <ul>
                  <li>
                    We do not warrant that the Platform will be error-free, uninterrupted, or secure
                  </li>
                  <li>We do not warrant that defects in the Platform will be corrected</li>
                  <li>We do not guarantee specific results from the use of the Platform</li>
                  <li>
                    Your use of third-party content accessed through the Platform is at your own
                    risk
                  </li>
                  <li>
                    We are not responsible for any loss or damage arising from your use of the
                    Platform
                  </li>
                </ul>
              </section>

              {/* Financial Disclaimer */}
              <section id="financial-disclaimer" className="legal-section">
                <h3>Financial Disclaimer</h3>
                <p>
                  <strong>
                    IMPORTANT: TITech Community Capital is not a licensed financial institution and
                    does not provide financial advice, investment advice, or legal advice.
                  </strong>
                </p>
                <h4>Key Points:</h4>
                <ul>
                  <li>
                    All financial transactions and loan agreements are conducted directly between
                    group members at their own risk and discretion
                  </li>
                  <li>
                    The Platform makes no representations regarding the creditworthiness or
                    reliability of borrowers
                  </li>
                  <li>
                    The Platform is not responsible for disputes, defaults, or any losses arising
                    from loans or savings agreements
                  </li>
                  <li>
                    Users should conduct their own due diligence and consult with professional
                    financial and legal advisors
                  </li>
                  <li>Past performance does not guarantee future results</li>
                  <li>
                    Interest rates and loan terms should comply with all applicable local, national,
                    and international regulations
                  </li>
                  <li>
                    Users are solely responsible for ensuring compliance with all tax obligations
                    and financial regulations
                  </li>
                </ul>
              </section>

              {/* Contact Legal */}
              <section id="contact-legal" className="legal-section">
                <h3>Contact Legal</h3>
                <p>
                  If you have questions about these legal documents or our practices, or to exercise
                  your privacy rights, please contact our legal team:
                </p>
                <div className="contact-box">
                  <p>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:legal@communitysavings.app">legal@communitysavings.app</a>
                  </p>
                  <p>
                    <strong>Phone:</strong> <a href="tel:+256782397907">+256 (782) 397907</a>
                  </p>
                  <p>
                    <strong>Address:</strong> Kampala, Uganda
                  </p>
                  <p>
                    <strong>Response Time:</strong> We aim to respond to all inquiries within 5
                    business days
                  </p>
                </div>
              </section>
            </section>

            {/* Footer Note */}
            <section className="legal-footer-note">
              <p>
                <strong>Last Updated:</strong> January 15, 2026 |<strong> Version:</strong> 1.0
              </p>
              <p>
                These legal documents are subject to change. We recommend reviewing them
                periodically for updates.
              </p>
            </section>
          </article>

          {/* Scroll to Top Button */}
          {showScrollTop && (
            <button
              className="scroll-top-btn"
              onClick={scrollToTop}
              aria-label="Scroll to top"
              title="Scroll to top"
            >
              <ChevronUp size={20} />
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default Legal;
