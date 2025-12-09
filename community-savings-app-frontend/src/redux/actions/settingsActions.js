// src/redux/actions/settingsActions.js

import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * Generate authentication headers for API requests using stored JWT.
 */
const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  },
});

/**
 * Fetch application settings from the backend.
 * Handles request, success, and failure states via Redux dispatch.
 */
export const fetchSettings = () => async (dispatch) => {
  dispatch({ type: 'FETCH_SETTINGS_REQUEST' });

  try {
    const response = await axios.get('/api/settings', getAuthHeaders());

    dispatch({
      type: 'FETCH_SETTINGS_SUCCESS',
      payload: response.data,
    });
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to fetch settings.';

    dispatch({
      type: 'FETCH_SETTINGS_FAILURE',
      payload: message,
    });
    toast.error(message);
  }
};

/**
 * Update application settings on the backend.
 * Handles request lifecycle and user feedback via toasts.
 */
export const updateSettings = (settings) => async (dispatch) => {
  dispatch({ type: 'UPDATE_SETTINGS_REQUEST' });

  try {
    const response = await axios.put('/api/settings', settings, getAuthHeaders());

    dispatch({
      type: 'UPDATE_SETTINGS_SUCCESS',
      payload: response.data,
    });
    toast.success('Settings updated successfully!');
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to update settings.';

    dispatch({
      type: 'UPDATE_SETTINGS_FAILURE',
      payload: message,
    });
    toast.error(message);
  }
};
