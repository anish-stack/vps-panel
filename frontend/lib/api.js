import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.includes('/login') && !path.includes('/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Servers
export const serversApi = {
  list: () => api.get('/servers'),
  create: (data) => api.post('/servers', data),
  get: (id) => api.get(`/servers/${id}`),
  update: (id, data) => api.patch(`/servers/${id}`, data),
  delete: (id) => api.delete(`/servers/${id}`),
  ping: (id) => api.post(`/servers/${id}/ping`),
  regenerateKey: (id) => api.post(`/servers/${id}/regenerate-key`),
  getStatus: (id) => api.get(`/servers/${id}/status`),
  getApps: (id) => api.get(`/servers/${id}/apps`),
  restartApp: (id, appName) => api.post(`/servers/${id}/apps/restart`, { appName }),
  stopApp: (id, appName) => api.post(`/servers/${id}/apps/stop`, { appName }),
  triggerBackup: (id, database) => api.post(`/servers/${id}/backup`, { database }),
  listBackups: (id) => api.get(`/servers/${id}/backups`),
  downloadBackupUrl: (id, filename) => `${API_URL}/servers/${id}/backups/${encodeURIComponent(filename)}/download`,
};

export default api;
