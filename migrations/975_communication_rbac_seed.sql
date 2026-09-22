-- Migration 975: Seed communication permissions + assign to all real roles.
-- Idempotent. Depends on 957 (comm tables) and the base permissions table.
--
-- Why this exists: migration 953 originally seeded 12 comm permissions and
-- assigned them to role names 'Staff','Manager','Admin','Superadmin' — but
-- the real roles table uses lowercase names ('admin','manager','user',…),
-- so the seed inserted nothing. Live DB had only ONE `communication` row
-- (`action='admin'`) and ZERO role_permissions bindings, meaning every
-- non-superadmin got 403 from every /api/communication/* route.
--
-- This migration re-seeds the permissions with the exact `action` slugs
-- that the code checks against (`communication.view_conversations`, etc.)
-- and binds them to every non-viewer role. Superadmin bypasses in code.

-- ── 1. Ensure communication permissions exist ────────────────────────────
INSERT INTO permissions (module, action, name, description, route_path, method)
VALUES
  ('communication', 'view_conversations',       'View Conversations',      'View own conversation list',          '/api/communication/conversations',        'GET'),
  ('communication', 'create_conversation',      'Create Conversation',     'Start a direct or group chat',        '/api/communication/conversations',        'POST'),
  ('communication', 'delete_conversation',      'Delete Conversation',     'Soft-delete a conversation',          '/api/communication/conversations/:id',    'DELETE'),
  ('communication', 'send_message',             'Send Message',            'Send text or media message',          '/api/communication/messages',             'POST'),
  ('communication', 'edit_message',             'Edit Message',            'Edit own message',                    '/api/communication/messages/:id',         'PUT'),
  ('communication', 'delete_message',           'Delete Message',          'Delete own message',                  '/api/communication/messages/:id',         'DELETE'),
  ('communication', 'manage_participants',      'Manage Participants',     'Add/remove group members',            '/api/communication/participants',         'POST'),
  ('communication', 'start_call',               'Start Call',              'Initiate audio/video call',           '/api/communication/calls',                'POST'),
  ('communication', 'upload_media',             'Upload Media',            'Upload images/files/audio/video',     '/api/communication/upload',               'POST'),
  ('communication', 'view_all_conversations',   'View All Conversations',  'Admin: view every conversation',      '/api/communication/conversations/admin',  'GET'),
  ('communication', 'manage_media_permissions', 'Manage Media Permissions','Admin: allowed file types & limits',  '/api/communication/admin/settings',       'PUT'),
  ('communication', 'manage_call_permissions',  'Manage Call Permissions', 'Admin: control call features',        '/api/communication/admin/settings',       'PUT')
ON CONFLICT (module, action) DO NOTHING;

-- ── 2. Bind base permissions to every "real user" role ──────────────────
-- All roles EXCEPT viewer get baseline messaging: view/create/send/edit/delete
-- own conversations + messages, participate in calls, upload media.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'communication'
  AND p.action IN (
    'view_conversations',
    'create_conversation',
    'delete_conversation',
    'send_message',
    'edit_message',
    'delete_message',
    'manage_participants',
    'start_call',
    'upload_media'
  )
  AND r.name NOT IN ('viewer')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ── 3. Viewer gets read-only ────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'viewer'
  AND p.module = 'communication'
  AND p.action = 'view_conversations'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ── 4. Admin-only perms ─────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('admin', 'chief_administrator')
  AND p.module = 'communication'
  AND p.action IN (
    'view_all_conversations',
    'manage_media_permissions',
    'manage_call_permissions'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
