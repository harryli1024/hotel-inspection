const Utils = {
  formatDateTime(date) {
    if (typeof date === 'string') date = new Date(date);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  },

  formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  },

  getToday() {
    return this.formatDate(new Date());
  },

  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  showToast(message, type) {
    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  },

  showLoading(message) {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text"></div>';
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = message || '加载中...';
    overlay.style.display = 'flex';
  },

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  statusText(status) {
    const map = { pending: '待检查', completed: '已完成', overdue: '超时未检查' };
    return map[status] || status;
  },

  statusClass(status) {
    const map = { pending: 'status-pending', completed: 'status-completed', overdue: 'status-overdue' };
    return map[status] || '';
  },

  getQueryParam(name) {
    const params = new URLSearchParams(location.search);
    return params.get(name);
  },

  // Button loading state with 10s timeout auto-recovery
  btnLoading(btn, text) {
    if (btn._loading) return false;
    btn._loading = true;
    btn._originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span>' + (text || '处理中...');
    btn._timeout = setTimeout(function() {
      Utils.btnReset(btn);
      Utils.showToast('请求超时，请重试', 'error');
    }, 10000);
    return true;
  },

  btnReset(btn) {
    if (btn._timeout) { clearTimeout(btn._timeout); btn._timeout = null; }
    btn.disabled = false;
    btn.innerHTML = btn._originalHtml || '';
    btn._loading = false;
  },
};
