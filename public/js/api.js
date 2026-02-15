const API = {
  baseUrl: '/api',
  defaultTimeout: 15000,

  getToken() {
    return localStorage.getItem('token');
  },

  async request(method, path, body, isFormData) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, API.defaultTimeout);

    const options = { method, headers, signal: controller.signal };
    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    var res;
    try {
      res = await fetch(this.baseUrl + path, options);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('请求超时，请检查网络后重试');
      throw new Error('网络错误，请检查网络连接');
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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

  postFormProgress(path, formData, onProgress) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API.baseUrl + path);
      xhr.timeout = 120000; // 2 min for file uploads
      var token = API.getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round(e.loaded / e.total * 100));
        }
      };

      xhr.onload = function() {
        if (xhr.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          location.href = location.pathname.includes('/admin') ? '/admin/index.html' : '/mobile/index.html';
          reject(new Error('登录已过期'));
          return;
        }
        try {
          var data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || '请求失败'));
        } catch (e) {
          reject(new Error('请求失败'));
        }
      };

      xhr.onerror = function() { reject(new Error('网络错误，请检查网络连接')); };
      xhr.ontimeout = function() { reject(new Error('上传超时，请检查网络后重试')); };
      xhr.send(formData);
    });
  },
};
