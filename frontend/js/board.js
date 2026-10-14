// Board, Kanban Columns, Cards, and List View Controller
const Board = {
  draggedTaskId: null,
  sourceColumnId: null,

  async loadProject(projectId, connectWs = true) {
    try {
      const project = await API.getProject(projectId);
      State.currentProject = project;

      // Update header info
      document.getElementById('header-project-name').textContent = project.name;
      document.getElementById('header-project-dot').style.backgroundColor = project.color || '#6366F1';
      document.getElementById('board-header-title').textContent = project.name;
      document.getElementById('board-project-description').textContent = project.description || '';

      // Update sidebar projects & members
      this.renderSidebarMembers(project.members || []);
      this.populateFilterAssignees(project.members || []);

      // Connect project WebSocket
      if (connectWs) {
        WS.connectProject(projectId);
      }

      // Render Active View
      this.render();
      this.updateProjectMetrics();
    } catch (err) {
      Utils.showToast('Failed to load project: ' + err.message, 'error');
    }
  },

  render() {
    if (State.activeView === 'board') {
      document.getElementById('kanban-view').style.display = 'flex';
      document.getElementById('list-view').style.display = 'none';
      this.renderKanban();
    } else {
      document.getElementById('kanban-view').style.display = 'none';
      document.getElementById('list-view').style.display = 'block';
      this.renderList();
    }
  },

  getFilteredTasks(tasks) {
    if (!tasks) return [];
    return tasks.filter((t) => {
      // Keyword search
      if (State.searchQuery) {
        const q = State.searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchLabel = (t.labels || []).some(l => l.name.toLowerCase().includes(q));
        const matchAssignee = (t.assignees || []).some(a => a.full_name.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchLabel && !matchAssignee) return false;
      }
      // Priority filter
      if (State.filterPriority && t.priority !== State.filterPriority) {
        return false;
      }
      // Assignee filter
      if (State.filterAssignee) {
        const hasAssignee = (t.assignees || []).some(a => a.id === parseInt(State.filterAssignee));
        if (!hasAssignee) return false;
      }
      return true;
    });
  },

  renderKanban() {
    const container = document.getElementById('kanban-view');
    if (!container || !State.currentProject) return;

    container.innerHTML = '';
    const columns = State.currentProject.columns || [];

    columns.forEach((col) => {
      const filteredTasks = this.getFilteredTasks(col.tasks || []);

      const colEl = document.createElement('div');
      colEl.className = 'column-card';
      colEl.dataset.columnId = col.id;

      colEl.innerHTML = `
        <div class="column-header">
          <div class="column-title-wrap">
            <div class="column-dot" style="background-color: ${col.color || '#64748B'};"></div>
            <span class="column-title">${Utils.escapeHtml(col.name)}</span>
            <span class="column-count">${filteredTasks.length}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button class="icon-btn btn-delete-column" data-col-id="${col.id}" title="Delete Column" style="padding: 2px;">
              <i data-feather="more-horizontal" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
        <div class="column-tasks" id="col-tasks-${col.id}" data-column-id="${col.id}">
          <!-- Tasks injected here -->
        </div>
        <div class="add-task-btn-wrapper">
          <button class="add-task-trigger" data-col-id="${col.id}">
            <i data-feather="plus" style="width: 14px; height: 14px;"></i> Add a card
          </button>
        </div>
      `;

      // Render tasks in this column
      const tasksContainer = colEl.querySelector(`#col-tasks-${col.id}`);
      filteredTasks.forEach((task) => {
        tasksContainer.appendChild(this.createTaskCardElement(task));
      });

      // Setup Drag & Drop listeners on column container
      this.setupColumnDropEvents(tasksContainer, col.id);

      // Add task button click
      const addBtn = colEl.querySelector('.add-task-trigger');
      addBtn.addEventListener('click', () => {
        App.openCreateTaskModal(col.id);
      });

      // Delete column menu
      const delColBtn = colEl.querySelector('.btn-delete-column');
      delColBtn.addEventListener('click', async () => {
        if (confirm(`Delete column "${col.name}" and its tasks?`)) {
          try {
            await API.deleteColumn(col.id);
            Utils.showToast('Column deleted', 'info');
          } catch (e) {
            Utils.showToast(e.message, 'error');
          }
        }
      });

      container.appendChild(colEl);
    });

    // Add Column card button
    const addColWrapper = document.createElement('div');
    addColWrapper.className = 'add-column-card';
    addColWrapper.innerHTML = `
      <i data-feather="plus" style="width: 24px; height: 24px;"></i>
      <span style="font-weight: 600; font-size: 0.9rem;">Add another column</span>
    `;
    addColWrapper.addEventListener('click', () => {
      App.openModal('modal-add-column');
    });
    container.appendChild(addColWrapper);

    if (window.feather) feather.replace();
  },

  createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.dataset.columnId = task.column_id;

    // Check checklist progress
    const checkStats = task.checklist_stats || { total: 0, completed: 0 };
    const hasChecklist = checkStats.total > 0;

    // Due date styling
    let dueDateClass = '';
    let isOverdue = false;
    let isDueToday = false;
    if (task.due_date) {
      const due = new Date(task.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (due < today) {
        dueDateClass = 'overdue';
        isOverdue = true;
      } else if (due < tomorrow) {
        dueDateClass = 'due-soon';
        isDueToday = true;
      }
    }

    // Build Assignees HTML
    let assigneesHtml = '';
    (task.assignees || []).slice(0, 3).forEach((u) => {
      assigneesHtml += `
        <div class="avatar" style="background-color: ${u.avatar_color || '#4F46E5'};" title="${Utils.escapeHtml(u.full_name)}">
          ${Utils.getInitials(u.full_name)}
        </div>
      `;
    });
    if ((task.assignees || []).length > 3) {
      assigneesHtml += `<div class="avatar" style="background-color: #475569;">+${task.assignees.length - 3}</div>`;
    }

    // Build Labels HTML
    let labelsHtml = '';
    (task.labels || []).forEach((lbl) => {
      labelsHtml += `<span class="task-label-tag" style="background-color: ${lbl.color || '#3B82F6'};">${Utils.escapeHtml(lbl.name)}</span>`;
    });

    card.innerHTML = `
      <div class="task-card-header">
        <div class="task-labels">${labelsHtml}</div>
        <span class="task-priority-badge priority-${task.priority}">${task.priority}</span>
      </div>
      <div class="task-title">${Utils.escapeHtml(task.title)}</div>
      ${task.description ? `<div class="task-description-preview">${Utils.escapeHtml(task.description)}</div>` : ''}
      <div class="task-meta">
        <div class="task-meta-left">
          ${task.due_date ? `
            <div class="meta-item ${dueDateClass}" title="Due Date">
              <i data-feather="calendar" style="width: 12px; height: 12px;"></i>
              <span>${Utils.formatDate(task.due_date)}</span>
            </div>
          ` : ''}
          ${hasChecklist ? `
            <div class="meta-item" title="Checklist progress">
              <i data-feather="check-square" style="width: 12px; height: 12px;"></i>
              <span>${checkStats.completed}/${checkStats.total}</span>
            </div>
          ` : ''}
          ${task.comment_count > 0 ? `
            <div class="meta-item" title="Comments">
              <i data-feather="message-circle" style="width: 12px; height: 12px;"></i>
              <span>${task.comment_count}</span>
            </div>
          ` : ''}
        </div>
        <div class="task-assignees">${assigneesHtml}</div>
      </div>
    `;

    // Click to open detail modal
    card.addEventListener('click', (e) => {
      TaskModal.open(task.id);
    });

    // Drag start / end
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      Board.draggedTaskId = task.id;
      Board.sourceColumnId = task.column_id;
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.column-tasks').forEach(el => el.classList.remove('drag-over'));
      Board.draggedTaskId = null;
    });

    return card;
  },

  setupColumnDropEvents(columnTasksEl, columnId) {
    columnTasksEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      columnTasksEl.classList.add('drag-over');

      const draggingCard = document.querySelector('.task-card.dragging');
      if (!draggingCard) return;

      const afterElement = Board.getDragAfterElement(columnTasksEl, e.clientY);
      if (afterElement == null) {
        columnTasksEl.appendChild(draggingCard);
      } else {
        columnTasksEl.insertBefore(draggingCard, afterElement);
      }
    });

    columnTasksEl.addEventListener('dragleave', () => {
      columnTasksEl.classList.remove('drag-over');
    });

    columnTasksEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      columnTasksEl.classList.remove('drag-over');

      const taskId = Board.draggedTaskId;
      if (!taskId) return;

      // Calculate new index in this column
      const cardsInColumn = Array.from(columnTasksEl.querySelectorAll('.task-card'));
      const targetOrder = cardsInColumn.findIndex(c => parseInt(c.dataset.taskId) === taskId);

      try {
        await API.moveTask(taskId, columnId, targetOrder >= 0 ? targetOrder : 0);
        // Optimistically update internal model
        Board.applyLocalTaskMove(taskId, columnId, targetOrder >= 0 ? targetOrder : 0);
      } catch (err) {
        Utils.showToast('Failed to move task: ' + err.message, 'error');
        Board.loadProject(State.currentProject.id, false);
      }
    });
  },

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  applyLocalTaskMove(taskId, targetColumnId, targetOrder) {
    if (!State.currentProject) return;

    let foundTask = null;
    // Remove task from old column
    State.currentProject.columns.forEach((col) => {
      const idx = col.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        foundTask = col.tasks.splice(idx, 1)[0];
      }
    });

    if (foundTask) {
      foundTask.column_id = targetColumnId;
      const targetCol = State.currentProject.columns.find(c => c.id === targetColumnId);
      if (targetCol) {
        targetCol.tasks.splice(targetOrder, 0, foundTask);
      }
    }

    this.updateProjectMetrics();
  },

  renderList() {
    const tbody = document.getElementById('list-table-body');
    if (!tbody || !State.currentProject) return;

    tbody.innerHTML = '';
    const columns = State.currentProject.columns || [];

    columns.forEach((col) => {
      const filteredTasks = this.getFilteredTasks(col.tasks || []);

      filteredTasks.forEach((task) => {
        const tr = document.createElement('tr');
        const checkStats = task.checklist_stats || { total: 0, completed: 0 };

        tr.innerHTML = `
          <td><i data-feather="circle" style="width: 15px; height: 15px; color: ${col.color || '#64748B'};"></i></td>
          <td><strong>${Utils.escapeHtml(task.title)}</strong></td>
          <td><span class="brand-badge" style="background: rgba(99, 102, 241, 0.15); color: #818CF8;">${Utils.escapeHtml(col.name)}</span></td>
          <td><span class="task-priority-badge priority-${task.priority}">${task.priority}</span></td>
          <td>${task.due_date ? Utils.formatDate(task.due_date) : '-'}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              ${(task.assignees || []).map(a => `
                <div class="avatar" style="background-color: ${a.avatar_color || '#4F46E5'}; width: 22px; height: 22px; font-size: 0.6rem;" title="${Utils.escapeHtml(a.full_name)}">
                  ${Utils.getInitials(a.full_name)}
                </div>
              `).join('')}
            </div>
          </td>
          <td>${checkStats.total > 0 ? `${checkStats.completed}/${checkStats.total}` : '-'}</td>
          <td>${task.comment_count > 0 ? `<span style="display: flex; align-items: center; gap: 4px;"><i data-feather="message-circle" style="width: 12px; height: 12px;"></i> ${task.comment_count}</span>` : '-'}</td>
        `;

        tr.addEventListener('click', () => {
          TaskModal.open(task.id);
        });

        tbody.appendChild(tr);
      });
    });

    if (window.feather) feather.replace();
  },

  renderSidebarMembers(members) {
    const list = document.getElementById('sidebar-members-list');
    if (!list) return;

    list.innerHTML = '';
    members.forEach((m) => {
      const u = m.user;
      if (!u) return;

      const item = document.createElement('div');
      item.className = 'member-item';
      item.innerHTML = `
        <div class="member-info">
          <div class="avatar" style="background-color: ${u.avatar_color || '#4F46E5'}; width: 26px; height: 26px; font-size: 0.65rem;">
            ${Utils.getInitials(u.full_name)}
          </div>
          <span style="font-weight: 500;">${Utils.escapeHtml(u.full_name)}</span>
        </div>
        <span class="member-role">${m.role}</span>
      `;
      list.appendChild(item);
    });
  },

  populateFilterAssignees(members) {
    const select = document.getElementById('filter-assignee');
    if (!select) return;

    select.innerHTML = '<option value="">All Assignees</option>';
    members.forEach((m) => {
      if (m.user) {
        const opt = document.createElement('option');
        opt.value = m.user.id;
        opt.textContent = m.user.full_name;
        select.appendChild(opt);
      }
    });
  },

  updateProjectMetrics() {
    if (!State.currentProject) return;

    let totalTasks = 0;
    let completedTasks = 0;

    (State.currentProject.columns || []).forEach((col) => {
      const count = (col.tasks || []).length;
      totalTasks += count;
      if (col.name.toLowerCase().includes('done') || col.name.toLowerCase().includes('complete')) {
        completedTasks += count;
      }
    });

    const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const bar = document.getElementById('stats-progress-bar');
    const percentText = document.getElementById('stats-percentage-text');
    const totalEl = document.getElementById('stats-total-tasks');
    const doneEl = document.getElementById('stats-completed-tasks');

    if (bar) bar.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${percent}%`;
    if (totalEl) totalEl.textContent = `${totalTasks} Total`;
    if (doneEl) doneEl.textContent = `${completedTasks} Completed`;
  },

  // Real-Time Event Handlers
  onTaskCreated(task) {
    if (!State.currentProject || task.project_id !== State.currentProject.id) return;
    const col = State.currentProject.columns.find(c => c.id === task.column_id);
    if (col) {
      if (!col.tasks) col.tasks = [];
      col.tasks.push(task);
      this.render();
      this.updateProjectMetrics();
    }
  },

  onTaskMoved(data) {
    if (!State.currentProject || data.task.project_id !== State.currentProject.id) return;
    this.applyLocalTaskMove(data.task_id, data.destination_column_id, data.target_order);
    this.render();
  },

  onTaskUpdated(task) {
    if (!State.currentProject || task.project_id !== State.currentProject.id) return;
    State.currentProject.columns.forEach((col) => {
      const idx = (col.tasks || []).findIndex(t => t.id === task.id);
      if (idx !== -1) {
        col.tasks[idx] = task;
      }
    });
    this.render();
  },

  onTaskDeleted(taskId) {
    if (!State.currentProject) return;
    State.currentProject.columns.forEach((col) => {
      col.tasks = (col.tasks || []).filter(t => t.id !== taskId);
    });
    this.render();
    this.updateProjectMetrics();
  },

  incrementTaskCommentCount(taskId) {
    if (!State.currentProject) return;
    State.currentProject.columns.forEach((col) => {
      const task = (col.tasks || []).find(t => t.id === taskId);
      if (task) {
        task.comment_count = (task.comment_count || 0) + 1;
      }
    });
    this.render();
  },

  async refreshChecklistStats(taskId) {
    try {
      const task = await API.getTask(taskId);
      this.onTaskUpdated(task);
    } catch (e) {}
  }
};

window.Board = Board;
