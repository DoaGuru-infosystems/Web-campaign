const BASE_URL = 'http://127.0.0.1:5001/api';

const api = {
  BACKEND_URL: 'http://127.0.0.1:5001',
  getToken: () => localStorage.getItem('token'),
  setToken: (token) => localStorage.setItem('token', token),
  clearToken: () => localStorage.removeItem('token'),

  request: async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    
    // Set headers
    const headers = options.headers || {};
    const token = api.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (response.status === 401) {
        api.clearToken();
        localStorage.removeItem('user');
        const path = window.location.pathname;
        if (!path.startsWith('/campaign/') && path !== '/track' && path !== '/login') {
          window.location.href = '/login';
        }
        throw new Error(data.error || 'Session expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Something went wrong');
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err.message);
      throw err;
    }
  },

  get: (endpoint, options = {}) => {
    return api.request(endpoint, { ...options, method: 'GET' });
  },

  post: (endpoint, body, options = {}) => {
    return api.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put: (endpoint, body, options = {}) => {
    return api.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch: (endpoint, body, options = {}) => {
    return api.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete: (endpoint, options = {}) => {
    return api.request(endpoint, { ...options, method: 'DELETE' });
  },

  upload: async (file, onProgress) => {
    const url = `${BASE_URL}/upload`;
    const formData = new FormData();
    formData.append('file', file);

    const token = api.getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Since standard fetch doesn't support easy progress reporting out of the box,
    // we use XMLHttpRequest to support file upload progress (very premium UX feature!)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      // Add auth header
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error || 'Upload failed'));
          } catch (e) {
            reject(new Error('Upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  }
};

export default api;
