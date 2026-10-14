# SyncFlow — Collaborative Project Management Tool (Trello / Asana Alternative)

A full-stack, collaborative project management application built with **FastAPI**, **SQLAlchemy**, **WebSockets**, and a modern **Single Page Application (SPA)** frontend.

---

## ✨ Features

### 1. 🔐 Full Authentication & User System
- **JWT-based authentication**: User registration, login, secure session management.
- **Instant Collaborator Switcher**: 1-click switcher between pre-seeded demo users (**Alex Rivers**, **Maya Chen**, **David Ross**) to test multi-user real-time collaboration instantly across browser tabs or windows without typing passwords!
- User profiles with avatars and roles.

### 2. 📁 Group Projects & Workspaces
- Create, customize, and manage projects with custom color accents and descriptions.
- **Collaborative Team Members**: Invite users by username/email with assigned roles (`owner`, `admin`, `member`, `viewer`).
- Project statistics card with dynamic task completion percentage bar.

### 3. 📋 Interactive Kanban Boards & Views
- **Kanban Board View**: Customizable columns (e.g. *To Do*, *In Progress*, *In Review*, *Done*).
- **Native Drag-and-Drop**: Smooth HTML5 drag-and-drop between columns and reordering with persistent order and optimistic updates.
- **List / Table View**: Asana-style table view with sorting and columns.
- **Instant Search & Multi-Filter**: Filter tasks in real-time by search query, priority (`urgent`, `high`, `medium`, `low`), and assignees.

### 4. 🗂️ Rich Task Cards
- Task priority pills with color coding (`Urgent`, `High`, `Medium`, `Low`).
- Due date indicators with overdue and due-today warning badges.
- Assignee avatars.
- Color-coded labels and tags.
- Sub-tasks & Checklist with progress bar and checklist counters.

### 5. 💬 Task Comments & Communication
- Threaded chronological discussion within task cards.
- Author avatars, timestamps, and real-time updates.
- Audit trail / Activity stream of all project actions (moves, edits, assignments, comments).

### 6. ⚡ Bonus: Real-time WebSockets & Notifications
- **Live Board Synchronization**: When collaborator A drags a card or adds a task, collaborator B's board updates instantly in real-time!
- **Targeted Notification Channel**: When a collaborator assigns you or comments on your card, you receive an instant in-app notification and toast alert.
- **Unread Notification Drawer & Badge Counter**.
- **Live Connection Status**: Visual pulse indicator confirming WebSocket connection.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+ (tested on Python 3.14)

### Installation

1. Navigate to the project folder:
   ```bash
   cd project-tool
   ```

2. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```

3. Launch the application:
   ```bash
   python run.py
   ```

4. Open your browser at:
   ```
   http://127.0.0.1:8000
   ```

---

## 👥 Demo Accounts (Pre-Seeded)

The database automatically seeds realistic collaborative projects, tasks, checklists, and comments on first run. You can log in using either the 1-click demo buttons on the login screen or via credentials:

| Name | Username | Email | Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Alex Rivers** | `alex` | `alex@flowspace.io` | `password123` | Lead Product Architect |
| **Maya Chen** | `maya` | `maya@flowspace.io` | `password123` | Senior UI/UX Engineer |
| **David Ross** | `david` | `david@flowspace.io` | `password123` | Backend & Cloud Lead |

> **Tip for Testing Real-Time WebSockets**:
> Open two browser windows side by side (e.g. standard window as **Alex Rivers**, and incognito window or separate profile as **Maya Chen**).
> Move cards or post comments on one window and watch the changes reflect **instantly** in the other without refreshing!

---

## 🔌 API Endpoints Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and retrieve JWT token
- `GET /api/auth/me` - Get currently authenticated user
- `GET /api/auth/demo-users` - List demo accounts
- `POST /api/auth/demo-login/{id}` - Quick login as demo user

### Projects (`/api/projects`)
- `GET /api/projects` - List all projects user has access to
- `POST /api/projects` - Create a new project with default columns
- `GET /api/projects/{id}` - Get project details, columns, members, and tasks
- `PUT /api/projects/{id}` - Update project metadata
- `DELETE /api/projects/{id}` - Delete project
- `POST /api/projects/{id}/members` - Add / invite member to project
- `GET /api/projects/{id}/activity` - Get project audit trail

### Tasks & Columns (`/api/tasks`, `/api/columns`)
- `POST /api/projects/{id}/columns` - Add new column to board
- `DELETE /api/columns/{id}` - Delete column
- `POST /api/projects/{id}/tasks` - Create task card
- `GET /api/tasks/{id}` - Get task details with checklists and comments
- `PUT /api/tasks/{id}` - Update title, description, priority, due date, assignees
- `POST /api/tasks/{id}/move` - Drag-and-drop move / reorder card
- `DELETE /api/tasks/{id}` - Delete task card
- `POST /api/tasks/{id}/checklists` - Add checklist sub-task
- `PUT /api/checklists/{id}` - Toggle checklist item completion
- `POST /api/tasks/{id}/comments` - Post comment on task
- `GET /api/tasks/{id}/comments` - Fetch comment thread

### Notifications & WebSockets
- `GET /api/notifications` - Retrieve in-app notifications & unread count
- `POST /api/notifications/read` - Mark notifications as read
- `WS /ws/project/{project_id}` - Real-time board synchronization channel
- `WS /ws/notifications` - Real-time direct user notifications channel
