// src/pages/admin/AdminSettings.js
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSettings } from '../../redux/actions/settingsActions';
import { toast } from 'react-toastify';

const AdminSettings = () => {
  const dispatch = useDispatch();
  const { data: settings, loading, error } = useSelector((state) => state.settings);

  const [localSettings, setLocalSettings] = useState({
    siteName: '',
    enableContributions: false,
    defaultUserRole: 'user',
  });

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateSettings(localSettings));
      toast.success('Settings updated successfully!');
    } catch (err) {
      toast.error('Failed to update settings.');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>

      {loading && <p className="text-blue-500">Saving settings...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow-md rounded p-6">
        <div>
          <label htmlFor="siteName" className="block mb-1 font-medium">
            Site Name
          </label>
          <input
            type="text"
            id="siteName"
            name="siteName"
            value={localSettings.siteName}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="enableContributions"
            name="enableContributions"
            checked={localSettings.enableContributions}
            onChange={handleChange}
            className="mr-2"
          />
          <label htmlFor="enableContributions" className="text-sm font-medium">
            Enable Group Contributions
          </label>
        </div>

        <div>
          <label htmlFor="defaultUserRole" className="block mb-1 font-medium">
            Default User Role
          </label>
          <select
            id="defaultUserRole"
            name="defaultUserRole"
            value={localSettings.defaultUserRole}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading ? 'bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

export default AdminSettings;
