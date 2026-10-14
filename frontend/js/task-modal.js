// Task Details, Checklists, Comments & Communication Modal Controller
const TaskModal = {
  currentTaskId: null,
  taskData: null,

  async open(taskId) {
    this.currentTaskId = taskId;
    try {
      const task = await API.getTask(taskId);
      this.taskData = task;
      State.activeTaskDetail = task;

      this.populateData();
      App.openModal('modal-task-detail');
    } catch (err) {
      Utils.showToast('Failed to load task details', 'error');
    }
  },

  close() {
    App.closeModal('modal-task-detail');
    this.currentTaskId = null;
    this.taskData = null;
    State.activeTaskDetail = null;
  },

  populateData() {
    const task = this.taskData;
    if (!task) return;

    // Header info
    const colPill = document.getElementById('task-modal-column-pill');
    const currentCol = State.currentProject?.columns.find(c => c.id === task.column_id);
    if (colPill) {
      colPill.textContent = currentCol ? currentCol.name : 'Task';
      colPill.style.backgroundColor = currentCol ? currentCol.color : '#6366F1';
    }

    const createdTimeEl = document.getElementById('task-modal-created-time');
    if (createdTimeEl) {
      createdTimeEl.textContent = `Created ${Utils.formatDate(task.created_at)} by ${task.created_by?.full_name || 'Team member'}`;
    }

    // Title & Description
    const titleInput = document.getElementById('task-detail-title');
    if (titleInput) titleInput.value = task.title;

    const descInput = document.getElementById('task-detail-description');
    if (descInput) descInput.value = task.description || '';

    // Status Column Select
    const colSelect = document.getElementById('task-modal-select-column');
    if (colSelect && State.currentProject) {
      colSelect.innerHTML = '';
      State.currentProject.columns.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        opt.selected = c.id === task.column_id;
        colSelect.appendChild(opt);
      });
    }

    // Priority Select
    const prioritySelect = document.getElementById('task-modal-select-priority');
    if (prioritySelect) prioritySelect.value = task.priority || 'medium';

    // Due Date
    const dueDateInput = document.getElementById('task-modal-input-duedate');
    if (dueDateInput) {
      dueDateInput.value = task.due_date ? task.due_date.split('T')[0] : '';
    }

    // Assignees & Labels
    this.renderAssignees();
    this.renderLabels();

    // Checklists
    this.renderChecklists();

    // Comments
    this.renderComments();

    this.bindActionEvents();

    if (window.feather) feather.replace();
  },

  bindActionEvents() {
    // Delete Task Button
    const deleteBtn = document.getElementById('btn-delete-task');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm(`Are you sure you want to delete "${this.taskData.title}"?`)) {
          try {
            await API.deleteTask(this.currentTaskId);
            this.close();
            Utils.showToast('Task deleted successfully', 'info');
          } catch (e) {
            Utils.showToast(e.message, 'error');
          }
        }
      };
    }

    // Title Change (Blur / Enter)
    const titleInput = document.getElementById('task-detail-title');
    if (titleInput) {
      titleInput.onblur = async () => {
        const val = titleInput.value.trim();
        if (val && val !== this.taskData.title) {
          try {
            const updated = await API.updateTask(this.currentTaskId, { title: val });
            this.taskData = updated;
          } catch (e) {
            Utils.showToast(e.message, 'error');
          }
        }
      };
      titleInput.onkeydown = (e) => {
        if (e.key === 'Enter') titleInput.blur();
      };
    }

    // Save Description Button
    const saveDescBtn = document.getElementById('btn-save-task-description');
    if (saveDescBtn) {
      saveDescBtn.onclick = async () => {
        const val = document.getElementById('task-detail-description').value;
        try {
          const updated = await API.updateTask(this.currentTaskId, { description: val });
          this.taskData = updated;
          Utils.showToast('Description updated', 'success');
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
    }

    // Status Column Change
    const colSelect = document.getElementById('task-modal-select-column');
    if (colSelect) {
      colSelect.onchange = async () => {
        const targetColId = parseInt(colSelect.value);
        try {
          await API.moveTask(this.currentTaskId, targetColId, 0);
          this.taskData.column_id = targetColId;
          const targetCol = State.currentProject?.columns.find(c => c.id === targetColId);
          if (targetCol) {
            const pill = document.getElementById('task-modal-column-pill');
            if (pill) {
              pill.textContent = targetCol.name;
              pill.style.backgroundColor = targetCol.color;
            }
          }
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
    }

    // Priority Change
    const prioritySelect = document.getElementById('task-modal-select-priority');
    if (prioritySelect) {
      prioritySelect.onchange = async () => {
        const priority = prioritySelect.value;
        try {
          const updated = await API.updateTask(this.currentTaskId, { priority });
          this.taskData = updated;
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
    }

    // Due Date Change
    const dueDateInput = document.getElementById('task-modal-input-duedate');
    if (dueDateInput) {
      dueDateInput.onchange = async () => {
        const val = dueDateInput.value ? new Date(dueDateInput.value).toISOString() : null;
        try {
          const updated = await API.updateTask(this.currentTaskId, { due_date: val });
          this.taskData = updated;
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
    }

    // Add Checklist Item
    const addChecklistBtn = document.getElementById('btn-add-checklist-item');
    const checklistInput = document.getElementById('input-new-checklist');
    if (addChecklistBtn && checklistInput) {
      addChecklistBtn.onclick = async () => {
        const title = checklistInput.value.trim();
        if (!title) return;
        try {
          await API.addChecklistItem(this.currentTaskId, title);
          checklistInput.value = '';
          const task = await API.getTask(this.currentTaskId);
          this.taskData = task;
          this.renderChecklists();
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
      checklistInput.onkeydown = (e) => {
        if (e.key === 'Enter') addChecklistBtn.click();
      };
    }

    // Post Comment
    const postCommentBtn = document.getElementById('btn-post-comment');
    const commentInput = document.getElementById('task-new-comment-input');
    if (postCommentBtn && commentInput) {
      postCommentBtn.onclick = async () => {
        const content = commentInput.value.trim();
        if (!content) return;
        try {
          await API.addComment(this.currentTaskId, content);
          commentInput.value = '';
          const comments = await API.getComments(this.currentTaskId);
          this.taskData.comments = comments;
          this.renderComments();
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
      commentInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          postCommentBtn.click();
        }
      };
    }

    // Add Label
    const addLabelBtn = document.getElementById('btn-add-label');
    const labelInput = document.getElementById('input-new-label-text');
    if (addLabelBtn && labelInput) {
      addLabelBtn.onclick = async () => {
        const text = labelInput.value.trim();
        if (!text) return;
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        try {
          await API.addLabel(this.currentTaskId, text, randomColor);
          labelInput.value = '';
          const task = await API.getTask(this.currentTaskId);
          this.taskData = task;
          this.renderLabels();
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };
      labelInput.onkeydown = (e) => {
        if (e.key === 'Enter') addLabelBtn.click();
      };
    }
  },

  renderAssignees() {
    const container = document.getElementById('task-modal-assignees-container');
    const select = document.getElementById('task-modal-add-assignee-select');
    if (!container || !select) return;

    container.innerHTML = '';
    const currentAssigneeIds = (this.taskData.assignees || []).map(a => a.id);

    (this.taskData.assignees || []).forEach((u) => {
      const chip = document.createElement('div');
      chip.style.cssText = 'display: flex; align-items: center; gap: 6px; background: var(--bg-tertiary); padding: 3px 8px; border-radius: var(--radius-full); font-size: 0.78rem;';
      chip.innerHTML = `
        <div class="avatar" style="background-color: ${u.avatar_color || '#4F46E5'}; width: 20px; height: 20px; font-size: 0.55rem;">
          ${Utils.getInitials(u.full_name)}
        </div>
        <span>${Utils.escapeHtml(u.full_name)}</span>
        <button class="icon-btn" style="padding: 0; color: var(--text-muted);">&times;</button>
      `;

      // Remove assignee
      chip.querySelector('button').onclick = async () => {
        const newIds = currentAssigneeIds.filter(id => id !== u.id);
        const updated = await API.updateTask(this.currentTaskId, { assignee_ids: newIds });
        this.taskData = updated;
        this.renderAssignees();
      };

      container.appendChild(chip);
    });

    // Populate Add Assignee Dropdown with project members not yet assigned
    select.innerHTML = '<option value="">+ Assign team member...</option>';
    const members = State.currentProject?.members || [];
    members.forEach((m) => {
      if (m.user && !currentAssigneeIds.includes(m.user.id)) {
        const opt = document.createElement('option');
        opt.value = m.user.id;
        opt.textContent = m.user.full_name;
        select.appendChild(opt);
      }
    });

    select.onchange = async () => {
      const newUserId = parseInt(select.value);
      if (!newUserId) return;
      const newIds = [...currentAssigneeIds, newUserId];
      try {
        const updated = await API.updateTask(this.currentTaskId, { assignee_ids: newIds });
        this.taskData = updated;
        this.renderAssignees();
      } catch (e) {
        Utils.showToast(e.message, 'error');
      }
    };
  },

  renderLabels() {
    const container = document.getElementById('task-modal-labels-container');
    if (!container) return;

    container.innerHTML = '';
    (this.taskData.labels || []).forEach((lbl) => {
      const tag = document.createElement('span');
      tag.className = 'task-label-tag';
      tag.style.backgroundColor = lbl.color || '#3B82F6';
      tag.style.display = 'inline-flex';
      tag.style.alignItems = 'center';
      tag.style.gap = '4px';

      tag.innerHTML = `
        <span>${Utils.escapeHtml(lbl.name)}</span>
        <span style="cursor: pointer; opacity: 0.8;" title="Remove tag">&times;</span>
      `;

      tag.querySelector('span:last-child').onclick = async () => {
        try {
          await API.deleteLabel(lbl.id);
          this.taskData.labels = this.taskData.labels.filter(l => l.id !== lbl.id);
          this.renderLabels();
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };

      container.appendChild(tag);
    });
  },

  renderChecklists() {
    const container = document.getElementById('task-checklist-container');
    const summaryEl = document.getElementById('task-checklist-summary');
    const progressEl = document.getElementById('task-checklist-progress');
    if (!container) return;

    container.innerHTML = '';
    const items = this.taskData.checklists || [];
    const completedCount = items.filter(i => i.is_completed).length;

    if (summaryEl) summaryEl.textContent = `${completedCount}/${items.length}`;
    if (progressEl) {
      const pct = items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100);
      progressEl.style.width = `${pct}%`;
    }

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = `checklist-item ${item.is_completed ? 'completed' : ''}`;

      row.innerHTML = `
        <input type="checkbox" ${item.is_completed ? 'checked' : ''} style="cursor: pointer;">
        <span style="flex: 1; font-size: 0.88rem;">${Utils.escapeHtml(item.title)}</span>
        <button class="icon-btn btn-del-check" style="padding: 2px; color: var(--text-muted);">&times;</button>
      `;

      // Toggle completed
      const checkInput = row.querySelector('input');
      checkInput.onchange = async () => {
        try {
          await API.updateChecklistItem(item.id, checkInput.checked, item.title);
          item.is_completed = checkInput.checked;
          row.classList.toggle('completed', checkInput.checked);
          this.renderChecklists();
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };

      // Delete item
      row.querySelector('.btn-del-check').onclick = async () => {
        try {
          await API.deleteChecklistItem(item.id);
          this.taskData.checklists = this.taskData.checklists.filter(i => i.id !== item.id);
          this.renderChecklists();
        } catch (e) {
          Utils.showToast(e.message, 'error');
        }
      };

      container.appendChild(row);
    });
  },

  async renderComments() {
    const container = document.getElementById('task-comments-container');
    if (!container) return;

    container.innerHTML = '';
    let comments = this.taskData.comments;
    if (!comments) {
      try {
        comments = await API.getComments(this.currentTaskId);
        this.taskData.comments = comments;
      } catch (e) {
        comments = [];
      }
    }

    if (comments.length === 0) {
      container.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted); padding: 8px 0;">No comments yet. Start the conversation!</div>';
      return;
    }

    comments.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'comment-card';
      const author = c.author || { full_name: 'Anonymous', avatar_color: '#4F46E5' };
      const isAuthor = State.currentUser && State.currentUser.id === c.user_id;

      card.innerHTML = `
        <div class="avatar" style="background-color: ${author.avatar_color || '#4F46E5'}; width: 28px; height: 28px; font-size: 0.7rem;">
          ${Utils.getInitials(author.full_name)}
        </div>
        <div class="comment-bubble">
          <div class="comment-header">
            <span class="comment-author">${Utils.escapeHtml(author.full_name)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="comment-date">${Utils.formatRelativeTime(c.created_at)}</span>
              ${isAuthor ? `<button class="icon-btn btn-del-comment" style="padding: 0; font-size: 0.75rem; color: var(--text-muted);" title="Delete comment">&times;</button>` : ''}
            </div>
          </div>
          <div class="comment-text">${Utils.escapeHtml(c.content)}</div>
        </div>
      `;

      if (isAuthor) {
        card.querySelector('.btn-del-comment').onclick = async () => {
          if (confirm('Delete this comment?')) {
            try {
              await API.deleteComment(c.id);
              this.taskData.comments = this.taskData.comments.filter(cm => cm.id !== c.id);
              this.renderComments();
            } catch (e) {
              Utils.showToast(e.message, 'error');
            }
          }
        };
      }

      container.appendChild(card);
    });

    // Auto scroll comments to bottom
    container.scrollTop = container.scrollHeight;
  },

  onCommentAdded(comment) {
    if (!this.taskData) return;
    if (!this.taskData.comments) this.taskData.comments = [];
    this.taskData.comments.push(comment);
    this.renderComments();
  },

  onCommentDeleted(commentId) {
    if (!this.taskData || !this.taskData.comments) return;
    this.taskData.comments = this.taskData.comments.filter(c => c.id !== commentId);
    this.renderComments();
  },

  async refreshChecklists(data) {
    if (!this.taskData) return;
    const task = await API.getTask(this.currentTaskId);
    this.taskData.checklists = task.checklists;
    this.renderChecklists();
  },

  onExternalTaskUpdate(task) {
    this.taskData = task;
    this.populateData();
  }
};

window.TaskModal = TaskModal;
