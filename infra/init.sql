-- KickStack Database Initialization Script
-- Creates initial schema for SQLite

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table (managed by GoTrue)
CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    instance_id TEXT,
    aud TEXT,
    role TEXT,
    email TEXT UNIQUE,
    encrypted_password TEXT,
    email_confirmed_at DATETIME,
    invited_at DATETIME,
    confirmation_token TEXT,
    confirmation_sent_at DATETIME,
    recovery_token TEXT,
    recovery_sent_at DATETIME,
    email_change_token_new TEXT,
    email_change TEXT,
    email_change_sent_at DATETIME,
    last_sign_in_at DATETIME,
    raw_app_meta_data TEXT,
    raw_user_meta_data TEXT,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    phone TEXT,
    phone_confirmed_at DATETIME,
    phone_change TEXT,
    phone_change_token TEXT,
    phone_change_sent_at DATETIME,
    email_change_token_current TEXT,
    email_change_confirm_status INTEGER DEFAULT 0,
    banned_until DATETIME,
    reauthentication_token TEXT,
    reauthentication_sent_at DATETIME,
    is_sso_user BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME
);

-- Refresh tokens table (managed by GoTrue)
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE,
    user_id TEXT REFERENCES auth_users(id) ON DELETE CASCADE,
    instance_id TEXT,
    parent TEXT,
    session_id TEXT,
    revoked BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table (managed by GoTrue)
CREATE TABLE IF NOT EXISTS auth_audit_log_entries (
    id TEXT PRIMARY KEY,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT
);

-- Identities table (for social auth - managed by GoTrue)
CREATE TABLE IF NOT EXISTS auth_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES auth_users(id) ON DELETE CASCADE,
    identity_data TEXT,
    provider TEXT,
    last_sign_in_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (managed by GoTrue)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    factor_id TEXT,
    aal TEXT,
    not_after DATETIME
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_instance_id ON auth_users(instance_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_token ON auth_refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

-- Sample application tables for API demonstration
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT REFERENCES auth_users(id),
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    assigned_to TEXT REFERENCES auth_users(id),
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Files metadata table (references MinIO storage)
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT,
    size INTEGER,
    uploaded_by TEXT REFERENCES auth_users(id),
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bucket, object_key)
);

-- Create indexes for application tables
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);