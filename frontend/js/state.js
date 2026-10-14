// State Management & Global Utilities
const State = {
  currentUser: null,
  projects: [],
  currentProject: null,
  activeView: 'board', // 'board' or 'list'
  searchQuery: '',
  filterPriority: '',
  filterAssignee: '',
  activeTaskDetail: null,

  setAuthUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('syncflow_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('syncflow_user');
    }
  },

  getStoredUser() {
    const data = localStorage.getItem('syncflow_user');
    return data ? JSON.parse(data) : null;
  },

  onAuthExpired() {
    this.currentUser = null;
    this.currentProject = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
  }
};

// Utilities
const Utils = {
  getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now - date) / 1000);

      if (diffSecs < 60) return 'just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'warning') icon = 'alert-triangle';
    if (type === 'error') icon = 'alert-circle';

    toast.innerHTML = `
      <i data-feather="${icon}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
      <div style="flex: 1;">${Utils.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);
    if (window.feather) feather.replace();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

window.State = State;
window.Utils = Utils;
