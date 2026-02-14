function initAdminLayout(activePage) {
  if (!AUTH.requireAuth(['admin', 'super_admin'])) return;
  var user = AUTH.getUser();

  var pages = [
    { id: 'dashboard', label: '数据概览', icon: '&#128202;', href: '/admin/dashboard.html' },
    { id: 'records', label: '巡检记录', icon: '&#128203;', href: '/admin/records.html' },
    { id: 'tasks', label: '任务管理', icon: '&#9745;', href: '/admin/tasks.html' },
    { id: 'employees', label: '员工管理', icon: '&#128101;', href: '/admin/employees.html' },
    { id: 'areas', label: '区域管理', icon: '&#127970;', href: '/admin/areas.html' },
    { id: 'schedules', label: '排班管理', icon: '&#9200;', href: '/admin/schedules.html' },
  ];

  var navHtml = '';
  pages.forEach(function(p) {
    var cls = p.id === activePage ? 'nav-item active' : 'nav-item';
    navHtml += '<a class="' + cls + '" href="' + p.href + '">' +
      '<span class="nav-icon">' + p.icon + '</span>' + p.label + '</a>';
  });

  var sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML =
    '<div class="logo">酒店巡检系统</div>' +
    '<nav>' + navHtml + '</nav>' +
    '<div class="user-info">' +
      '<span>' + user.realName + '</span>' +
      '<button onclick="AUTH.logout()">退出</button>' +
    '</div>';

  document.body.insertBefore(sidebar, document.body.firstChild);
}
