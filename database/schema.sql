PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('staff', 'admin', 'super_admin')),
    real_name TEXT NOT NULL,
    phone TEXT,
    status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    floor TEXT,
    building TEXT,
    description TEXT,
    status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkpoint_id INTEGER NOT NULL,
    frequency_minutes INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    active_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    window_minutes INTEGER NOT NULL DEFAULT 30,
    status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
);

CREATE TABLE IF NOT EXISTS inspection_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    checkpoint_id INTEGER NOT NULL,
    due_time TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'overdue')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (schedule_id) REFERENCES task_schedules(id),
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
);

CREATE TABLE IF NOT EXISTS inspection_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL UNIQUE,
    inspector_id INTEGER NOT NULL,
    checkpoint_id INTEGER NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    compliance_status TEXT NOT NULL DEFAULT 'on_time' CHECK(compliance_status IN ('on_time', 'anomaly')),
    gps_lat REAL,
    gps_lng REAL,
    gps_accuracy REAL,
    device_info TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending', 'approved', 'punished')),
    review_comment TEXT,
    reviewer_id INTEGER,
    reviewed_at TEXT,
    FOREIGN KEY (task_id) REFERENCES inspection_tasks(id),
    FOREIGN KEY (inspector_id) REFERENCES users(id),
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS record_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    item_name TEXT NOT NULL,
    input_type TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY (record_id) REFERENCES inspection_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS record_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    original_name TEXT,
    file_size INTEGER,
    watermark_info TEXT,
    taken_at TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES inspection_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_checkpoint_status ON inspection_tasks(checkpoint_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_time ON inspection_tasks(due_time);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON inspection_tasks(status);
CREATE INDEX IF NOT EXISTS idx_records_submitted ON inspection_records(submitted_at);
CREATE INDEX IF NOT EXISTS idx_records_inspector ON inspection_records(inspector_id);
CREATE INDEX IF NOT EXISTS idx_records_checkpoint ON inspection_records(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_records_compliance ON inspection_records(compliance_status);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON task_schedules(status);

CREATE TABLE IF NOT EXISTS inspect_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_key TEXT NOT NULL UNIQUE,
    item_name TEXT NOT NULL,
    input_type TEXT NOT NULL CHECK(input_type IN ('radio', 'text')),
    options TEXT,
    required INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS area_inspect_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inspect_items(id) ON DELETE CASCADE,
    UNIQUE(area_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_area_inspect_items_area ON area_inspect_items(area_id);
CREATE INDEX IF NOT EXISTS idx_inspect_items_default ON inspect_items(is_default);
