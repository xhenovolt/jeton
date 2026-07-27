-- Migration 980: Seed permissions for the new invoice engine endpoints.
-- Idempotent — safe to re-run.

INSERT INTO permissions (module, action, name, description, route_path, method)
VALUES
  ('invoices', 'manage',        'Manage Invoices',       'Create, edit, void, reconcile invoices', '/api/invoices',                'POST'),
  ('invoices', 'manage_themes', 'Manage Invoice Themes', 'Create and edit invoice themes',         '/api/invoices/themes',         'POST'),
  ('invoices', 'export',        'Export Invoices',       'Download invoice HTML/PDF',              '/api/invoices/:id/pdf',        'GET')
ON CONFLICT (module, action) DO NOTHING;

-- Bind to admin + superadmin (superadmin still bypasses in code).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('admin', 'chief_administrator', 'superadmin')
  AND p.module = 'invoices'
  AND p.action IN ('manage', 'manage_themes', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Everyone else who can view invoices also gets export by default.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('manager', 'user', 'intern', 'external_assistant', 'grapics_designer')
  AND p.module = 'invoices'
  AND p.action = 'export'
ON CONFLICT (role_id, permission_id) DO NOTHING;
