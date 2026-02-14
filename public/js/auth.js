const AUTH = {
  async login(username, password) {
    const data = await API.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/';
  },

  getUser() {
    const str = localStorage.getItem('user');
    if (!str) return null;
    try { return JSON.parse(str); }
    catch { return null; }
  },

  isLoggedIn() {
    return !!localStorage.getItem('token');
  },

  requireAuth(allowedRoles) {
    if (!this.isLoggedIn()) {
      location.href = '/';
      return false;
    }
    if (allowedRoles) {
      const user = this.getUser();
      if (!user || !allowedRoles.includes(user.role)) {
        alert('权限不足');
        this.logout();
        return false;
      }
    }
    return true;
  },
};
