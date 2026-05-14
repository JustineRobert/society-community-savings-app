// src/context/SettingsContext.js

import React, {
  createContext,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSettings } from '../redux/actions/settingsActions';
import { toast } from 'react-toastify';
import { createSelector } from 'reselect';

/**
 * Create Settings Context with default values.
 * This context provides access to app-wide settings.
 */
const SettingsContext = createContext({
  settings: {},
  loading: false,
  error: null,
  dispatch: () => {},
});

/**
 * Memoized selector for Redux store's settings slice.
 */
const selectSettingsState = (state) => state.settings || {};

const selectSettings = createSelector([selectSettingsState], (settings) => ({
  data: settings.data || {},
  loading: settings.loading || false,
  error: settings.error || null,
}));

/**
 * Context provider to supply application settings via React context.
 * Automatically fetches settings from backend if not loaded.
 */
export const SettingsProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { data, loading, error } = useSelector(selectSettings);

  useEffect(() => {
    // Only fetch settings if not already loaded
    if (!data || Object.keys(data).length === 0) {
      const loadSettings = async () => {
        try {
          await dispatch(fetchSettings());
        } catch (err) {
          toast.error('Failed to fetch settings.');
        }
      };
      loadSettings();
    }
  }, [dispatch, data]);

  // Memoize context value to avoid unnecessary re-renders
  const contextValue = useMemo(() => ({
    settings: data,
    loading,
    error,
    dispatch,
  }), [data, loading, error, dispatch]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * Hook to consume settings context.
 * Throws an error if used outside the provider.
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
