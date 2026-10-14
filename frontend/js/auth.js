// Authentication and User Session Controller
const Auth = {
  async init() {
    this.bindEvents();
    await this.loadDemoUsers();

    const storedToken = API.getToken();
    if (storedToken) {
      try {
        const user = await API.getMe();
        State.setAuthUser(user);
        this.showMainApp();
      } catch (err) {
        console.warn('Invalid token, showing login');
        this.showAuthScreen();
      }
    } else {
      this.showAuthScreen();
    }
  },

  bindEvents() {
    // Auth Tab Switcher
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        formRegister.style.display = 'block';
        formLogin.style.display = 'none';
      });
    }

    // Login submit
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;

        try {
          const res = await API.login(identifier, password);
          API.setToken(res.access_token);
          State.setAuthUser(res.user);
          Utils.showToast(`Welcome back, ${res.user.full_name}!`, 'success');
          this.showMainApp();
        } catch (err) {
          Utils.showToast(err.message || 'Login failed', 'error');
        }
      });
    }

    // Register submit
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-fullname').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        try {
          const res = await API.register(fullName, username, email, password);
          API.setToken(res.access_token);
          State.setAuthUser(res.user);
          Utils.showToast('Account created successfully!', 'success');
          this.showMainApp();
        } catch (err) {
          Utils.showToast(err.message || 'Registration failed', 'error');
        }
      });
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.logout();
      });
    }

    // User menu toggle
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    if (userMenuBtn && userDropdownMenu) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userDropdownMenu.style.display === 'block';
        userDropdownMenu.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) this.populateQuickSwitcher();
      });

      document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userDropdownMenu.contains(e.target)) {
          userDropdownMenu.style.display = 'none';
        }
      });
    }
  },

  async loadDemoUsers() {
    try {
      const demoUsers = await API.getDemoUsers();
      const container = document.getElementById('demo-users-list');
      if (!container) return;

      container.innerHTML = '';
      demoUsers.forEach((u) => {
        const item = document.createElement('div');
        item.className = 'demo-user-pill';
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="avatar" style="background-color: ${u.avatar_color}; width: 28px; height: 28px; font-size: 0.7rem;">
              ${Utils.getInitials(u.full_name)}
            </div>
            <div>
              <div style="font-size: 0.85rem; font-weight: 600;">${Utils.escapeHtml(u.full_name)}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${Utils.escapeHtml(u.bio || u.email)}</div>
            </div>
          </div>
          <span style="font-size: 0.75rem; color: #818CF8; font-weight: 600;">Sign in &rarr;</span>
        `;

        item.addEventListener('click', async () => {
          try {
            const res = await API.demoLogin(u.id);
            API.setToken(res.access_token);
            State.setAuthUser(res.user);
            Utils.showToast(`Logged in as ${res.user.full_name}`, 'success');
            this.showMainApp();
          } catch (err) {
            Utils.showToast('Failed to switch user', 'error');
          }
        });

        container.appendChild(item);
      });
    } catch (e) {
      console.warn('Could not load demo users:', e);
    }
  },

  async populateQuickSwitcher() {
    const container = document.getElementById('quick-switch-users-container');
    if (!container) return;

    try {
      const demoUsers = await API.getDemoUsers();
      container.innerHTML = '';

      demoUsers.forEach((u) => {
        const isCurrent = State.currentUser && State.currentUser.id === u.id;
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.width = '100%';
        btn.style.justifyContent = 'flex-start';
        btn.style.padding = '6px 10px';
        btn.style.fontSize = '0.8rem';
        if (isCurrent) {
          btn.style.borderColor = 'var(--accent-primary)';
          btn.style.background = 'var(--accent-subtle)';
        }

        btn.innerHTML = `
          <div class="avatar" style="background-color: ${u.avatar_color}; width: 24px; height: 24px; font-size: 0.65rem;">
            ${Utils.getInitials(u.full_name)}
          </div>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${Utils.escapeHtml(u.full_name)} ${isCurrent ? '(You)' : ''}
          </span>
        `;

        if (!isCurrent) {
          btn.addEventListener('click', async () => {
            const res = await API.demoLogin(u.id);
            API.setToken(res.access_token);
            State.setAuthUser(res.user);
            document.getElementById('user-dropdown-menu').style.display = 'none';
            Utils.showToast(`Switched active user to ${res.user.full_name}`, 'success');
            this.showMainApp();
          });
        }

        container.appendChild(btn);
      });
    } catch (e) {
      console.error(e);
    }
  },

  showAuthScreen() {
    WS.disconnectAll();
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
  },

  showMainApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';

    // Update user avatar in header
    const user = State.currentUser;
    if (user) {
      const avatarEl = document.getElementById('current-user-avatar');
      const nameEl = document.getElementById('current-user-name');
      const roleEl = document.getElementById('current-user-role');
      const commentAvatarEl = document.getElementById('comment-input-avatar');

      if (avatarEl) {
        avatarEl.textContent = Utils.getInitials(user.full_name);
        avatarEl.style.backgroundColor = user.avatar_color || '#4F46E5';
      }
      if (nameEl) nameEl.textContent = user.full_name;
      if (roleEl) roleEl.textContent = user.bio || `@${user.username}`;
      if (commentAvatarEl) {
        commentAvatarEl.textContent = Utils.getInitials(user.full_name);
        commentAvatarEl.style.backgroundColor = user.avatar_color || '#4F46E5';
      }
    }

    // Connect user notifications WebSocket
    WS.connectNotifications();
    Notifications.fetchNotifications();

    // Load projects & board
    App.bootstrapWorkspace();
  },

  logout() {
    API.clearToken();
    State.setAuthUser(null);
    WS.disconnectAll();
    this.showAuthScreen();
    Utils.showToast('Logged out successfully', 'info');
  }
};

window.Auth = Auth;
