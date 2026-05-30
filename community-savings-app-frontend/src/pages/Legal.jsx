// src/pages/Legal.jsx
import React from "react";
import "./Legal.css"; // optional: create a CSS file for styling

export default function Legal() {
  return (
    <div className="legal-page">
      <h1>Legal Information</h1>

      <section>
        <h2>Terms of Service</h2>
        <p>
          These are placeholder Terms of Service. Replace this text with your
          actual terms, including user responsibilities, prohibited activities,
          and service limitations.
        </p>
      </section>

      <section>
        <h2>Privacy Policy</h2>
        <p>
          This is a placeholder Privacy Policy. Describe how you collect, use,
          and protect user data. Include details about cookies, third‑party
          services, and user rights.
        </p>
      </section>

      <section>
        <h2>Disclaimer</h2>
        <p>
          This is a placeholder Disclaimer. State limitations of liability,
          warranties, and compliance notes. Make sure to tailor this to your
          jurisdiction and business model.
        </p>
      </section>
    </div>
  );
}
