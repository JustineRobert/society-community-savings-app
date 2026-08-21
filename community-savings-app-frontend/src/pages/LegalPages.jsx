/**
 * ============================================================================
 * TITech Community Capital – Legal Pages
 * File: frontend/src/pages/LegalPages.jsx
 *
 * Enterprise Production Grade
 * ----------------------------------------------------------------------------
 * Purpose:
 * - Centralized legal-document definitions and rendering
 * - Terms of Service
 * - Privacy Policy
 * - Financial Disclaimer
 * - Accessibility / WCAG-oriented structure
 * - Responsive document layout
 * - Deep-link friendly sections
 * - Sticky navigation
 * - Active section tracking
 * - Print support
 * - Scroll-to-top support
 * - Keyboard accessible navigation
 * - Reduced-motion awareness
 * - SEO-friendly document metadata
 * - Safe rendering of legal content
 * - TITech terminology consistency
 *
 * IMPORTANT:
 * - Replace any legacy ACFOS terminology with TITech Community Capital.
 * - This component intentionally contains no authentication state.
 * - This component does not process financial transactions.
 * - Legal text should be reviewed and approved by qualified counsel before
 *   being treated as final legal documentation.
 * ============================================================================
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronUp,
  FileText,
  Home,
  Lock,
  Printer,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import './Legal.css';

/* ============================================================================
 * Constants
 * ========================================================================== */

const BRAND_NAME = 'TITech Community Capital';

const LEGAL_LAST_UPDATED = 'January 15, 2026';
const LEGAL_VERSION = '1.0';

const LEGAL_EMAIL = 'legal@titechcommunity.app';
const LEGAL_PHONE = '+256782397907';
const LEGAL_PHONE_DISPLAY = '+256 (782) 397907';
const LEGAL_ADDRESS = 'Kampala, Uganda';

const SCROLL_TOP_THRESHOLD = 420;

const SECTION_IDS = Object.freeze([
  'tos-1',
  'tos-2',
  'tos-3',
  'tos-4',
  'tos-5',
  'tos-6',
  'pp-1',
  'pp-2',
  'pp-3',
  'pp-4',
  'pp-5',
  'pp-6',
  'disclaimer',
  'financial-disclaimer',
  'contact-legal',
]);

/* ============================================================================
 * Navigation Definition
 * ========================================================================== */

const NAV_SECTIONS = Object.freeze([
  {
    id: 'terms',
    title: 'Terms of Service',
    icon: Scale,
    links: [
      {
        id: 'tos-1',
        label: '1. Acceptance of Terms',
      },
      {
        id: 'tos-2',
        label: '2. User Rights & Responsibilities',
      },
      {
        id: 'tos-3',
        label: '3. User Conduct',
      },
      {
        id: 'tos-4',
        label: '4. Payment Terms',
      },
      {
        id: 'tos-5',
        label: '5. Loan Agreements',
      },
      {
        id: 'tos-6',
        label: '6. Limitation of Liability',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    icon: ShieldCheck,
    links: [
      {
        id: 'pp-1',
        label: '1. Information We Collect',
      },
      {
        id: 'pp-2',
        label: '2. How We Use Information',
      },
      {
        id: 'pp-3',
        label: '3. Data Security',
      },
      {
        id: 'pp-4',
        label: '4. Your Privacy Rights',
      },
      {
        id: 'pp-5',
        label: '5. Cookies & Tracking',
      },
      {
        id: 'pp-6',
        label: '6. Third-Party Services',
      },
    ],
  },
  {
    id: 'disclaimer-section',
    title: 'Disclaimer',
    icon: AlertTriangle,
    links: [
      {
        id: 'disclaimer',
        label: 'General Disclaimer',
      },
      {
        id: 'financial-disclaimer',
        label: 'Financial Disclaimer',
      },
      {
        id: 'contact-legal',
        label: 'Contact Legal',
      },
    ],
  },
]);

/* ============================================================================
 * Utility Functions
 * ========================================================================== */

function prefersReducedMotion() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches,
  );
}

