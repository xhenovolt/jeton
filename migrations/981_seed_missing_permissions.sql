-- 981_seed_missing_permissions.sql
--
-- WHY THIS EXISTS
--
-- An audit cross-referenced every permission string enforced by the API
-- (requirePermission(...) across 291 route files) and every permission
-- referenced by src/lib/navigation-config.js against the `permissions` table.
--
-- 36 permission strings had NO ROW in the table.
--
-- permissions.hasPermission() resolves a grant by (module, action). With no
-- row, a permission can never be granted to any role, so:
--   * 104 API route files returned 403 for every non-superadmin user, and
--   * the matching navigation entries were invisible to them.
--
-- superadmin bypasses the check entirely (permissions.js returns early), which
-- is why these features appeared to work for the founder account while being
-- broken for everyone else. That asymmetry is what made this hard to spot.
--
-- 13 modules were absent outright: allocations, bug_tracking, decision_logs,
-- drais, hrm, integrations, intelligence, issue_intelligence, knowledge, media,
-- obligations, offerings, pricing.
--
-- SAFETY
--
-- Additive and idempotent. This only DEFINES permissions so they become
-- grantable; it inserts nothing into role_permissions, so no user gains access
-- until an administrator grants it. Re-running is a no-op.
--
-- AFTER RUNNING: grant the relevant permissions to the appropriate roles
-- (admin / manager / staff) on the roles screen. Until then, behaviour for
-- non-superadmin users is unchanged.

INSERT INTO permissions (module, action, name, description, route_path) VALUES
  -- Decision log / activity feed  (/app/decision-log, /app/activity)
  ('activity_logs',     'view',         'activity_logs_view',        'View activity and decision logs',                   '/api/activity'),
  ('decision_logs',     'view',         'decision_logs_view',        'View decision log',                                 '/app/decision-log'),

  -- Technology / system architecture  (/app/tech-intelligence, /app/systems)
  ('systems',           'edit',         'systems_edit',              'Edit system records, architecture and tech stack',  '/api/systems'),
  ('systems',           'delete',       'systems_delete',            'Delete system records and tech entries',            '/api/systems'),
  ('intelligence',      'view',         'intelligence_view',         'View intelligence dashboards',                      '/api/intelligence/dashboard'),
  ('issue_intelligence','view',         'issue_intelligence_view',   'View issue intelligence',                           '/app/issue-intelligence'),
  ('bug_tracking',      'view',         'bug_tracking_view',         'View bug and feature tracking',                     '/app/engineering'),

  -- Documents  (/app/documents)
  ('documents',         'manage',       'documents_manage',          'Manage documents, folders and templates',           '/api/documents'),

  -- Pricing and plans  (/app/pricing)
  ('pricing',           'view',         'pricing_view',              'View pricing plans',                                '/api/pricing'),
  ('pricing',           'create',       'pricing_create',            'Create pricing plans',                              '/api/pricing'),
  ('pricing',           'update',       'pricing_update',            'Update pricing plans and cycles',                   '/api/pricing'),
  ('pricing',           'delete',       'pricing_delete',            'Delete pricing plans and cycles',                   '/api/pricing'),

  -- Subscriptions  (/app/subscriptions)
  ('subscriptions',     'view',         'subscriptions_view',        'View subscriptions',                                '/api/subscriptions'),
  ('subscriptions',     'create',       'subscriptions_create',      'Create subscriptions',                              '/api/subscriptions'),
  ('subscriptions',     'update',       'subscriptions_update',      'Change subscriptions',                              '/api/subscriptions'),
  ('subscriptions',     'cancel',       'subscriptions_cancel',      'Cancel subscriptions',                              '/api/subscriptions'),
  ('subscriptions',     'billing_view', 'subscriptions_billing_view','View subscription billing',                         '/api/subscriptions'),

  -- DRAIS control plane
  ('drais',             'view',         'drais_view',                'View DRAIS schools and health',                     '/api/drais'),
  ('drais',             'edit',         'drais_edit',                'Edit DRAIS schools and pricing',                    '/api/drais'),
  ('drais',             'control',      'drais_control',             'Activate, suspend and reconcile DRAIS',             '/api/drais'),

  -- Integrations / external connections
  ('integrations',      'view',         'integrations_view',         'View integrations and connections',                 '/api/integrations'),
  ('integrations',      'create',       'integrations_create',       'Create integrations',                               '/api/integrations'),
  ('integrations',      'edit',         'integrations_edit',         'Edit integrations and rotate keys',                 '/api/integrations'),
  ('integrations',      'delete',       'integrations_delete',       'Delete integrations',                               '/api/integrations'),

  -- Knowledge base
  ('knowledge',         'view',         'knowledge_view',            'View knowledge base',                               '/api/knowledge'),
  ('knowledge',         'manage',       'knowledge_manage',          'Manage knowledge base',                             '/api/knowledge'),

  -- Media library
  ('media',             'view',         'media_view',                'View media library',                                '/api/media'),
  ('media',             'manage',       'media_manage',              'Manage media library',                              '/api/media'),

  -- Offerings
  ('offerings',         'view',         'offerings_view',            'View offerings',                                    '/api/offerings'),
  ('offerings',         'manage',       'offerings_manage',          'Manage offerings',                                  '/api/offerings'),

  -- HR / staff / client / finance gaps
  ('hrm',               'view',         'hrm_view',                  'View HR module',                                    '/app/hrm'),
  ('staff',             'edit',         'staff_edit',                'Edit staff accounts and payouts',                   '/api/employee-accounts'),
  ('clients',           'edit',         'clients_edit',              'Edit clients',                                      '/api/clients'),
  ('finance',           'delete',       'finance_delete',            'Delete financial accounts',                         '/api/accounts'),
  ('allocations',       'view',         'allocations_view',          'View capital allocations',                          '/app/allocations'),
  ('obligations',       'view',         'obligations_view',          'View client obligations',                            '/app/obligations')
ON CONFLICT (module, action) DO NOTHING;
