// Main Application Orchestrator
const App = {
  async init() {
    this.bindGlobalEvents();
    await Auth.init();
  },

  async bootstrapWorkspace() {
    try {
      const projects = await API.getProjects();
      State.projects = projects;
      this.renderSidebarProjects();

      if (projects.length > 0) {
        // Select first project by default if none selected
        const defaultProj = projects[0];
        await Board.loadProject(defaultProj.id);
      } else {
        Utils.showToast('Create your first project to get started!', 'info');
      }
    } catch (err) {
      console.error('Failed to bootstrap workspace:', err);
    }
  },

  renderSidebarProjects() {
    const list = document.getElementById('sidebar-projects-list');
    if (!list) return;

    list.innerHTML = '';
    State.projects.forEach((p) => {
      const item = document.createElement('div');
      item.className = `project-item ${State.currentProject && State.currentProject.id === p.id ? 'active' : ''}`;

      item.innerHTML = `
        <div class="project-item-left">
          <div class="project-color-dot" style="background-color: ${p.color || '#6366F1'};"></div>
          <span>${Utils.escapeHtml(p.name)}</span>
        </div>
        <span class="project-count-badge">${p.task_count || 0}</span>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        Board.loadProject(p.id);
      });

      list.appendChild(item);
    });
  },

  bindGlobalEvents() {
    // View Tabs (Board vs List)
    const tabBoard = document.getElementById('tab-board');
    const tabList = document.getElementById('tab-list');

    if (tabBoard && tabList) {
      tabBoard.addEventListener('click', () => {
        tabBoard.classList.add('active');
        tabList.classList.remove('active');
        State.activeView = 'board';
        Board.render();
      });

      tabList.addEventListener('click', () => {
        tabList.classList.add('active');
        tabBoard.classList.remove('active');
        State.activeView = 'list';
        Board.render();
      });
    }

    // Search Box
    const searchInput = document.getElementById('board-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        State.searchQuery = e.target.value.trim();
        Board.render();
      });
    }

    // Filters
    const filterPriority = document.getElementById('filter-priority');
    if (filterPriority) {
      filterPriority.addEventListener('change', (e) => {
        State.filterPriority = e.target.value;
        Board.render();
      });
    }

    const filterAssignee = document.getElementById('filter-assignee');
    if (filterAssignee) {
      filterAssignee.addEventListener('change', (e) => {
        State.filterAssignee = e.target.value;
        Board.render();
      });
    }

    const clearFiltersBtn = document.getElementById('btn-clear-filters');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        if (filterPriority) filterPriority.value = '';
        if (filterAssignee) filterAssignee.value = '';
        if (searchInput) searchInput.value = '';
        State.filterPriority = '';
        State.filterAssignee = '';
        State.searchQuery = '';
        Board.render();
      });
    }

    // Toggle Activity Drawer
    const btnActivity = document.getElementById('btn-toggle-activity');
    const btnCloseActivity = document.getElementById('btn-close-activity');
    if (btnActivity) btnActivity.addEventListener('click', () => ActivityStream.toggleDrawer());
    if (btnCloseActivity) btnCloseActivity.addEventListener('click', () => ActivityStream.closeDrawer());

    // Toggle Notifications Drawer
    const btnNotifs = document.getElementById('btn-toggle-notifications');
    const btnCloseNotifs = document.getElementById('btn-close-notifications');
    const btnMarkAllRead = document.getElementById('btn-mark-all-read');
    if (btnNotifs) btnNotifs.addEventListener('click', () => Notifications.toggleDrawer());
    if (btnCloseNotifs) btnCloseNotifs.addEventListener('click', () => Notifications.closeDrawer());
    if (btnMarkAllRead) btnMarkAllRead.addEventListener('click', () => Notifications.markAllRead());

    // Header buttons
    const btnNewTask = document.getElementById('btn-new-task-header');
    if (btnNewTask) {
      btnNewTask.addEventListener('click', () => {
        const defaultColId = State.currentProject?.columns?.[0]?.id;
        this.openCreateTaskModal(defaultColId);
      });
    }

    const btnAddCol = document.getElementById('btn-add-column-header');
    if (btnAddCol) {
      btnAddCol.addEventListener('click', () => this.openModal('modal-add-column'));
    }

    const btnNewProject = document.getElementById('btn-new-project');
    if (btnNewProject) {
      btnNewProject.addEventListener('click', () => this.openModal('modal-create-project'));
    }

    const btnInvite = document.getElementById('btn-invite-member');
    if (btnInvite) {
      btnInvite.addEventListener('click', () => this.openModal('modal-invite-member'));
    }

    // Modal Close Buttons
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
          if (backdrop.id === 'modal-task-detail') TaskModal.close();
        }
      });
    });

    const closeTaskModalBtn = document.getElementById('btn-close-task-modal');
    if (closeTaskModalBtn) closeTaskModalBtn.addEventListener('click', () => TaskModal.close());

    this.bindModalForms();
  },

  bindModalForms() {
    // 1. Create Task Form
    const formCreateTask = document.getElementById('form-create-task');
    const btnCancelCreateTask = document.getElementById('btn-cancel-create-task');
    const btnCloseCreateTask = document.getElementById('btn-close-create-task');

    if (btnCancelCreateTask) btnCancelCreateTask.addEventListener('click', () => this.closeModal('modal-create-task'));
    if (btnCloseCreateTask) btnCloseCreateTask.addEventListener('click', () => this.closeModal('modal-create-task'));

    if (formCreateTask) {
      formCreateTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!State.currentProject) return;

        const title = document.getElementById('create-task-title').value.trim();
        const description = document.getElementById('create-task-desc').value.trim();
        const columnId = parseInt(document.getElementById('create-task-column').value);
        const priority = document.getElementById('create-task-priority').value;
        const dueDateVal = document.getElementById('create-task-duedate').value;
        const assigneeVal = document.getElementById('create-task-assignee').value;

        const assignee_ids = assigneeVal ? [parseInt(assigneeVal)] : [];
        const due_date = dueDateVal ? new Date(dueDateVal).toISOString() : null;

        try {
          await API.createTask(State.currentProject.id, {
            title,
            description,
            column_id: columnId,
            priority,
            due_date,
            assignee_ids
          });

          this.closeModal('modal-create-task');
          formCreateTask.reset();
          Utils.showToast(`Task "${title}" created`, 'success');
        } catch (err) {
          Utils.showToast(err.message, 'error');
        }
      });
    }

    // 2. Create Project Form
    const formCreateProj = document.getElementById('form-create-project');
    const btnCancelCreateProj = document.getElementById('btn-cancel-create-project');
    const btnCloseCreateProj = document.getElementById('btn-close-create-project');

    if (btnCancelCreateProj) btnCancelCreateProj.addEventListener('click', () => this.closeModal('modal-create-project'));
    if (btnCloseCreateProj) btnCloseCreateProj.addEventListener('click', () => this.closeModal('modal-create-project'));

    if (formCreateProj) {
      formCreateProj.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('create-project-name').value.trim();
        const description = document.getElementById('create-project-desc').value.trim();
        const colorRadio = document.querySelector('input[name="project-color"]:checked');
        const color = colorRadio ? colorRadio.value : '#6366F1';

        try {
          const newProj = await API.createProject(name, description, color, 'briefcase');
          this.closeModal('modal-create-project');
          formCreateProj.reset();

          // Refresh projects list and load the new one
          const projects = await API.getProjects();
          State.projects = projects;
          this.renderSidebarProjects();
          await Board.loadProject(newProj.id);
          Utils.showToast(`Project "${name}" created!`, 'success');
        } catch (err) {
          Utils.showToast(err.message, 'error');
        }
      });
    }

    // 3. Invite Member Form
    const formInvite = document.getElementById('form-invite-member');
    const btnCancelInvite = document.getElementById('btn-cancel-invite-member');
    const btnCloseInvite = document.getElementById('btn-close-invite-member');

    if (btnCancelInvite) btnCancelInvite.addEventListener('click', () => this.closeModal('modal-invite-member'));
    if (btnCloseInvite) btnCloseInvite.addEventListener('click', () => this.closeModal('modal-invite-member'));

    if (formInvite) {
      formInvite.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!State.currentProject) return;

        const identifier = document.getElementById('invite-member-identifier').value.trim();
        const role = document.getElementById('invite-member-role').value;

        try {
          await API.addProjectMember(State.currentProject.id, identifier, role);
          this.closeModal('modal-invite-member');
          formInvite.reset();
          Utils.showToast(`Added ${identifier} to project`, 'success');
          // Refresh project members
          Board.loadProject(State.currentProject.id, false);
        } catch (err) {
          Utils.showToast(err.message, 'error');
        }
      });
    }

    // 4. Add Column Form
    const formAddCol = document.getElementById('form-add-column');
    const btnCancelAddCol = document.getElementById('btn-cancel-add-column');
    const btnCloseAddCol = document.getElementById('btn-close-add-column');

    if (btnCancelAddCol) btnCancelAddCol.addEventListener('click', () => this.closeModal('modal-add-column'));
    if (btnCloseAddCol) btnCloseAddCol.addEventListener('click', () => this.closeModal('modal-add-column'));

    if (formAddCol) {
      formAddCol.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!State.currentProject) return;

        const name = document.getElementById('add-column-name').value.trim();
        const color = document.getElementById('add-column-color').value;

        try {
          await API.createColumn(State.currentProject.id, name, color);
          this.closeModal('modal-add-column');
          formAddCol.reset();
          Utils.showToast(`Column "${name}" added`, 'success');
        } catch (err) {
          Utils.showToast(err.message, 'error');
        }
      });
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  },

  openCreateTaskModal(targetColId = null) {
    if (!State.currentProject) return;

    // Populate columns in select
    const colSelect = document.getElementById('create-task-column');
    if (colSelect) {
      colSelect.innerHTML = '';
      (State.currentProject.columns || []).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        if (targetColId && c.id === targetColId) opt.selected = true;
        colSelect.appendChild(opt);
      });
    }

    // Populate assignees in select
    const assignSelect = document.getElementById('create-task-assignee');
    if (assignSelect) {
      assignSelect.innerHTML = '<option value="">Unassigned</option>';
      (State.currentProject.members || []).forEach((m) => {
        if (m.user) {
          const opt = document.createElement('option');
          opt.value = m.user.id;
          opt.textContent = m.user.full_name;
          assignSelect.appendChild(opt);
        }
      });
    }

    this.openModal('modal-create-task');
  }
};

window.App = App;

// Start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
