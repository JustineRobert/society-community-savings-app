// services/api.js

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  // Attach token header automatically when available
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = Object.assign({}, options.headers || {});
  if (token && !headers['x-auth-token'] && !headers['Authorization']) {
    headers['x-auth-token'] = token;
  }

  // prevent browser conditional GETs returning 304 by disabling cache for API calls
  const opts = Object.assign({}, options, { headers, credentials: options.credentials || 'include', cache: 'no-store' });

    // perform fetch, with optional retry on 304
    let res = await fetch(url, opts);
    // If we get a 304/204, try one forced-retry to get a fresh response
    if ((res.status === 204 || res.status === 304) && !options._retried) {
      try {
        const forcedHeaders = Object.assign({}, headers, { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' });
        const forcedOpts = Object.assign({}, opts, { headers: forcedHeaders, _retried: true });
        res = await fetch(url, forcedOpts);
      } catch (e) {
        // ignore and fall through to original response handling
      }
  }

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.message || errMsg;
    } catch (e) {
      // ignore JSON parse errors
    }
    const error = new Error(errMsg);
    error.status = res.status;
    // If unauthorized, redirect to login page to re-authenticate
    if (res.status === 401 && typeof window !== 'undefined') {
      try {
        // clear token to avoid redirect loops
        localStorage.removeItem('token');
      } catch (e) {}
      window.location.href = '/login';
    }
    throw error;
  }
  // try to parse json, otherwise return text
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const login = async (credentials) =>
  request('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

// Default export: small API helper with common methods
const api = {
  get: (path, opts = {}) =>
    request(path, { method: 'GET', credentials: 'include', ...opts }),
  post: (path, body, opts = {}) =>
    request(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(body),
      ...opts,
    }),
  put: (path, body, opts = {}) =>
    request(path, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(body),
      ...opts,
    }),
  delete: (path, opts = {}) => request(path, { method: 'DELETE', credentials: 'include', ...opts }),
};

export default api;
