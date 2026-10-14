// Notifications and Project Activity Drawer Controller
const Notifications = {
  unreadCount: 0,
  notifications: [],

  async fetchNotifications() {
    try {
      const res = await API.getNotifications();
      this.notifications = res.notifications || [];
      this.unreadCount = res.unread_count || 0;
      this.updateBadge();
      this.render();
    } catch (e) {
      console.warn('Could not fetch notifications:', e);
    }
  },

  updateBadge() {
    const badge = document.getElementById('notif-badge-counter');
    if (!badge) return;

    if (this.unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
    } else {
      badge.style.display = 'none';
    }
  },

  handleIncoming(notif) {
    this.notifications.unshift(notif);
    this.unreadCount += 1;
    this.updateBadge();
    this.render();
    Utils.showToast(notif.message, 'info');
  },

  render() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    container.innerHTML = '';
    if (this.notifications.length === 0) {
      container.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 30px;">All caught up! No notifications.</div>';
      return;
    }

    this.notifications.forEach((n) => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.style.padding = '8px 10px';
      item.style.borderRadius = 'var(--radius-md)';
      if (!n.is_read) {
        item.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
        item.style.borderLeft = '3px solid var(--accent-primary)';
      }

      const actor = n.actor || { full_name: 'Team', avatar_color: '#4F46E5' };

      item.innerHTML = `
        <div class="avatar" style="background-color: ${actor.avatar_color || '#4F46E5'}; width: 28px; height: 28px; font-size: 0.7rem;">
          ${Utils.getInitials(actor.full_name)}
        </div>
        <div class="activity-item-content">
          <div>${Utils.escapeHtml(n.message)}</div>
          <div class="activity-time">${Utils.formatRelativeTime(n.created_at)}</div>
        </div>
      `;

      if (n.task_id) {
        item.style.cursor = 'pointer';
        item.onclick = () => {
          TaskModal.open(n.task_id);
          this.closeDrawer();
        };
      }

      container.appendChild(item);
    });
  },

  async markAllRead() {
    try {
      await API.markNotificationsRead();
      this.unreadCount = 0;
      this.notifications.forEach(n => n.is_read = true);
      this.updateBadge();
      this.render();
    } catch (e) {
      Utils.showToast(e.message, 'error');
    }
  },

  toggleDrawer() {
    const drawer = document.getElementById('notifications-drawer');
    const actDrawer = document.getElementById('activity-drawer');
    if (actDrawer) actDrawer.classList.remove('open');

    if (drawer) {
      drawer.classList.toggle('open');
      if (drawer.classList.contains('open')) {
        this.fetchNotifications();
      }
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('notifications-drawer');
    if (drawer) drawer.classList.remove('open');
  }
};

const ActivityStream = {
  async loadActivity(projectId) {
    if (!projectId) return;
    try {
      const activities = await API.getProjectActivity(projectId);
      const container = document.getElementById('activity-list-container');
      if (!container) return;

      container.innerHTML = '';
      if (activities.length === 0) {
        container.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 30px;">No recent activity in this project.</div>';
        return;
      }

      activities.forEach((act) => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        const user = act.user || { full_name: 'Member', avatar_color: '#6366F1' };

        item.innerHTML = `
          <div class="avatar" style="background-color: ${user.avatar_color || '#6366F1'}; width: 28px; height: 28px; font-size: 0.7rem;">
            ${Utils.getInitials(user.full_name)}
          </div>
          <div class="activity-item-content">
            <div><strong>${Utils.escapeHtml(user.full_name)}</strong> ${Utils.escapeHtml(act.description)}</div>
            <div class="activity-time">${Utils.formatRelativeTime(act.created_at)}</div>
          </div>
        `;

        container.appendChild(item);
      });
    } catch (e) {
      console.warn('Could not load activity:', e);
    }
  },

  toggleDrawer() {
    const drawer = document.getElementById('activity-drawer');
    const notifDrawer = document.getElementById('notifications-drawer');
    if (notifDrawer) notifDrawer.classList.remove('open');

    if (drawer) {
      drawer.classList.toggle('open');
      if (drawer.classList.contains('open') && State.currentProject) {
        this.loadActivity(State.currentProject.id);
      }
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('activity-drawer');
    if (drawer) drawer.classList.remove('open');
  }
};

window.Notifications = Notifications;
window.ActivityStream = ActivityStream;
