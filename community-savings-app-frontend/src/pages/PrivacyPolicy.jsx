// ============================================================================
// TITech Community Capital
// Enterprise Privacy Policy Page
// File: frontend/src/pages/PrivacyPolicy.jsx
//
// Production Grade
// ----------------------------------------------------------------------------
// Responsibilities
// - Present TITech Community Capital's Privacy Policy
// - Provide accessible section navigation
// - Support responsive and mobile-friendly legal content
// - Provide print-friendly semantic document structure
// - Provide accessible scroll-to-top navigation
// - Expose privacy/data-protection contact information
// - Avoid misleading security guarantees
// - Maintain consistent TITech Community Capital terminology
// - Remain compatible with React Router
// - Support WCAG 2.1 AA-oriented accessibility practices
// ============================================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Link,
  useLocation,
} from 'react-router-dom';

import {
  ArrowUp,
  FileText,
  Home,
  Mail,
  Shield,
  Phone,
} from 'lucide-react';

import './LegalPages.css';

// ============================================================================
// Constants
// ============================================================================

const PRIVACY_POLICY_VERSION = '1.0';

const LAST_UPDATED = 'January 15, 2026';

const SCROLL_TOP_THRESHOLD = 300;

const PRIVACY_EMAIL = 'privacy@communitysavings.app';

const DPO_EMAIL = 'dpo@communitysavings.app';

const PRIVACY_PHONE_DISPLAY = '+256 (394) 324760';

const PRIVACY_PHONE_HREF = '+256394324760';

const MAILING_ADDRESS =
  'TITech Community Capital Ltd, Plot 69-71 Jinja Road, Kampala, Uganda';

// ============================================================================
// Navigation Configuration
// ============================================================================

const POLICY_SECTIONS = [
  {
    id: 'section-1',
    label: '1. Introduction',
  },
  {
    id: 'section-2',
    label: '2. Information We Collect',
  },
  {
    id: 'section-3',
    label: '3. How We Use Your Data',
  },
  {
    id: 'section-4',
    label: '4. Data Security',
  },
  {
    id: 'section-5',
    label: '5. Data Sharing',
  },
  {
    id: 'section-6',
    label: '6. Your Rights',
  },
  {
    id: 'section-7',
    label: '7. Cookies & Tracking',
  },
  {
    id: 'section-8',
    label: '8. Data Retention',
  },
  {
    id: 'section-9',
    label: "9. Children's Privacy",
  },
  {
    id: 'section-10',
    label: '10. Changes to This Privacy Policy',
  },
  {
    id: 'privacy-contact',
    label: 'Privacy Contact Information',
  },
];

// ============================================================================
// Helpers
// ============================================================================

const getCurrentYear = () => {
  return new Date().getFullYear();
};

// ============================================================================
// Main Component
// ============================================================================

