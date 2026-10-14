from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.models import User, Project, ProjectMember, BoardColumn, Task, TaskLabel, TaskChecklist, Comment, Activity, Notification
from backend.auth import hash_password

def seed_database(db: Session):
    # Check if data already exists
    if db.query(User).first() is not None:
        return

    print("Seeding initial data...")

    # Create users
    u_alex = User(
        email="alex@flowspace.io",
        username="alex",
        full_name="Alex Rivers",
        hashed_password=hash_password("password123"),
        avatar_color="#4F46E5",
        bio="Lead Product Architect & Coordinator"
    )
    u_maya = User(
        email="maya@flowspace.io",
        username="maya",
        full_name="Maya Chen",
        hashed_password=hash_password("password123"),
        avatar_color="#EC4899",
        bio="Senior UI/UX Designer & Frontend Engineer"
    )
    u_david = User(
        email="david@flowspace.io",
        username="david",
        full_name="David Ross",
        hashed_password=hash_password("password123"),
        avatar_color="#10B981",
        bio="Backend & Infrastructure Specialist"
    )
    db.add_all([u_alex, u_maya, u_david])
    db.flush()

    # Create Project 1: Apollo Mobile App 2.0
    p1 = Project(
        name="Apollo Mobile App 2.0",
        description="Comprehensive redesign of the core iOS & Android mobile experience with modern gestures and offline mode.",
        color="#6366F1",
        icon="smartphone",
        owner_id=u_alex.id
    )
    db.add(p1)
    db.flush()

    # Members
    m1_alex = ProjectMember(project_id=p1.id, user_id=u_alex.id, role="owner")
    m1_maya = ProjectMember(project_id=p1.id, user_id=u_maya.id, role="admin")
    m1_david = ProjectMember(project_id=p1.id, user_id=u_david.id, role="member")
    db.add_all([m1_alex, m1_maya, m1_david])
    db.flush()

    # Columns
    c_todo = BoardColumn(project_id=p1.id, name="To Do", color="#94A3B8", order=0)
    c_prog = BoardColumn(project_id=p1.id, name="In Progress", color="#38BDF8", order=1)
    c_review = BoardColumn(project_id=p1.id, name="In Review", color="#FBBF24", order=2)
    c_done = BoardColumn(project_id=p1.id, name="Done", color="#34D399", order=3)
    db.add_all([c_todo, c_prog, c_review, c_done])
    db.flush()

    # Task 1: Auth flow & biometrics
    t1 = Task(
        project_id=p1.id,
        column_id=c_prog.id,
        title="Implement Biometric FaceID & Fingerprint Authentication",
        description="Ensure secure key storage in iOS Keychain / Android KeyStore and implement fallback passcode.",
        priority="urgent",
        due_date=datetime.utcnow() + timedelta(days=2),
        order=0,
        created_by_id=u_alex.id
    )
    t1.assignees = [u_david]
    db.add(t1)
    db.flush()

    db.add(TaskLabel(task_id=t1.id, name="Security", color="#EF4444"))
    db.add(TaskLabel(task_id=t1.id, name="Mobile", color="#8B5CF6"))
    db.add(TaskChecklist(task_id=t1.id, title="iOS Keychain integration", is_completed=True, order=0))
    db.add(TaskChecklist(task_id=t1.id, title="Android KeyStore fallback", is_completed=False, order=1))
    db.add(TaskChecklist(task_id=t1.id, title="Unit tests for token renewal", is_completed=False, order=2))
    db.add(Comment(task_id=t1.id, user_id=u_alex.id, content="David, let's verify session revocation when credentials change."))
    db.add(Comment(task_id=t1.id, user_id=u_david.id, content="Working on token invalidation right now. Keychain tests are already passing."))

    # Task 2: Design system overhaul
    t2 = Task(
        project_id=p1.id,
        column_id=c_review.id,
        title="Revamp Dark Mode & High-Contrast Design Tokens",
        description="Update typography scales, contrast ratios according to WCAG 2.1 AA standards, and export Figma tokens.",
        priority="high",
        due_date=datetime.utcnow() + timedelta(days=4),
        order=0,
        created_by_id=u_alex.id
    )
    t2.assignees = [u_maya]
    db.add(t2)
    db.flush()

    db.add(TaskLabel(task_id=t2.id, name="UI/UX", color="#EC4899"))
    db.add(TaskLabel(task_id=t2.id, name="Accessibility", color="#10B981"))
    db.add(TaskChecklist(task_id=t2.id, title="Figma components audit", is_completed=True, order=0))
    db.add(TaskChecklist(task_id=t2.id, title="CSS variable exports", is_completed=True, order=1))
    db.add(TaskChecklist(task_id=t2.id, title="Review with accessibility consultant", is_completed=False, order=2))
    db.add(Comment(task_id=t2.id, user_id=u_maya.id, content="Contrast ratios verified for 4.5:1 text elements! Ready for review."))

    # Task 3: WebSocket live collaboration
    t3 = Task(
        project_id=p1.id,
        column_id=c_done.id,
        title="Real-Time WebSocket Sync Engine & Toast Alerts",
        description="Broadcast state diffs for drag & drop moves, task updates, and dynamic notification badges.",
        priority="high",
        due_date=datetime.utcnow() - timedelta(days=1),
        order=0,
        created_by_id=u_david.id
    )
    t3.assignees = [u_david, u_maya]
    db.add(t3)
    db.flush()

    db.add(TaskLabel(task_id=t3.id, name="Real-Time", color="#3B82F6"))
    db.add(TaskChecklist(task_id=t3.id, title="FastAPI WebSocket channel", is_completed=True, order=0))
    db.add(TaskChecklist(task_id=t3.id, title="Client auto-reconnect logic", is_completed=True, order=1))

    # Task 4: Push notification service
    t4 = Task(
        project_id=p1.id,
        column_id=c_todo.id,
        title="Implement APNS & FCM Push Notification Channels",
        description="Allow users to receive instant mobile pushes when they are assigned to high-priority items.",
        priority="medium",
        due_date=datetime.utcnow() + timedelta(days=7),
        order=0,
        created_by_id=u_alex.id
    )
    t4.assignees = [u_david]
    db.add(t4)
    db.flush()
    db.add(TaskLabel(task_id=t4.id, name="Backend", color="#F59E0B"))

    # Project 2: Cloud Infrastructure & CI/CD
    p2 = Project(
        name="Global Cloud Infrastructure",
        description="Multi-region container deployment, automated staging environments, and database failover drills.",
        color="#10B981",
        icon="server",
        owner_id=u_david.id
    )
    db.add(p2)
    db.flush()

    m2_david = ProjectMember(project_id=p2.id, user_id=u_david.id, role="owner")
    m2_alex = ProjectMember(project_id=p2.id, user_id=u_alex.id, role="admin")
    db.add_all([m2_david, m2_alex])

    c2_backlog = BoardColumn(project_id=p2.id, name="Backlog", color="#94A3B8", order=0)
    c2_prog = BoardColumn(project_id=p2.id, name="In Execution", color="#38BDF8", order=1)
    c2_done = BoardColumn(project_id=p2.id, name="Completed", color="#34D399", order=2)
    db.add_all([c2_backlog, c2_prog, c2_done])
    db.flush()

    t_p2_1 = Task(
        project_id=p2.id,
        column_id=c2_prog.id,
        title="Automated Zero-Downtime Rollouts with Health Checks",
        description="Blue-Green strategy with synthetic smoke tests before routing traffic.",
        priority="urgent",
        due_date=datetime.utcnow() + timedelta(days=3),
        order=0,
        created_by_id=u_david.id
    )
    t_p2_1.assignees = [u_david]
    db.add(t_p2_1)

    # Activity logs
    db.add(Activity(project_id=p1.id, user_id=u_alex.id, action_type="project_created", description="created project 'Apollo Mobile App 2.0'"))
    db.add(Activity(project_id=p1.id, user_id=u_david.id, action_type="task_moved", description="moved 'Real-Time WebSocket Sync Engine' to Done"))

    # Sample notifications
    db.add(Notification(
        user_id=u_alex.id,
        actor_id=u_maya.id,
        project_id=p1.id,
        task_id=t2.id,
        message="Maya Chen commented on 'Revamp Dark Mode & High-Contrast Design Tokens'"
    ))
    db.add(Notification(
        user_id=u_alex.id,
        actor_id=u_david.id,
        project_id=p1.id,
        task_id=t1.id,
        message="David Ross updated task 'Implement Biometric FaceID & Fingerprint Authentication'"
    ))

    db.commit()
    print("Database seeding completed successfully!")
