// services/api.js

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, options);
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
