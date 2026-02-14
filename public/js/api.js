const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('token');
  },

  async request(method, path, body, isFormData) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const options = { method, headers };
    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(this.baseUrl + path, options);

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const isMobile = location.pathname.includes('/mobile') || location.pathname.includes('/admin');
      if (location.pathname.includes('/admin')) {
        location.href = '/admin/index.html';
      } else {
        location.href = '/mobile/index.html';
      }
      throw new Error('登录已过期');
    }

    // Handle file download
    if (res.headers.get('content-type')?.includes('spreadsheet')) {
      return res.blob();
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },
  postForm(path, formData) { return this.request('POST', path, formData, true); },
};
