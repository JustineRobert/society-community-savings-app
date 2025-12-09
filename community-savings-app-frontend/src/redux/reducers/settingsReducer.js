// src/redux/reducers/settingsReducer.js

const initialState = {
  data: {
    siteName: '',
    enableContributions: false,
    defaultUserRole: 'user',
  },
  loading: false,
  error: null,
};

export const settingsReducer = (state = initialState, action) => {
  switch (action.type) {
    // Fetch settings
    case 'FETCH_SETTINGS_REQUEST':
      return { ...state, loading: true, error: null };

    case 'FETCH_SETTINGS_SUCCESS':
      return {
        ...state,
        loading: false,
        data: {
          ...state.data,
          ...action.payload,
        },
        error: null,
      };

    case 'FETCH_SETTINGS_FAILURE':
      return { ...state, loading: false, error: action.payload };

    // Update settings
    case 'UPDATE_SETTINGS_REQUEST':
      return { ...state, loading: true, error: null };

    case 'UPDATE_SETTINGS_SUCCESS':
      return {
        ...state,
        loading: false,
        data: {
          ...state.data,
          ...action.payload,
        },
        error: null,
      };

    case 'UPDATE_SETTINGS_FAILURE':
      return { ...state, loading: false, error: action.payload };

    // Optional manual override
    case 'SET_SETTINGS':
      return {
        ...state,
        data: {
          ...state.data,
          ...action.payload,
        },
      };

    default:
      return state;
  }
};