function getLegalSectionElements() {
  if (typeof document === 'undefined') {
    return [];
  }

  return SECTION_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function updateHash(id) {
  if (
    typeof window === 'undefined' ||
    !window.history?.replaceState
  ) {
    return;
  }

  const url = `${window.location.pathname}${window.location.search}#${id}`;

  window.history.replaceState(
    window.history.state,
    '',
    url,
  );
}

function clearHash() {
  if (
    typeof window === 'undefined' ||
    !window.history?.replaceState
  ) {
    return;
  }

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

/* ============================================================================
 * Legal Page Header
 * ========================================================================== */

function LegalPageHeader() {
  return (
    <header className="legal-header">
      <div className="legal-header-content">
        <div
          className="legal-header-badge"
          aria-hidden="true"
        >
          <ShieldCheck size={20} />
          <span>{BRAND_NAME}</span>
        </div>

        <h1 className="legal-title">
          Legal Information
        </h1>

        <p className="legal-subtitle">
          Terms of Service, Privacy Policy & Disclaimer
        </p>

        <p className="legal-description">
          Please review these legal documents carefully.
          They explain the terms governing your use of the{' '}
          {BRAND_NAME} Platform, our approach to privacy
          and data protection, and important financial,
          operational, and technology-related disclaimers.
        </p>

        <div
          className="legal-header-meta"
          aria-label="Legal document metadata"
        >
          <span>
            <strong>Last updated:</strong>{' '}
            {LEGAL_LAST_UPDATED}
          </span>

          <span aria-hidden="true">•</span>

          <span>
            <strong>Version:</strong>{' '}
            {LEGAL_VERSION}
          </span>
        </div>
      </div>
    </header>
  );
}

/* ============================================================================
 * Legal Navigation
 * ========================================================================== */

function LegalNavigation({
  navigation,
  activeSection,
  onSectionNavigation,
  onPrint,
}) {
  return (
    <aside
      className="legal-sidebar"
      aria-label="Legal document navigation"
    >
      <nav
        className="legal-nav"
        aria-label="Legal sections"
      >
        {navigation.map((section) => {
          const SectionIcon = section.icon;

          return (
            <div
              className="nav-section"
              key={section.id}
            >
              <h2 className="nav-section-title">
                <SectionIcon
                  size={16}
                  aria-hidden="true"
                />

                <span>{section.title}</span>
              </h2>

              <div className="nav-section-links">
                {section.links.map((link) => {
                  const isActive =
                    activeSection === link.id;

                  return (
                    <a
                      key={link.id}
                      href={`#${link.id}`}
                      className={`nav-link${
                        isActive
                          ? ' active'
                          : ''
                      }`}
                      aria-current={
                        isActive
                          ? 'location'
                          : undefined
                      }
                      onClick={(event) =>
                        onSectionNavigation(
                          event,
                          link.id,
                        )
                      }
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="legal-nav-actions">
        <Link
          to="/dashboard"
          className="nav-action-link"
          title="Return to dashboard"
          aria-label={`Return to ${BRAND_NAME} dashboard`}
        >
          <Home
            size={18}
            aria-hidden="true"
          />

          <span>Dashboard</span>
        </Link>

        <button
          type="button"
          className="nav-action-link"
          onClick={onPrint}
          title="Print legal documents"
          aria-label="Print legal documents"
        >
          <Printer
            size={18}
            aria-hidden="true"
          />

          <span>Print</span>
        </button>
      </div>
    </aside>
  );
}

/* ============================================================================
 * Terms of Service
 * ========================================================================== */

function TermsOfService() {
  return (
    <section
      className="legal-major-section"
      aria-labelledby="terms-title"
    >
      <div className="legal-major-heading">
        <div
          className="legal-major-icon"
          aria-hidden="true"
        >
          <Scale size={24} />
        </div>

        <div>
          <h2
            id="terms-title"
            className="major-title"
          >
            Terms of Service
          </h2>

          <p className="section-update">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>
        </div>
      </div>

      <section
        id="tos-1"
        className="legal-section"
        aria-labelledby="tos-1-title"
      >
        <h3 id="tos-1-title">
          1. Acceptance of Terms
        </h3>

        <p>
          By accessing or using the {BRAND_NAME} Platform,
          you acknowledge that you have read, understood,
          and agree to be bound by these Terms of Service
          and applicable laws and regulations.
        </p>

        <p>
          If you do not agree with these Terms, you should
          discontinue use of the Platform. {BRAND_NAME} may
          update these Terms from time to time. Continued
          use following publication of material changes
          constitutes acceptance of the revised Terms to
          the extent permitted by applicable law.
        </p>
      </section>

      <section
        id="tos-2"
        className="legal-section"
        aria-labelledby="tos-2-title"
      >
        <h3 id="tos-2-title">
          2. User Rights & Responsibilities
        </h3>

        <p>
          Subject to these Terms, {BRAND_NAME} grants you
          a limited, non-exclusive, non-transferable right
          to access and use the Platform for lawful purposes.
        </p>

        <h4>User Responsibilities</h4>

        <ul>
          <li>
            Maintain the confidentiality of your account
            credentials.
          </li>

          <li>
            Accept responsibility for activity performed
            through your account.
          </li>

          <li>
            Provide accurate, complete, and current
            registration information.
          </li>

          <li>
            Comply with applicable laws, regulations,
            policies, and contractual obligations.
          </li>

          <li>
            Avoid using the Platform for illegal,
            fraudulent, deceptive, or unauthorized purposes.
          </li>

          <li>
            Keep your contact and account information
            reasonably current.
          </li>
        </ul>
      </section>

      <section
        id="tos-3"
        className="legal-section"
        aria-labelledby="tos-3-title"
      >
        <h3 id="tos-3-title">
          3. User Conduct
        </h3>

        <p>
          You agree not to misuse the Platform or interfere
          with the rights, security, availability, integrity,
          or operation of {BRAND_NAME} or its users.
        </p>

        <ul>
          <li>
            Harass, threaten, intimidate, or deliberately
            cause distress to another person.
          </li>

          <li>
            Engage in fraud, impersonation,
            misrepresentation, or deception.
          </li>

          <li>
            Attempt to gain unauthorized access to systems,
            accounts, APIs, or data.
          </li>

          <li>
            Upload or transmit malicious, harmful, or
            unlawful content.
          </li>

          <li>
            Infringe intellectual property, privacy, or
            other legal rights.
          </li>

          <li>
            Interfere with the availability, integrity,
            or normal operation of the Platform.
          </li>

          <li>
            Send unsolicited commercial messages, spam,
            or abusive communications.
          </li>

          <li>
            Attempt to reverse engineer, decompile, or
            improperly discover protected implementation
            details.
          </li>

          <li>
            Use the Platform for money laundering,
            terrorist financing, fraud, or other unlawful
            financial activity.
          </li>

          <li>
            Engage in unlawful discrimination, harassment,
            or abusive conduct.
          </li>
        </ul>
      </section>

      <section
        id="tos-4"
        className="legal-section"
        aria-labelledby="tos-4-title"
      >
        <h3 id="tos-4-title">
          4. Payment Terms
        </h3>

        <p>
          {BRAND_NAME} may provide technology that
          facilitates or records financial activity between
          authorized participants. Specific payment services
          may depend on approved payment providers and
          applicable regulatory requirements.
        </p>

        <h4>Payment Processing</h4>

        <ul>
          <li>
            Transactions must use authorized payment
            channels.
          </li>

          <li>
            Payment processing may involve third-party
            financial or payment service providers.
          </li>

          <li>
            Processing times may vary depending on the
            selected provider and financial institution.
          </li>

          <li>
            A transaction may fail, be delayed, reversed,
            rejected, or placed under review.
          </li>

          <li>
            Users may be responsible for fees imposed by
            their financial institution or payment provider.
          </li>

          <li>
            Transaction records should be reviewed promptly
            and discrepancies reported through appropriate
            support channels.
          </li>
        </ul>

        <h4>Refunds & Reversals</h4>

        <ul>
          <li>
            Refunds or reversals are subject to the nature
            of the transaction and applicable provider rules.
          </li>

          <li>
            Certain completed financial transactions may
            not be reversible.
          </li>

          <li>
            Transaction disputes should be reported as soon
            as reasonably possible.
          </li>

          <li>
            Resolution may require coordination with a
            payment provider or financial institution.
          </li>
        </ul>
      </section>

      <section
        id="tos-5"
        className="legal-section"
        aria-labelledby="tos-5-title"
      >
        <h3 id="tos-5-title">
          5. Loan Agreements
        </h3>

        <p>
          Where the Platform supports community lending,
          loan arrangements may be established between
          authorized participants subject to group rules
          and applicable law.
        </p>

        <ul>
          <li>
            Loan terms should be clearly agreed by the
            relevant parties.
          </li>

          <li>
            Repayment schedules and applicable charges
            should be documented.
          </li>

          <li>
            {BRAND_NAME} does not guarantee repayment unless
            expressly stated in a separate binding agreement.
          </li>

          <li>
            Loan defaults and disputes may require direct
            resolution between the parties or appropriate
            legal processes.
          </li>

          <li>
            Users are responsible for understanding the
            risks associated with lending and borrowing.
          </li>

          <li>
            Loan arrangements must comply with applicable
            laws and regulatory requirements.
          </li>
        </ul>

        <div
          className="highlight"
          role="note"
        >
          <strong>Important:</strong>{' '}
          {BRAND_NAME} is a technology platform and does
          not, by itself, constitute a licensed financial
          institution or provider of personalized financial
          or legal advice.
        </div>
      </section>

      <section
        id="tos-6"
        className="legal-section"
        aria-labelledby="tos-6-title"
      >
        <h3 id="tos-6-title">
          6. Limitation of Liability
        </h3>

        <p>
          To the fullest extent permitted by applicable law,
          {` ${BRAND_NAME}`} will not be liable for indirect,
          incidental, special, consequential, or punitive
          damages arising from use of the Platform, including
          loss of profits, revenue, data, or business
          opportunities.
        </p>

        <p>
          Nothing in these Terms excludes or limits liability
          that cannot lawfully be excluded or limited under
          applicable law.
        </p>

        <p>
          Where a limitation of liability is legally
          enforceable, {BRAND_NAME}'s aggregate liability
          will be limited to the maximum extent permitted
          by applicable law.
        </p>
      </section>
    </section>
  );
}

/* ============================================================================
 * Privacy Policy
 * ========================================================================== */

function PrivacyPolicy() {
  return (
    <section
      className="legal-major-section"
      aria-labelledby="privacy-title"
    >
      <div className="legal-major-heading">
        <div
          className="legal-major-icon"
          aria-hidden="true"
        >
          <Lock size={24} />
        </div>

        <div>
          <h2
            id="privacy-title"
            className="major-title"
          >
            Privacy Policy
          </h2>

          <p className="section-update">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>
        </div>
      </div>

      <section
        id="pp-1"
        className="legal-section"
        aria-labelledby="pp-1-title"
      >
        <h3 id="pp-1-title">
          1. Information We Collect
        </h3>

        <p>
          We collect information necessary to operate the
          {` ${BRAND_NAME}`} Platform, provide requested
          services, maintain security, and comply with
          applicable legal obligations.
        </p>

        <h4>Information You Provide</h4>

        <ul>
          <li>Name and contact information.</li>
          <li>Phone number and address information.</li>
          <li>
            Identification and verification information
            where required.
          </li>
          <li>
            Financial and transaction-related information
            necessary to provide requested services.
          </li>
          <li>
            Profile and account information you choose to
            provide.
          </li>
        </ul>

        <h4>Automatically Collected Information</h4>

        <ul>
          <li>
            Device type, operating system, browser, and
            application information.
          </li>

          <li>
            IP address, timestamps, access records, and
            technical logs.
          </li>

          <li>
            Security and fraud-prevention signals.
          </li>

          <li>
            Cookies and similar technologies where
            applicable.
          </li>

          <li>
            Location information where enabled and
            permitted.
          </li>
        </ul>
      </section>

      <section
        id="pp-2"
        className="legal-section"
        aria-labelledby="pp-2-title"
      >
        <h3 id="pp-2-title">
          2. How We Use Information
        </h3>

        <p>We may use collected information to:</p>

        <ul>
          <li>
            Provide, operate, maintain, and improve the
            Platform.
          </li>

          <li>
            Authenticate users and manage accounts.
          </li>

          <li>
            Process, record, reconcile, and communicate
            transaction information.
          </li>

          <li>
            Detect, investigate, and prevent fraud,
            abuse, unauthorized activity, and security
            incidents.
          </li>

          <li>
            Provide customer support and respond to
            inquiries.
          </li>

          <li>
            Send service communications and, where legally
            permitted, promotional communications.
          </li>

          <li>
            Meet legal, regulatory, accounting, and
            compliance obligations.
          </li>

          <li>
            Analyze system performance and improve
            reliability and user experience.
          </li>
        </ul>
      </section>

      <section
        id="pp-3"
        className="legal-section"
        aria-labelledby="pp-3-title"
      >
        <h3 id="pp-3-title">
          3. Data Security
        </h3>

        <p>
          {BRAND_NAME} maintains technical and organizational
          safeguards designed to protect personal information
          against unauthorized access, alteration, disclosure,
          destruction, and misuse.
        </p>

        <ul>
          <li>
            Encryption for sensitive data in transit.
          </li>

          <li>
            Secure credential storage and authentication
            controls.
          </li>

          <li>
            Access controls based on operational requirements
            and authorization.
          </li>

          <li>
            Security monitoring and audit logging.
          </li>

          <li>
            Backup and recovery controls appropriate to
            the service.
          </li>

          <li>
            Security testing and vulnerability management
            processes.
          </li>
        </ul>

        <p>
          No internet-based service can guarantee absolute
          security. Users should also protect their
          credentials and promptly report suspected
          unauthorized activity.
        </p>
      </section>

      <section
        id="pp-4"
        className="legal-section"
        aria-labelledby="pp-4-title"
      >
        <h3 id="pp-4-title">
          4. Your Privacy Rights
        </h3>

        <p>
          Depending on applicable law and your location,
          you may have rights concerning your personal
          information, including:
        </p>

        <ul>
          <li>
            <strong>Access:</strong> Request access to
            personal information we hold about you.
          </li>

          <li>
            <strong>Rectification:</strong> Request
            correction of inaccurate or incomplete
            information.
          </li>

          <li>
            <strong>Erasure:</strong> Request deletion
            where legally permitted.
          </li>

          <li>
            <strong>Restriction:</strong> Request
            restriction of certain processing activities
            where applicable.
          </li>

          <li>
            <strong>Portability:</strong> Request
            applicable personal information in a portable
            format.
          </li>

          <li>
            <strong>Withdrawal of Consent:</strong>{' '}
            Withdraw consent where processing relies on
            consent.
          </li>

          <li>
            <strong>Complaint:</strong> Lodge a complaint
            with the relevant data protection authority.
          </li>
        </ul>

        <p>
          Some rights are subject to legal, regulatory,
          contractual, security, and operational
          limitations.
        </p>
      </section>

      <section
        id="pp-5"
        className="legal-section"
        aria-labelledby="pp-5-title"
      >
        <h3 id="pp-5-title">
          5. Cookies & Tracking
        </h3>

        <p>
          The Platform may use cookies and related
          technologies to support functionality, security,
          preferences, analytics, and service performance.
        </p>

        <h4>Potential Cookie Categories</h4>

        <ul>
          <li>
            <strong>Essential:</strong> Required for
            functionality, authentication, and security.
          </li>

          <li>
            <strong>Performance:</strong> Used to understand
            service performance and usage.
          </li>

          <li>
            <strong>Functional:</strong> Used to remember
            preferences and settings.
          </li>

          <li>
            <strong>Marketing:</strong> Where applicable
            and permitted, used for relevant communications
            and measurement.
          </li>
        </ul>

        <p>
          Browser settings can be used to manage certain
          cookies. Disabling essential technologies may
          affect Platform functionality.
        </p>
      </section>

      <section
        id="pp-6"
        className="legal-section"
        aria-labelledby="pp-6-title"
      >
        <h3 id="pp-6-title">
          6. Third-Party Services
        </h3>

        <p>
          {BRAND_NAME} may work with carefully selected
          third-party providers that support Platform
          operations.
        </p>

        <ul>
          <li>
            Payment and financial service providers.
          </li>

          <li>
            Cloud hosting and infrastructure providers.
          </li>

          <li>
            Security, monitoring, and observability
            services.
          </li>

          <li>
            Email and communications providers.
          </li>

          <li>
            Customer support and operational services.
          </li>
        </ul>

        <p>
          Third-party providers may process information on
          our behalf subject to applicable agreements,
          security requirements, and legal obligations.
          {` ${BRAND_NAME}`} does not sell personal
          information as a business model.
        </p>
      </section>
    </section>
  );
}

/* ============================================================================
 * Disclaimer
 * ========================================================================== */

function Disclaimer() {
  return (
    <section
      className="legal-major-section"
      aria-labelledby="disclaimer-title"
    >
      <div className="legal-major-heading">
        <div
          className="legal-major-icon"
          aria-hidden="true"
        >
          <FileText size={24} />
        </div>

        <div>
          <h2
            id="disclaimer-title"
            className="major-title"
          >
            Disclaimer
          </h2>
        </div>
      </div>

      <section
        id="disclaimer"
        className="legal-section"
        aria-labelledby="general-disclaimer-title"
      >
        <h3 id="general-disclaimer-title">
          General Disclaimer
        </h3>

        <p>
          The {BRAND_NAME} Platform is provided on an
          “as-is” and “as-available” basis to the fullest
          extent permitted by applicable law.
        </p>

        <h4>Warranty Disclaimers</h4>

        <ul>
          <li>
            We do not guarantee uninterrupted or
            error-free availability.
          </li>

          <li>
            We do not guarantee that all defects will be
            corrected immediately.
          </li>

          <li>
            We do not guarantee specific outcomes from
            use of the Platform.
          </li>

          <li>
            Third-party services and content may be subject
            to separate terms and risks.
          </li>

          <li>
            Users remain responsible for decisions made
            using Platform information.
          </li>
        </ul>
      </section>

      <section
        id="financial-disclaimer"
        className="legal-section"
        aria-labelledby="financial-disclaimer-title"
      >
        <h3 id="financial-disclaimer-title">
          Financial Disclaimer
        </h3>

        <div
          className="highlight"
          role="note"
        >
          <strong>Important:</strong>{' '}
          {BRAND_NAME} is a technology platform and does
          not provide personalized financial, investment,
          tax, or legal advice unless expressly stated
          under a separate authorized service.
        </div>

        <h4>Key Points</h4>

        <ul>
          <li>
            Financial activity may involve risks,
            including payment failure, delays, fraud,
            disputes, and counterparty default.
          </li>

          <li>
            Users should independently assess the risks
            associated with savings, lending, borrowing,
            and other financial activity.
          </li>

          <li>
            {BRAND_NAME} does not guarantee the
            creditworthiness, reliability, or performance
            of another participant.
          </li>

          <li>
            Users should seek qualified professional
            advice where financial or legal advice is
            required.
          </li>

          <li>
            Financial arrangements must comply with
            applicable laws and regulations.
          </li>

          <li>
            Users remain responsible for applicable tax,
            reporting, and regulatory obligations.
          </li>
        </ul>
      </section>

      <section
        id="contact-legal"
        className="legal-section"
        aria-labelledby="contact-legal-title"
      >
        <h3 id="contact-legal-title">
          Contact Legal
        </h3>

        <p>
          If you have questions regarding these documents,
          privacy practices, or applicable user rights,
          please contact the {BRAND_NAME} legal team
          through the organization's approved contact
          channels.
        </p>

        <div
          className="contact-box"
          aria-label="Legal contact information"
        >
          <p>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${LEGAL_EMAIL}`}>
              {LEGAL_EMAIL}
            </a>
          </p>

          <p>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${LEGAL_PHONE}`}>
              {LEGAL_PHONE_DISPLAY}
            </a>
          </p>

          <p>
            <strong>Address:</strong>{' '}
            {LEGAL_ADDRESS}
          </p>

          <p>
            <strong>Target response time:</strong>{' '}
            We aim to respond to legal and privacy
            inquiries within 5 business days, subject to
            complexity, verification requirements, and
            applicable law.
          </p>
        </div>
      </section>
    </section>
  );
}

/* ============================================================================
 * Document Footer
 * ========================================================================== */

function LegalDocumentFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="legal-footer-note">
      <p>
        <strong>Last Updated:</strong>{' '}
        {LEGAL_LAST_UPDATED}{' '}
        <span aria-hidden="true">|</span>{' '}
        <strong>Version:</strong>{' '}
        {LEGAL_VERSION}
      </p>

      <p>
        These documents may be updated from time to time
        to reflect changes in the Platform, applicable
        law, regulatory requirements, security practices,
        or business operations. Users should review this
        page periodically for updates.
      </p>

      <p className="legal-footer-brand">
        © {currentYear} {BRAND_NAME}. All rights reserved.
      </p>
    </footer>
  );
}

/* ============================================================================
 * Main Component
 * ========================================================================== */

const LegalPages = () => {
  const location = useLocation();

  const contentRef = useRef(null);
  const observerRef = useRef(null);
  const hashNavigationRef = useRef(false);

  const [activeSection, setActiveSection] =
    useState('tos-1');

  const [showScrollTop, setShowScrollTop] =
    useState(false);

  const navigation = useMemo(
    () => NAV_SECTIONS,
    [],
  );

  /* --------------------------------------------------------------------------
   * Scroll handling
   * ------------------------------------------------------------------------ */

  const handleScroll = useCallback(() => {
    const container = contentRef.current;

    if (!container) {
      return;
    }

    setShowScrollTop(
      container.scrollTop > SCROLL_TOP_THRESHOLD,
    );
  }, []);

  /* --------------------------------------------------------------------------
   * Scroll to section
   * ------------------------------------------------------------------------ */

  const scrollToSection = useCallback((id) => {
    if (
      typeof document === 'undefined' ||
      !SECTION_IDS.includes(id)
    ) {
      return;
    }

    const target =
      document.getElementById(id);

    const container =
      contentRef.current;

    if (!target || !container) {
      return;
    }

    hashNavigationRef.current = true;

    const behavior = prefersReducedMotion()
      ? 'auto'
      : 'smooth';

    /*
     * scrollIntoView is intentionally avoided here because the page uses
     * an internal scrolling container. Computing the relative offset keeps
     * navigation deterministic across browsers.
     */
    const containerRect =
      container.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const offset =
      targetRect.top -
      containerRect.top +
      container.scrollTop -
      16;

    container.scrollTo({
      top: Math.max(0, offset),
      behavior,
    });

    setActiveSection(id);
    updateHash(id);

    /*
     * Allow the IntersectionObserver to resume normal tracking after the
     * programmatic scroll has completed.
     */
    window.setTimeout(
      () => {
        hashNavigationRef.current = false;
      },
      behavior === 'smooth' ? 500 : 50,
    );
  }, []);

  /* --------------------------------------------------------------------------
   * Navigation handler
   * ------------------------------------------------------------------------ */

  const handleSectionNavigation = useCallback(
    (event, id) => {
      event.preventDefault();

      scrollToSection(id);
    },
    [scrollToSection],
  );

  /* --------------------------------------------------------------------------
   * Scroll to top
   * ------------------------------------------------------------------------ */

  const scrollToTop = useCallback(() => {
    const container =
      contentRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: 0,
      behavior: prefersReducedMotion()
        ? 'auto'
        : 'smooth',
    });

    setActiveSection('tos-1');
    clearHash();
  }, []);

  /* --------------------------------------------------------------------------
   * Print
   * ------------------------------------------------------------------------ */

  const handlePrint = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.print();
  }, []);

  /* --------------------------------------------------------------------------
   * Intersection Observer
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    const container =
      contentRef.current;

    if (
      !container ||
      typeof IntersectionObserver ===
        'undefined'
    ) {
      return undefined;
    }

    const sections =
      getLegalSectionElements();

    if (!sections.length) {
      return undefined;
    }

    observerRef.current?.disconnect();

    observerRef.current =
      new IntersectionObserver(
        (entries) => {
          if (hashNavigationRef.current) {
            return;
          }

          const visibleEntries =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting,
              )
              .sort(
                (a, b) =>
                  a.boundingClientRect.top -
                  b.boundingClientRect.top,
              );

          if (!visibleEntries.length) {
            return;
          }

          const nextId =
            visibleEntries[0]?.target?.id;

          if (nextId) {
            setActiveSection(nextId);
          }
        },
        {
          root: container,
          rootMargin:
            '-10% 0px -65% 0px',
          threshold: [
            0,
            0.1,
            0.25,
            0.5,
          ],
        },
      );

    sections.forEach((section) => {
      observerRef.current.observe(section);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  /* --------------------------------------------------------------------------
   * Native scroll listener
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    const container =
      contentRef.current;

    if (!container) {
      return undefined;
    }

    container.addEventListener(
      'scroll',
      handleScroll,
      {
        passive: true,
      },
    );

    handleScroll();

    return () => {
      container.removeEventListener(
        'scroll',
        handleScroll,
      );
    };
  }, [handleScroll]);

  /* --------------------------------------------------------------------------
   * Deep-link / hash navigation
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      typeof window === 'undefined'
    ) {
      return undefined;
    }

    const hash =
      window.location.hash?.replace(
        /^#/,
        '',
      );

    if (
      !hash ||
      !SECTION_IDS.includes(hash)
    ) {
      return undefined;
    }

    const timer =
      window.setTimeout(() => {
        scrollToSection(hash);
      }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    location.pathname,
    location.search,
    scrollToSection,
  ]);

  /* --------------------------------------------------------------------------
   * Keyboard accessibility
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    const handleKeyDown = (event) => {
      /*
       * Escape provides a quick way back to the top after navigating deeply
       * into the legal document.
       */
      if (
        event.key === 'Escape' &&
        showScrollTop
      ) {
        scrollToTop();
      }

      /*
       * Ctrl/Cmd + P is intentionally left to the browser's native print
       * handling. We do not intercept it.
       */
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    scrollToTop,
    showScrollTop,
  ]);

  /* --------------------------------------------------------------------------
   * Browser metadata
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      typeof document === 'undefined'
    ) {
      return undefined;
    }

    const previousTitle =
      document.title;

    document.title =
      `${BRAND_NAME} | Legal Information`;

    return () => {
      document.title =
        previousTitle;
    };
  }, []);

  /* ==========================================================================
   * Render
   * ======================================================================== */

  return (
    <div
      className="legal-page"
      data-brand="titech-community-capital"
      data-document-version={LEGAL_VERSION}
    >
      <LegalPageHeader />

      <div className="legal-container">
        <LegalNavigation
          navigation={navigation}
          activeSection={activeSection}
          onSectionNavigation={
            handleSectionNavigation
          }
          onPrint={handlePrint}
        />

        <main
          ref={contentRef}
          className="legal-content"
          tabIndex={-1}
          aria-label={`${BRAND_NAME} legal documents`}
        >
          <article
            className="legal-article"
            aria-label="Legal documentation"
          >
            <TermsOfService />

            <PrivacyPolicy />

            <Disclaimer />

            <LegalDocumentFooter />
          </article>

          {showScrollTop && (
            <button
              type="button"
              className="scroll-top-btn"
              onClick={scrollToTop}
              aria-label="Scroll to top of legal documents"
              title="Scroll to top"
            >
              <ChevronUp
                size={20}
                aria-hidden="true"
              />
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default LegalPages;