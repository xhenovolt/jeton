-- Migration 981: fold knowledge_articles into knowledge_assets
--
-- Two tables held knowledge-base content: knowledge_assets (used by
-- /api/knowledge and the Knowledge Base UI) and knowledge_articles (only
-- used by the unreferenced /api/knowledge-base, now removed). Copy any
-- articles across so nothing is lost. Idempotent: re-running skips rows
-- already copied (matched on title + author + created_at). The old table is
-- left in place; drop it once the copy has been verified in each environment:
--   DROP TABLE knowledge_articles;

DO $$
BEGIN
  IF to_regclass('public.knowledge_articles') IS NULL THEN
    RAISE NOTICE 'knowledge_articles does not exist; nothing to merge';
    RETURN;
  END IF;

  INSERT INTO knowledge_assets (title, category, author_id, visibility, content, status, tags, created_at, updated_at)
  SELECT
    ka.title,
    CASE ka.category
      WHEN 'technical'   THEN 'development_notes'
      WHEN 'operational' THEN 'support_documentation'
      WHEN 'training'    THEN 'support_documentation'
      WHEN 'policy'      THEN 'development_standards'
      ELSE 'other'
    END,
    -- author_id on knowledge_assets references users(id); keep it only if valid
    (SELECT u.id FROM users u WHERE u.id = ka.author_id),
    'internal',
    ka.content,
    CASE WHEN ka.is_published THEN 'active' ELSE 'draft' END,
    COALESCE(ka.tags, '{}'),
    ka.created_at,
    ka.updated_at
  FROM knowledge_articles ka
  WHERE NOT EXISTS (
    SELECT 1 FROM knowledge_assets x
    WHERE x.title = ka.title
      AND x.author_id IS NOT DISTINCT FROM (SELECT u.id FROM users u WHERE u.id = ka.author_id)
      AND x.created_at = ka.created_at
  );
END $$;
