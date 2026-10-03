-- 988_seed_media_permissions.sql
--
-- WHY THIS EXISTS
--
-- Every route under /api/media enforces `media.view` or `media.manage`, and
-- neither has a row in `permissions`. hasPermission() resolves a grant by
-- (module, action), so a permission with no row can never be granted to any
-- role: the media library 403s for every non-superadmin, and the Media
-- navigation entry is invisible to them.
--
-- 981_seed_missing_permissions.sql covers these two as part of a larger set.
-- They are repeated here so the media work is self-contained and can be
-- applied on its own; both migrations are idempotent, so running either or
-- both is safe.
--
-- SAFETY
--
-- Additive and idempotent. Defines permissions only — nothing is inserted into
-- role_permissions, so no user gains access until an administrator grants it.

INSERT INTO permissions (module, action, name, description, route_path) VALUES
  ('media', 'view',   'media_view',   'View the media library',                   '/api/media'),
  ('media', 'manage', 'media_manage', 'Upload, edit and delete media',            '/api/media'),
  ('media', 'upload', 'media_upload', 'Upload files to the media library',        '/api/media/upload'),
  ('media', 'delete', 'media_delete', 'Delete media records',                     '/api/media')
ON CONFLICT (module, action) DO NOTHING;
