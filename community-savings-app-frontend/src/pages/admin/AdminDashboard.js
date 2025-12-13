// src/pages/admin/AdminDashboard.js

import React from 'react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <p className="mb-6">Welcome, Admin! Use the links below to manage the application.</p>
      <div className="space-y-3">
        <Link
          to="/admin/users"
          className="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Manage Users
        </Link>
        <Link
          to="/admin/sessions"
          className="block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          Manage Sessions
        </Link>
        <Link
          to="/admin/settings"
          className="block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Admin Settings
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
