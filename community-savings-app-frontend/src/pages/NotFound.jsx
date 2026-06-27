// ============================================================================
// TITech Community Capital – Not Found Page
// File: frontend/src/pages/NotFound.jsx
// Production-grade
// ============================================================================

import React from 'react';
import { Link } from 'react-router-dom';

/**
 * NotFound
 *
 * - Displays a user-friendly 404 error page
 * - Provides clear navigation back to a safe route
 * - Accessible markup with semantic structure
 */
export default function NotFound() {
  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6"
      aria-labelledby="notfound-heading"
    >
      <section
        className="text-center max-w-lg bg-white shadow-md rounded p-8"
        role="alert"
      >
        <h1
          id="notfound-heading"
          className="text-4xl font-bold text-red-600 mb-4"
        >
          404 – Page Not Found
        </h1>
        <p className="text-gray-700 mb-6">
          Sorry, the page you’re looking for doesn’t exist or may have been
          moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
        >
          Go to Dashboard
        </Link>
      </section>
    </main>
  );
}
