// Real-Time WebSocket Client
const WS = {
  projectSocket: null,
  notifSocket: null,
  reconnectInterval: 3000,
  pingInterval: null,

  connectProject(projectId) {
    if (this.projectSocket) {
      this.projectSocket.close();
      this.projectSocket = null;
    }

    const token = API.getToken();
    if (!token || !projectId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/project/${projectId}?token=${encodeURIComponent(token)}`;

    try {
      this.projectSocket = new WebSocket(wsUrl);

      this.projectSocket.onopen = () => {
        this.updateStatus(true);
        this.startHeartbeat(this.projectSocket);
      };

      this.projectSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleProjectEvent(msg);
        } catch (err) {
          console.error('WS JSON parse error:', err);
        }
      };

      this.projectSocket.onclose = () => {
        this.updateStatus(false);
      };

      this.projectSocket.onerror = (err) => {
        console.warn('Project WS error:', err);
      };
    } catch (e) {
      console.error('Failed to open project WebSocket:', e);
    }
  },

  connectNotifications() {
    if (this.notifSocket) {
      this.notifSocket.close();
      this.notifSocket = null;
    }

    const token = API.getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications?token=${encodeURIComponent(token)}`;

    try {
      this.notifSocket = new WebSocket(wsUrl);

      this.notifSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'new_notification') {
            Notifications.handleIncoming(msg.data);
          }
        } catch (err) {
          console.error('Notif WS parse error:', err);
        }
      };

      this.notifSocket.onclose = () => {
        // Will reconnect on user action or interval
      };
    } catch (e) {
      console.error('Failed to connect notif WS:', e);
    }
  },

  startHeartbeat(socket) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  },

  updateStatus(connected) {
    const dot = document.getElementById('ws-status-dot');
    const text = document.getElementById('ws-status-text');
    const badge = document.getElementById('ws-status-badge');

    if (dot && text && badge) {
      if (connected) {
        dot.style.backgroundColor = 'var(--color-success)';
        text.textContent = 'Live Sync';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        badge.style.color = 'var(--color-success)';
      } else {
        dot.style.backgroundColor = 'var(--color-warning)';
        text.textContent = 'Connecting...';
        badge.style.borderColor = 'rgba(245, 158, 11, 0.25)';
        badge.style.color = 'var(--color-warning)';
      }
    }
  },

  handleProjectEvent(msg) {
    const { type, data } = msg;

    switch (type) {
      case 'task_created':
        Board.onTaskCreated(data);
        Utils.showToast(`New task added: "${data.title}"`, 'info');
        break;

      case 'task_moved':
        Board.onTaskMoved(data);
        break;

      case 'task_updated':
        Board.onTaskUpdated(data);
        if (State.activeTaskDetail && State.activeTaskDetail.id === data.id) {
          TaskModal.onExternalTaskUpdate(data);
        }
        break;

      case 'task_deleted':
        Board.onTaskDeleted(data.task_id);
        if (State.activeTaskDetail && State.activeTaskDetail.id === data.task_id) {
          TaskModal.close();
          Utils.showToast('Task was deleted by another collaborator', 'warning');
        }
        break;

      case 'comment_added':
        if (State.activeTaskDetail && State.activeTaskDetail.id === data.task_id) {
          TaskModal.onCommentAdded(data.comment);
        }
        Utils.showToast(`New comment by ${data.comment.author?.full_name || 'team member'}`, 'info');
        Board.incrementTaskCommentCount(data.task_id);
        break;

      case 'comment_deleted':
        if (State.activeTaskDetail && State.activeTaskDetail.id === data.task_id) {
          TaskModal.onCommentDeleted(data.comment_id);
        }
        break;

      case 'checklist_item_added':
      case 'checklist_item_updated':
      case 'checklist_item_deleted':
        if (State.activeTaskDetail && State.activeTaskDetail.id === data.task_id) {
          TaskModal.refreshChecklists(data);
        }
        Board.refreshChecklistStats(data.task_id);
        break;

      case 'column_created':
      case 'column_updated':
      case 'column_deleted':
      case 'member_added':
      case 'member_removed':
        // Reload full project state
        if (State.currentProject) {
          Board.loadProject(State.currentProject.id, false);
        }
        break;

      default:
        break;
    }
  },

  disconnectAll() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.projectSocket) this.projectSocket.close();
    if (this.notifSocket) this.notifSocket.close();
    this.projectSocket = null;
    this.notifSocket = null;
    this.updateStatus(false);
  }
};

window.WS = WS;
