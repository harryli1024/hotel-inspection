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

  var activeLabel = '';
  var navHtml = '';
  pages.forEach(function(p) {
    var cls = p.id === activePage ? 'nav-item active' : 'nav-item';
    if (p.id === activePage) activeLabel = p.label;
    navHtml += '<a class="' + cls + '" href="' + p.href + '">' +
      '<span class="nav-icon">' + p.icon + '</span>' + p.label + '</a>';
  });

  // Sidebar
  var sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.innerHTML =
    '<div class="logo">酒店巡检系统</div>' +
    '<nav>' + navHtml + '</nav>' +
    '<div class="user-info">' +
      '<span>' + user.realName + '</span>' +
      '<button onclick="AUTH.logout()">退出</button>' +
    '</div>';

  // Sidebar overlay (for mobile)
  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  overlay.onclick = function() { closeSidebar(); };

  // Mobile top bar
  var topbar = document.createElement('div');
  topbar.className = 'mobile-topbar';
  topbar.id = 'mobileTopbar';
  topbar.innerHTML =
    '<button class="topbar-hamburger" onclick="toggleSidebar()">&#9776;</button>' +
    '<span class="topbar-title">' + activeLabel + '</span>' +
    '<span class="topbar-user">' + user.realName + '</span>';

  document.body.insertBefore(topbar, document.body.firstChild);
  document.body.insertBefore(overlay, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}
