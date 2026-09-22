# Jeton Technical Intelligence System
## Centralized Knowledge Base & System Architecture Documentation

![Status](https://img.shields.io/badge/Status-COMPLETE-green)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![Date](https://img.shields.io/badge/Created-March%202026-purple)

---

## 🎯 OBJECTIVE

Transform Jeton into a **self-documenting system intelligence platform** where every developer understands how systems were built WITHOUT accessing source code or markdown files.

**The Jeton Technical Intelligence System is the source of truth for ALL system architectures.**

---

## ✨ KEY FEATURES

### 1. **Centralized Knowledge Base**
- Store full technical history of every system
- Architecture decisions are queryable
- Developer onboarding without external docs
- Eliminates markdown file dependency

### 2. **System Intelligence Tabs**
- `/app/systems/[id]/intelligence` - Per-system intelligence hub
- Create entries or import markdown files
- Category-based filtering (architecture, features, bugs, etc)
- Full-text search with tags
- Version tracking

### 3. **Global Intelligence Search**
- `/app/tech-intelligence` - Global search across all systems
- Find knowledge across Jeton, Drais, Consty, etc
- Real-time search with relevance ranking
- Tag-based discovery

### 4. **Automatic Markdown Ingestion**
- Convert existing .md files to intelligence entries
- Auto-detect categories from filenames/content
- One-time bulk import OR continuous ingestion
- Deduplication to prevent duplicates

### 5. **Architecture Visualization**
- Tech stack overview (languages, frameworks, tools)
- System module mapping with dependencies
- Version history and release tracking
- Database and deployment info

### 6. **Developer Mode** (Future)
- Internal notes and technical debt tracking
- Architecture warnings
- Performance insights
- Unresolved design issues

---

## 📊 DATABASE SCHEMA

### Tables Created

```sql
system_intelligence
├─ id (UUID)
├─ system_id (UUID → systems.id)
├─ title VARCHAR(500)
├─ category (architecture, feature, bug_fix, deployment, etc)
├─ content TEXT (full markdown/documentation)
├─ summary VARCHAR(1000)
├─ tags TEXT[] (searchable tags)
├─ version_tag VARCHAR(50)
├─ related_issue_id (UUID)
├─ related_module_id (UUID)
├─ created_by / updated_by (UUID → users)
├─ created_at / updated_at TIMESTAMP
└─ is_public BOOLEAN (visibility control)

system_architecture
├─ system_id (UUID → systems.id, UNIQUE)
├─ tech_stack JSONB
├─ platforms TEXT[] (web, mobile, desktop, api)
├─ database_type VARCHAR(100)
├─ hosting_environment VARCHAR(100)
├─ architecture_pattern VARCHAR(200)
├─ authentication_method VARCHAR(200)
└─ deployment_url VARCHAR(500)

system_versions
├─ id (UUID)
├─ system_id (UUID → systems.id)
├─ version_name VARCHAR(100)
├─ version_number VARCHAR(50)
├─ release_notes TEXT
├─ changelog JSONB
├─ has_breaking_changes BOOLEAN
└─ released_at TIMESTAMP

system_intelligence_internal_notes
├─ intelligence_id (UUID → system_intelligence.id)
├─ content TEXT
├─ note_type (warning, insight, todo, decision, technical_debt)
├─ severity (info, warning, critical)
├─ visible_to_role VARCHAR(50)
└─ created_by (UUID → users.id)

markdown_ingestion_jobs
├─ system_id (UUID → systems.id)
├─ job_status (pending, running, completed, failed)
├─ file_path VARCHAR(500)
├─ filename VARCHAR(255)
├─ content TEXT
├─ category_assigned VARCHAR(50)
├─ intelligence_id (UUID → system_intelligence.id)
└─ content_hash VARCHAR(64)
```

---

## 🔌 API ROUTES

### Intelligence CRUD

```
GET    /api/systems/[id]/intelligence
POST   /api/systems/[id]/intelligence
GET    /api/systems/[id]/intelligence/[intelligenceId]
PATCH  /api/systems/[id]/intelligence/[intelligenceId]
DELETE /api/systems/[id]/intelligence/[intelligenceId]
```

### Global Search

```
GET /api/intelligence/search?q=architecture&category=feature&limit=50
```

### Architecture Management

```
GET    /api/systems/[id]/architecture
POST   /api/systems/[id]/architecture
PUT    /api/systems/[id]/architecture
```

### Version Tracking

```
GET    /api/systems/[id]/versions
POST   /api/systems/[id]/versions
```

### Markdown Ingestion

```
POST /api/intelligence/ingest
{
  "systemId": "UUID",
  "files": [
    { "filename": "ARCHITECTURE.md", "content": "..." }
  ],
  "autoDetectCategory": true
}
```

---

## 🚀 USAGE

### 1. Access System Intelligence

Navigate to any system → Click "Intelligence" tab

### 2. Create Intelligence Entry

- Title, Category, Content
- Tags for discoverability
- Public/Private visibility
- Version tagging

### 3. Import Markdown Files

```bash
# Via UI
- Systems page → Intelligence tab → "Import MD Files"
- Select .md files
- Auto-detect categories
- Import!

# Via Script
node scripts/ingest-markdown.mjs "Jeton" .
node scripts/ingest-markdown.mjs "Drais" ./Documentation
```

### 4. Search Across All Systems

Visit `/app/tech-intelligence` → Use global search to find knowledge across all systems

---

## 📜 CATEGORIES

| Category | For | Examples |
|----------|-----|----------|
| **architecture** | System design & structure | ARCHITECTURE.md, DESIGN_DOCS.md |
| **feature** | Feature documentation | FEATURES.md, CAPABILITIES.md |
| **bug_fix** | Bug fixes & hotfixes | FIX_SOMETHING.md, HOTFIX_*.md |
| **deployment** | Release & deployment | DEPLOYMENT_GUIDE.md, RELEASE_NOTES.md |
| **decision** | Architectural decisions | ADR_*.md, DECISION.md |
| **integration** | API & system integration | INTEGRATION_GUIDE.md |
| **performance** | Performance & optimization | PERFORMANCE.md, OPTIMIZATION.md |
| **security** | Security & authentication | SECURITY.md, AUTH_GUIDE.md |
| **api** | API documentation | API_*.md, ENDPOINTS.md |
| **database** | Database schema & migrations | SCHEMA.md, DATABASE.md |
| **guide** | General guides & tutorials | GUIDE.md, QUICK_START.md |
| **troubleshooting** | Troubleshooting & debugging | TROUBLESHOOTING.md, DEBUG.md |

---

## 🔐 RBAC & PERMISSIONS

### Access Control

- **View Intelligence**: `systems.view` permission
- **Create/Edit Intelligence**: `systems.edit` permission
- **Delete Intelligence**: `systems.edit` + ownership or admin
- **Public entries**: Visible to all authenticated users
- **Private entries**: Visible only to creator or admin

### Permission Checks

All API endpoints enforce RBAC via `requirePermission()`:

```javascript
const perm = await requirePermission(request, 'systems.view');
if (perm instanceof NextResponse) return perm;
```

---

## 📋 MIGRATION INFORMATION

### Migration Number: 954

**Tables Created:**
- `system_intelligence` (main knowledge base)
- `system_architecture` (tech stack & deployment info)
- `system_versions` (version & release tracking)
- `system_intelligence_internal_notes` (developer notes)
- `markdown_ingestion_jobs` (ingestion audit log)

**Columns Added to Existing Tables:**
- `systems.has_intelligence` (boolean)
- `systems.intelligence_score` (0-100)
- `systems.last_intelligence_update` (timestamp)

**Indexes Created:** 15+

**Full-Text Search:** Enabled via PostgreSQL tsvector

---

## 🛠️ INGESTION SCRIPT

### Location
`scripts/ingest-markdown.mjs`

### Usage

```bash
# Ingest all MD files for Jeton system
node scripts/ingest-markdown.mjs "Jeton" .

# Ingest specific directory
node scripts/ingest-markdown.mjs "Drais" ./Documentation

# Auto-detect categories from filenames
node scripts/ingest-markdown.mjs "Consty" . --auto-detect
```

### Features

✓ Directory traversal (recursively finds .md & .txt files)
✓ Auto-category detection
✓ Deduplication (prevents duplicate ingestion)
✓ Tag extraction
✓ Summary generation
✓ Progress reporting
✓ Error handling

---

## 🎨 UI COMPONENTS

### SystemIntelligenceTab Component

```javascript
<SystemIntelligenceTab systemId={id} systemName={data.name} />
```

**Features:**
- Create new intelligence entries
- Import markdown files
- Category-based filtering
- Full-text search
- Tag display
- Expand/collapse entries
- Delete entries (with confirmation)

### Tech Intelligence Hub

Location: `/app/tech-intelligence`

**Tabs:**
1. **Search Intelligence** - Global search across all systems
2. **Tech Stacks** - Reusable tech stack management

---

## 🔍 SEARCH FUNCTIONALITY

### Full-Text Search

- Uses PostgreSQL `tsvector` for fast searching
- Searches title, content, and tags
- Relevance ranking
- Pagination support

### Search Filters

- By category
- By tags (array filter)
- By system
- By date range (future)

---

## 📈 INTELLIGENCE SCORING

Each system has an `intelligence_score` (0-100) calculated as:

- +2 for each ingested markdown file
- +5 for each manually created entry
- +0.5 for each search/view
- Capped at 100 (max)

Higher scores indicate more comprehensive documentation.

---

## 🚦 AUTO-CATEGORY DETECTION RULES

The ingestion engine detects categories based on:

1. **Filename patterns** (priority 1)
   - `*architecture*` → architecture
   - `*guide*` → guide
   - `*quick*` → guide
   - `*deploy*` → deployment

2. **Content keywords** (priority 2)
   - First 500 chars analyzed
   - Matches against category patterns
   - Defaults to 'guide' if no match

---

## 📝 BEST PRACTICES

### Creating Intelligence Entries

✓ Use clear, descriptive titles
✓ Add relevant tags for discoverability
✓ Write in markdown format
✓ Include code examples where applicable
✓ Link to related modules/issues
✓ Version-tag important entries

### Importing Markdown

✓ Organize files by category (optional, auto-detected)
✓ Use descriptive filenames
✓ Clean up legacy .md files after import
✓ Run deduplication check first
✓ Verify all entries imported successfully

### Maintaining Intelligence

✓ Keep entries up-to-date with code changes
✓ Archive outdated documentation
✓ Use version tags for major updates
✓ Link issues to architecture changes
✓ Regular reviews (quarterly recommended)

---

## 🔮 FUTURE ENHANCEMENTS

- [ ] Developer Mode with internal notes
- [ ] Performance metrics & analytics
- [ ] AI-powered summary generation
- [ ] Automatic code-to-docs sync
- [ ] Architecture diagram rendering
- [ ] Dependency graph visualization
- [ ] Integration with GitHub/GitLab
- [ ] Slack/Discord notifications
- [ ] Multi-language support
- [ ] Export to PDF/HTML
- [ ] Version diffing
- [ ] Change history viewer

---

## ✅ VALIDATION CHECKLIST

- [x] Database schema created
- [x] API endpoints implemented
- [x] UI components built
- [x] Markdown ingestion engine working
- [x] Global search functional
- [x] RBAC enforced
- [x] Full-text search enabled
- [x] Auto-category detection working
- [x] Deduplication logic in place
- [x] Ingestion script created
- [x] Documentation complete

---

## 📚 DOCUMENTATION RESOURCES

- Migration: `migrations/954_technical_intelligence_system.sql`
- API Routes: `/src/app/api/systems/[id]/intelligence/`
- UI Component: `/src/components/SystemIntelligenceTab.js`
- Scripts: `/scripts/ingest-markdown.mjs`
- Page: `/src/app/app/systems/[id]/page.js`
- Tech Hub: `/src/app/app/tech-intelligence/page.js`

---

## 🎉 IMPACT

**Before:**
- 50+ markdown files scattered across project
- New developers must read source code to understand architecture
- Documentation gets out of sync with code
- No centralized knowledge base
- Difficult to find information

**After:**
- Single source of truth in Jeton database
- Searchable, categorized intelligence
- Auto-generated from existing docs
- Version-tracked
- Accessible to all team members
- Developer onboarding in minutes

---

## 📞 SUPPORT

For issues or questions:
1. Check existing intelligence entries
2. Search the knowledge base
3. Create a new intelligence entry with your question
4. Tag it with "question" or "help-needed"

---

**Status: PRODUCTION READY** ✨

This system is fully implemented, tested, and ready for deployment. All markdown files should be imported into the intelligence system for centralized knowledge management.
