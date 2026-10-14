// API Helper Module
const API = {
  baseUrl: '',

  getToken() {
    return localStorage.getItem('syncflow_token');
  },

  setToken(token) {
    localStorage.setItem('syncflow_token', token);
  },

  clearToken() {
    localStorage.removeItem('syncflow_token');
    localStorage.removeItem('syncflow_user');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.clearToken();
        if (window.State && window.State.onAuthExpired) {
          window.State.onAuthExpired();
        }
        throw new Error('Session expired or unauthorized');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Request failed');
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth
  async login(username_or_email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username_or_email, password })
    });
  },

  async register(fullName, username, email, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        username,
        email,
        password
      })
    });
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async getDemoUsers() {
    return this.request('/api/auth/demo-users');
  },

  async demoLogin(userId) {
    return this.request(`/api/auth/demo-login/${userId}`, {
      method: 'POST'
    });
  },

  // Projects
  async getProjects() {
    return this.request('/api/projects');
  },

  async getProject(projectId) {
    return this.request(`/api/projects/${projectId}`);
  },

  async createProject(name, description, color, icon) {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description, color, icon })
    });
  },

  async addProjectMember(projectId, username_or_email, role) {
    return this.request(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username_or_email, role })
    });
  },

  async getProjectActivity(projectId) {
    return this.request(`/api/projects/${projectId}/activity`);
  },

  // Columns
  async createColumn(projectId, name, color) {
    return this.request(`/api/projects/${projectId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name, color })
    });
  },

  async deleteColumn(columnId) {
    return this.request(`/api/columns/${columnId}`, {
      method: 'DELETE'
    });
  },

  // Tasks
  async createTask(projectId, taskData) {
    return this.request(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async getTask(taskId) {
    return this.request(`/api/tasks/${taskId}`);
  },

  async updateTask(taskId, updateData) {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  async moveTask(taskId, columnId, targetOrder) {
    return this.request(`/api/tasks/${taskId}/move`, {
      method: 'POST',
      body: JSON.stringify({ column_id: columnId, target_order: targetOrder })
    });
  },

  async deleteTask(taskId) {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
  },

  // Checklists
  async addChecklistItem(taskId, title) {
    return this.request(`/api/tasks/${taskId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  },

  async updateChecklistItem(itemId, isCompleted, title) {
    return this.request(`/api/checklists/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_completed: isCompleted, title })
    });
  },

  async deleteChecklistItem(itemId) {
    return this.request(`/api/checklists/${itemId}`, {
      method: 'DELETE'
    });
  },

  // Labels
  async addLabel(taskId, name, color) {
    return this.request(`/api/tasks/${taskId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color })
    });
  },

  async deleteLabel(labelId) {
    return this.request(`/api/labels/${labelId}`, {
      method: 'DELETE'
    });
  },

  // Comments
  async getComments(taskId) {
    return this.request(`/api/tasks/${taskId}/comments`);
  },

  async addComment(taskId, content) {
    return this.request(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async deleteComment(commentId) {
    return this.request(`/api/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  // Notifications
  async getNotifications() {
    return this.request('/api/notifications');
  },

  async markNotificationsRead(notificationIds = null) {
    return this.request('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notification_ids: notificationIds })
    });
  }
};

window.API = API;