const PrivacyPolicy = () => {
  const location = useLocation();

  const contentRef = useRef(null);

  const [showScrollTop, setShowScrollTop] = useState(false);

  const currentYear = useMemo(
    () => getCurrentYear(),
    [],
  );

  // --------------------------------------------------------------------------
  // Scroll handling
  // --------------------------------------------------------------------------

  const handleContentScroll = useCallback(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    setShowScrollTop(
      element.scrollTop > SCROLL_TOP_THRESHOLD,
    );
  }, []);

  useEffect(() => {
    const element = contentRef.current;

    if (!element) {
      return undefined;
    }

    element.addEventListener(
      'scroll',
      handleContentScroll,
      {
        passive: true,
      },
    );

    handleContentScroll();

    return () => {
      element.removeEventListener(
        'scroll',
        handleContentScroll,
      );
    };
  }, [handleContentScroll]);

  // --------------------------------------------------------------------------
  // Handle deep-linked sections
  // --------------------------------------------------------------------------

  useEffect(() => {
    const hash = window.location.hash;

    if (!hash) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      try {
        const target = document.querySelector(hash);

        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      } catch {
        // Ignore malformed hashes.
      }
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [location.hash]);

  // --------------------------------------------------------------------------
  // Scroll to top
  // --------------------------------------------------------------------------

  const scrollToTop = useCallback(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    element.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  // --------------------------------------------------------------------------
  // Section navigation
  // --------------------------------------------------------------------------

  const handleSectionNavigation = useCallback(
    (event, sectionId) => {
      event.preventDefault();

      const element = document.getElementById(
        sectionId,
      );

      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      // Keep the browser URL synchronized with the selected section
      // without forcing a full navigation.
      if (
        typeof window !== 'undefined' &&
        window.history
      ) {
        window.history.replaceState(
          null,
          '',
          `#${sectionId}`,
        );
      }

      // Move keyboard focus to the section heading when possible.
      const heading = element.querySelector(
        'h2',
      );

      if (heading) {
        heading.setAttribute(
          'tabindex',
          '-1',
        );

        heading.focus({
          preventScroll: true,
        });
      }
    },
    [],
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="legal-page">
      {/* ================================================================== */}
      {/* Header                                                             */}
      {/* ================================================================== */}

      <header className="legal-header">
        <div className="legal-header-content">
          <div
            className="legal-header-icon"
            aria-hidden="true"
          >
            <Shield size={30} />
          </div>

          <p className="legal-eyebrow">
            TITech Community Capital
          </p>

          <h1 className="legal-title">
            Privacy Policy
          </h1>

          <p className="legal-subtitle">
            Last updated: {LAST_UPDATED}
            {' • '}
            Version {PRIVACY_POLICY_VERSION}
          </p>

          <p className="legal-description">
            We are committed to protecting your personal
            information, respecting your privacy, and
            maintaining appropriate safeguards when you
            use TITech Community Capital services.
          </p>
        </div>
      </header>

      {/* ================================================================== */}
      {/* Main Legal Layout                                                  */}
      {/* ================================================================== */}

      <div className="legal-container">
        {/* ================================================================ */}
        {/* Sidebar                                                          */}
        {/* ================================================================ */}

        <aside
          className="legal-sidebar"
          aria-label="Privacy Policy navigation"
        >
          <nav
            className="legal-nav"
            aria-label="Privacy Policy Sections"
          >
            <div className="legal-nav-heading">
              <FileText
                size={17}
                aria-hidden="true"
              />

              <span>
                On this page
              </span>
            </div>

            <ol className="legal-nav-list">
              {POLICY_SECTIONS.map(
                (section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="nav-link"
                      onClick={(event) =>
                        handleSectionNavigation(
                          event,
                          section.id,
                        )
                      }
                    >
                      {section.label}
                    </a>
                  </li>
                ),
              )}
            </ol>
          </nav>
        </aside>

        {/* ================================================================ */}
        {/* Main Content                                                     */}
        {/* ================================================================ */}

        <main
          ref={contentRef}
          className="legal-content"
          aria-label="Privacy Policy"
          tabIndex="-1"
        >
          <article
            className="legal-article"
            aria-labelledby="privacy-policy-heading"
          >
            {/* ============================================================ */}
            {/* Document Introduction                                        */}
            {/* ============================================================ */}

            <div className="legal-document-meta">
              <p>
                <strong>
                  Document:
                </strong>{' '}
                Privacy Policy
              </p>

              <p>
                <strong>
                  Effective date:
                </strong>{' '}
                {LAST_UPDATED}
              </p>

              <p>
                <strong>
                  Organization:
                </strong>{' '}
                TITech Community Capital Ltd
              </p>
            </div>

            {/* ============================================================ */}
            {/* Section 1                                                     */}
            {/* ============================================================ */}

            <section
              id="section-1"
              className="legal-section"
            >
              <h2 id="privacy-policy-heading">
                1. Introduction
              </h2>

              <p>
                TITech Community Capital
                {' ('}
                "TITech Community Capital",
                {' "we", "us", or "our") operates
                the Community Savings App and
                related digital financial and
                community-management services
                (collectively, the "Platform").
              </p>

              <p>
                This Privacy Policy explains how
                we collect, use, disclose, retain,
                and protect personal information
                when you access or use the Platform.
              </p>

              <p>
                By using the Platform, you
                acknowledge that you have read and
                understood this Privacy Policy.
                Where applicable law requires a
                separate legal basis or consent for
                a particular processing activity, we
                will rely on the appropriate legal
                basis.
              </p>

              <p>
                This policy should be read together
                with our Terms of Service and any
                additional privacy notices provided
                for specific services or processing
                activities.
              </p>
            </section>

            {/* ============================================================ */}
            {/* Section 2                                                     */}
            {/* ============================================================ */}

            <section
              id="section-2"
              className="legal-section"
            >
              <h2>
                2. Information We Collect
              </h2>

              <p>
                Depending on the services you use,
                TITech Community Capital may collect
                the following categories of
                information.
              </p>

              <h3>
                Personal Data You Provide
              </h3>

              <ul>
                <li>
                  <strong>
                    Account Information:
                  </strong>{' '}
                  Name, email address, phone
                  number, date of birth, and
                  account credentials.
                </li>

                <li>
                  <strong>
                    Financial Information:
                  </strong>{' '}
                  Payment information,
                  transaction records,
                  contribution information,
                  savings activity, and
                  applicable financial-account
                  verification information.
                </li>

                <li>
                  <strong>
                    Profile Information:
                  </strong>{' '}
                  Savings goals, group
                  memberships, preferences,
                  and communication settings.
                </li>

                <li>
                  <strong>
                    Contact Information:
                  </strong>{' '}
                  Address, telephone number,
                  and optional emergency-contact
                  information where provided.
                </li>

                <li>
                  <strong>
                    Identity and Verification
                    Information:
                  </strong>{' '}
                  Information reasonably required
                  for identity verification,
                  KYC, AML, fraud prevention,
                  or regulatory compliance.
                </li>
              </ul>

              <h3>
                Automatically Collected Information
              </h3>

              <ul>
                <li>
                  <strong>
                    Device Information:
                  </strong>{' '}
                  Device type, operating system,
                  browser type, application
                  version, and related technical
                  information.
                </li>

                <li>
                  <strong>
                    Usage Data:
                  </strong>{' '}
                  Pages viewed, features used,
                  timestamps, interactions, and
                  diagnostic information.
                </li>

                <li>
                  <strong>
                    Approximate Location:
                  </strong>{' '}
                  General location information
                  such as city or country where
                  available and appropriate.
                </li>

                <li>
                  <strong>
                    IP Address:
                  </strong>{' '}
                  Collected where necessary for
                  security, fraud prevention,
                  diagnostics, and service
                  operation.
                </li>

                <li>
                  <strong>
                    Cookies and Similar
                    Technologies:
                  </strong>{' '}
                  Information collected through
                  cookies and comparable
                  technologies used to operate
                  and improve the Platform.
                </li>
              </ul>

              <h3>
                Information From Third Parties
              </h3>

              <ul>
                <li>
                  Payment processors and financial
                  service providers.
                </li>

                <li>
                  Financial institutions where
                  verification is required.
                </li>

                <li>
                  Mobile network operators and
                  mobile-money providers.
                </li>

                <li>
                  Identity, compliance, and fraud
                  prevention service providers.
                </li>

                <li>
                  Community or group administrators
                  where information is legitimately
                  provided through Platform
                  functionality.
                </li>
              </ul>
            </section>

            {/* ============================================================ */}
            {/* Section 3                                                     */}
            {/* ============================================================ */}

            <section
              id="section-3"
              className="legal-section"
            >
              <h2>
                3. How We Use Your Data
              </h2>

              <p>
                We process personal information only
                for legitimate and appropriate
                purposes, including:
              </p>

              <ul>
                <li>
                  <strong>
                    Account Management:
                  </strong>{' '}
                  Creating and maintaining
                  accounts, authentication,
                  authorization, and identity
                  verification.
                </li>

                <li>
                  <strong>
                    Service Delivery:
                  </strong>{' '}
                  Operating savings groups,
                  processing transactions,
                  maintaining financial records,
                  and providing applicable
                  Platform services.
                </li>

                <li>
                  <strong>
                    Communications:
                  </strong>{' '}
                  Sending transaction
                  confirmations, security
                  alerts, service notifications,
                  and other account-related
                  communications.
                </li>

                <li>
                  <strong>
                    Security and Fraud
                    Prevention:
                  </strong>{' '}
                  Detecting suspicious activity,
                  preventing abuse, protecting
                  accounts, and maintaining
                  Platform integrity.
                </li>

                <li>
                  <strong>
                    Legal and Regulatory
                    Compliance:
                  </strong>{' '}
                  Meeting applicable legal,
                  regulatory, accounting,
                  reporting, and compliance
                  obligations.
                </li>

                <li>
                  <strong>
                    Analytics and Improvement:
                  </strong>{' '}
                  Understanding service usage,
                  diagnosing technical problems,
                  and improving Platform
                  functionality.
                </li>

                <li>
                  <strong>
                    Customer Support:
                  </strong>{' '}
                  Responding to requests,
                  troubleshooting problems,
                  and providing customer
                  assistance.
                </li>

                <li>
                  <strong>
                    Marketing:
                  </strong>{' '}
                  Sending promotional
                  communications where permitted
                  and where any required consent
                  has been obtained.
                </li>
              </ul>
            </section>

            {/* ============================================================ */}
            {/* Section 4                                                     */}
            {/* ============================================================ */}

            <section
              id="section-4"
              className="legal-section"
            >
              <h2>
                4. Data Security
              </h2>

              <p>
                TITech Community Capital applies
                administrative, technical, and
                organizational safeguards designed
                to protect personal information
                against unauthorized access,
                alteration, disclosure, loss, or
                destruction.
              </p>

              <ul>
                <li>
                  <strong>
                    Encryption in Transit:
                  </strong>{' '}
                  Appropriate TLS/HTTPS protections
                  are used for supported network
                  communications.
                </li>

                <li>
                  <strong>
                    Secure Storage:
                  </strong>{' '}
                  Appropriate controls are applied
                  to protect information stored by
                  the Platform and its authorized
                  service providers.
                </li>

                <li>
                  <strong>
                    Access Controls:
                  </strong>{' '}
                  Access to personal information
                  is restricted according to
                  authorization and legitimate
                  business need.
                </li>

                <li>
                  <strong>
                    Authentication and
                    Authorization:
                  </strong>{' '}
                  Security controls are used to
                  protect accounts and restricted
                  Platform functionality.
                </li>

                <li>
                  <strong>
                    Monitoring:
                  </strong>{' '}
                  Security and operational
                  monitoring may be used to
                  identify suspicious or
                  unauthorized activity.
                </li>

                <li>
                  <strong>
                    Incident Response:
                  </strong>{' '}
                  We maintain processes for
                  investigating and responding to
                  security incidents.
                </li>

                <li>
                  <strong>
                    Security Testing:
                  </strong>{' '}
                  Security reviews and testing may
                  be performed as appropriate to
                  identify and address weaknesses.
                </li>
              </ul>

              <p className="highlight">
                <strong>
                  Important:
                </strong>{' '}
                No method of electronic
                transmission or storage is
                completely secure. Although we
                take reasonable and appropriate
                measures to protect personal
                information, we cannot guarantee
                absolute security.
              </p>
            </section>

            {/* ============================================================ */}
            {/* Section 5                                                     */}
            {/* ============================================================ */}

            <section
              id="section-5"
              className="legal-section"
            >
              <h2>
                5. Data Sharing
              </h2>

              <p>
                We do not sell personal information
                for monetary consideration. We may
                disclose information where necessary
                to provide services, protect users,
                comply with law, or operate the
                Platform.
              </p>

              <h3>
                Service Providers
              </h3>

              <p>
                We may share relevant information
                with authorized service providers
                supporting Platform operations,
                including payment processors,
                cloud infrastructure providers,
                communications providers,
                security providers, and technical
                service providers.
              </p>

              <h3>
                Legal and Regulatory Requirements
              </h3>

              <p>
                We may disclose information when
                required or permitted by applicable
                law, regulation, court order, lawful
                governmental request, or regulatory
                obligation.
              </p>

              <h3>
                Community and Group Functionality
              </h3>

              <p>
                Certain limited profile or
                transaction-related information may
                be visible to authorized members,
                administrators, or participants of
                a savings group when reasonably
                necessary for legitimate Platform
                functionality.
              </p>

              <h3>
                Financial and Payment Services
              </h3>

              <p>
                Relevant information may be shared
                with financial institutions, mobile
                money providers, payment processors,
                or other authorized financial-service
                providers when required to process
                or verify a transaction.
              </p>

              <h3>
                Third-Party Protection
              </h3>

              <p>
                Where appropriate, service providers
                processing personal information on
                our behalf are expected to maintain
                confidentiality and appropriate
                security safeguards consistent with
                their contractual and legal
                obligations.
              </p>

              <h3>
                Information We Do Not Intentionally
                Share
              </h3>

              <ul>
                <li>
                  Account passwords in plaintext.
                </li>

                <li>
                  Authentication secrets with
                  unauthorized third parties.
                </li>

                <li>
                  Personal information for unrelated
                  third-party purposes without an
                  appropriate legal basis or
                  authorization.
                </li>
              </ul>
            </section>

            {/* ============================================================ */}
            {/* Section 6                                                     */}
            {/* ============================================================ */}

            <section
              id="section-6"
              className="legal-section"
            >
              <h2>
                6. Your Rights
              </h2>

              <p>
                Subject to applicable law and
                regulatory requirements, you may
                have rights concerning your personal
                information, including:
              </p>

              <h3>
                Right to Access
              </h3>

              <p>
                You may request access to personal
                information that we hold about you.
              </p>

              <h3>
                Right to Rectification
              </h3>

              <p>
                You may request correction of
                inaccurate or incomplete personal
                information.
              </p>

              <h3>
                Right to Erasure
              </h3>

              <p>
                You may request deletion of personal
                information, subject to applicable
                legal, regulatory, contractual,
                accounting, fraud-prevention, and
                legitimate-business retention
                requirements.
              </p>

              <h3>
                Right to Data Portability
              </h3>

              <p>
                Where applicable, you may request
                personal information in a structured
                and commonly used format.
              </p>

              <h3>
                Right to Withdraw Consent
              </h3>

              <p>
                Where processing relies on consent,
                you may withdraw that consent,
                subject to applicable limitations.
              </p>

              <h3>
                Right to Object or Restrict
                Processing
              </h3>

              <p>
                Where applicable, you may object to
                or request restriction of certain
                processing activities.
              </p>

              <p>
                To exercise applicable privacy
                rights, contact us at{' '}
                <a
                  href={`mailto:${PRIVACY_EMAIL}`}
                >
                  {PRIVACY_EMAIL}
                </a>
                . We may need to verify your
                identity before completing certain
                requests.
              </p>
            </section>

            {/* ============================================================ */}
            {/* Section 7                                                     */}
            {/* ============================================================ */}

            <section
              id="section-7"
              className="legal-section"
            >
              <h2>
                7. Cookies & Tracking Technologies
              </h2>

              <p>
                The Platform may use cookies and
                similar technologies to support
                authentication, security,
                preferences, analytics, and service
                functionality.
              </p>

              <h3>
                Essential Technologies
              </h3>

              <p>
                These technologies may be required
                for authentication, security, session
                management, and core Platform
                functionality.
              </p>

              <h3>
                Preference Technologies
              </h3>

              <p>
                These technologies may remember
                settings and preferences to improve
                your experience.
              </p>

              <h3>
                Performance and Analytics
              </h3>

              <p>
                Where implemented, analytics
                technologies may help us understand
                service usage, performance, and
                technical issues.
              </p>

              <h3>
                Marketing Technologies
              </h3>

              <p>
                Where applicable and permitted,
                marketing or advertising technologies
                may be used only in accordance with
                applicable requirements and
                preferences.
              </p>

              <h3>
                Managing Cookies
              </h3>

              <p>
                Most browsers allow you to manage or
                disable cookies through browser
                settings. Disabling essential
                cookies may affect authentication or
                other Platform functionality.
              </p>
            </section>

            {/* ============================================================ */}
            {/* Section 8                                                     */}
            {/* ============================================================ */}

            <section
              id="section-8"
              className="legal-section"
            >
              <h2>
                8. Data Retention
              </h2>

              <p>
                We retain personal information only
                for as long as reasonably necessary
                for the purposes described in this
                policy, unless a longer period is
                required or permitted by applicable
                law.
              </p>

              <h3>
                Examples of Retention Categories
              </h3>

              <ul>
                <li>
                  <strong>
                    Active Account Data:
                  </strong>{' '}
                  Retained while the account and
                  related services remain active.
                </li>

                <li>
                  <strong>
                    Transaction Records:
                  </strong>{' '}
                  May be retained for periods
                  required by financial,
                  accounting, audit, regulatory,
                  or legal obligations.
                </li>

                <li>
                  <strong>
                    Communication Records:
                  </strong>{' '}
                  Retained for as long as reasonably
                  necessary for service, support,
                  security, or legal purposes.
                </li>

                <li>
                  <strong>
                    Marketing Preferences:
                  </strong>{' '}
                  Retained as necessary to honor
                  communication preferences and
                  demonstrate compliance.
                </li>

                <li>
                  <strong>
                    Legal or Regulatory Holds:
                  </strong>{' '}
                  Information may be retained for
                  longer where necessary to comply
                  with legal obligations or resolve
                  disputes.
                </li>
              </ul>

              <p>
                Account deletion does not necessarily
                result in immediate deletion of every
                record. Information may need to be
                retained where required for legal,
                regulatory, accounting, security,
                fraud-prevention, or legitimate
                operational purposes.
              </p>
            </section>

            {/* ============================================================ */}
            {/* Section 9                                                     */}
            {/* ============================================================ */}

            <section
              id="section-9"
              className="legal-section"
            >
              <h2>
                9. Children's Privacy
              </h2>

              <p>
                The Platform is intended for adults
                and is not directed toward children
                under the age of 18.
              </p>

              <p>
                We do not knowingly request or
                intentionally collect personal
                information from children under 18
                through services intended for adult
                users.
              </p>

              <p>
                If you believe that a child has
                provided personal information to us,
                please contact us at{' '}
                <a
                  href={`mailto:${PRIVACY_EMAIL}`}
                >
                  {PRIVACY_EMAIL}
                </a>
                .
              </p>
            </section>

            {/* ============================================================ */}
            {/* Section 10                                                    */}
            {/* ============================================================ */}

            <section
              id="section-10"
              className="legal-section"
            >
              <h2>
                10. Changes to This Privacy Policy
              </h2>

              <p>
                We may update this Privacy Policy
                periodically to reflect changes in
                our services, technology, security
                practices, legal requirements, or
                data-processing activities.
              </p>

              <p>
                When changes are made, we will update
                the effective or last-updated date
                displayed at the beginning of this
                policy.
              </p>

              <p>
                Where a change materially affects
                your rights or obligations and
                applicable law requires additional
                notice, we will provide appropriate
                notice through the Platform or other
                permitted communication channels.
              </p>

              <p>
                We encourage you to periodically
                review this Privacy Policy to remain
                informed about how TITech Community
                Capital handles personal information.
              </p>
            </section>

            {/* ============================================================ */}
            {/* Contact Section                                               */}
            {/* ============================================================ */}

            <section
              id="privacy-contact"
              className="legal-section contact-section"
            >
              <h2>
                Privacy Contact Information
              </h2>

              <p>
                If you have questions, concerns,
                requests, or complaints regarding this
                Privacy Policy or the handling of your
                personal information, please contact
                TITech Community Capital.
              </p>

              <div className="contact-info">
                <p>
                  <strong>
                    <Mail
                      size={16}
                      aria-hidden="true"
                    />
                    Email:
                  </strong>{' '}
                  <a
                    href={`mailto:${PRIVACY_EMAIL}`}
                  >
                    {PRIVACY_EMAIL}
                  </a>
                </p>

                <p>
                  <strong>
                    <Shield
                      size={16}
                      aria-hidden="true"
                    />
                    Data Protection Contact:
                  </strong>{' '}
                  <a
                    href={`mailto:${DPO_EMAIL}`}
                  >
                    {DPO_EMAIL}
                  </a>
                </p>

                <p>
                  <strong>
                    <Phone
                      size={16}
                      aria-hidden="true"
                    />
                    Phone:
                  </strong>{' '}
                  <a
                    href={`tel:${PRIVACY_PHONE_HREF}`}
                  >
                    {PRIVACY_PHONE_DISPLAY}
                  </a>
                </p>

                <p>
                  <strong>
                    Mailing Address:
                  </strong>{' '}
                  {MAILING_ADDRESS}
                </p>
              </div>
            </section>

            {/* ============================================================ */}
            {/* Legal Disclaimer                                              */}
            {/* ============================================================ */}

            <section className="legal-section legal-disclaimer">
              <h2>
                Important Notice
              </h2>

              <p>
                This Privacy Policy describes the
                Platform's intended privacy and data
                protection practices. It does not
                limit any rights or protections
                provided to you under applicable law.
                Where applicable law provides greater
                protection than this policy, the
                applicable legal requirements will
                prevail.
              </p>
            </section>
          </article>

          {/* ================================================================ */}
          {/* Scroll to Top                                                   */}
          {/* ================================================================ */}

          {showScrollTop && (
            <button
              type="button"
              className="scroll-to-top"
              onClick={scrollToTop}
              aria-label="Scroll to top of Privacy Policy"
              title="Scroll to top"
            >
              <ArrowUp
                size={20}
                aria-hidden="true"
              />
            </button>
          )}
        </main>
      </div>

      {/* ================================================================== */}
      {/* Footer Navigation                                                 */}
      {/* ================================================================== */}

      <footer
        className="legal-footer-nav"
        aria-label="Legal navigation"
      >
        <Link
          to="/terms"
          className="legal-link"
        >
          <FileText
            size={16}
            aria-hidden="true"
          />

          <span>
            Terms of Service
          </span>
        </Link>

        <Link
          to="/"
          className="legal-link"
        >
          <Home
            size={16}
            aria-hidden="true"
          />

          <span>
            Back to Home
          </span>
        </Link>

        <span
          className="legal-footer-copyright"
          aria-label={`Copyright ${currentYear} TITech Community Capital`}
        >
          © {currentYear} TITech Community Capital
        </span>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;