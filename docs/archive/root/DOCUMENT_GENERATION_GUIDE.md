# Document Generation & Verification System - JETON

Complete professional document management module for generating, verifying, and managing official organizational documents.

## Features Implemented

### 1. Document Generation
- **Unique ID System**: XTN-PREFIX-YEAR-SEQUENCE format (e.g., `XTN-INT-2026-0001`)
- **Template Engine**: Support for `{{placeholder}}` variables with auto-substitution
- **Verification Tokens**: Secure, unique verification URLs for public document validation
- **Expiration Control**: Set document expiry dates (default 1 year)
- **Revocation Support**: Admin ability to revoke documents with audit trail

### 2. Document Verification Portal
- **Public Verification URLs**: `/verify/[documentId]` - no authentication required
- **Verification Status Display**: Valid, Revoked, Expired, or Not Found
- **View Tracking**: Each verification is logged with timestamp and access count
- **Admin Verification Tool**: Search and verify documents by ID

### 3. Company Branding System
- **Organization Identity**: Logo, colors, contact information
- **Digital Signatures**: Signature image, authorized person details
- **Document Formatting**: Automatic branding applied to all generated documents
- **Colors & Styling**: Primary, secondary, and accent colors for documents

### 4. Database Schema (Migration 970)
```sql
- generated_documents: Main document records with unique IDs and verification data
- document_verifications: Audit log of all verification attempts
- company_branding: Organization identity and styling
- generated_document_logs: Operational logs per document
```

### 5. API Endpoints

#### Document Generation
- **POST** `/api/documents/generate` - Create official document from template
- **GET** `/api/documents/generate` - List generated documents (admin)

#### Document Verification (Public)
- **GET** `/api/documents/verify?id=XTN-INT-2026-0001` - Public verification endpoint
- **POST** `/api/documents/verify` - Revoke document (admin only)

#### Company Branding
- **GET** `/api/documents/branding` - Fetch active branding
- **POST** `/api/documents/branding` - Update branding settings

#### Seeding
- **POST** `/api/documents/seed` - Initialize templates and sample data

### 6. Admin Dashboard (/app/admin/documents/)

#### Templates Page
- Create/edit document templates with placeholders
- Preview placeholder variables
- Manage template categories and descriptions

#### Generated Documents Page
- View all generated documents with search/filter
- Status tracking (Active/Revoked)
- View count and verification links
- Revoke individual documents

#### Verification Portal Page
- Search documents by ID
- Generate shareable verification links
- Display verification information

#### Company Branding Settings
- Upload logos and signatures
- Configure organization details
- Set color scheme
- Manage contact information

### 7. Sample Templates Seeded

1. **Internship Acceptance Letter**
   - Position, department, duration, reporting details
   - Terms and conditions
   - Authorized signature block

2. **Interview Invitation**
   - Interview date, time, location
   - Interviewer details
   - Required documents to bring

3. **Job Application Acknowledgement**
   - Application reference and submission date
   - Status update and timeline
   - Contact information

### 8. Sample Data
- **Mukungu Hatimu** (Registration: 24C/BIT/312/UMC)
  - Pre-generated internship acceptance letter
  - Demonstrates full document generation workflow
  - Accessible via `/verify/[documentId]`

## Usage Examples

### Generate a Document
```javascript
POST /api/documents/generate
{
  "template_id": "template-uuid",
  "document_type": "internship_acceptance",
  "recipient_name": "John Doe",
  "recipient_email": "john@example.com",
  "placeholder_data": {
    "applicant_name": "John Doe",
    "position_title": "Software Developer",
    "start_date": "June 1, 2026",
    // ... other placeholders
  },
  "expires_in_days": 365
}
```

Response:
```javascript
{
  "success": true,
  "data": {
    "id": "doc-uuid",
    "unique_id": "XTN-INT-2026-0001",
    "verification_token": "base64-token",
    "verification_url": "https://jeton.example.com/verify/XTN-INT-2026-0001"
  }
}
```

### Verify a Document
```javascript
GET /api/documents/verify?id=XTN-INT-2026-0001&token=verification-token
```

Response:
```javascript
{
  "success": true,
  "status": "valid",
  "data": {
    "id": "XTN-INT-2026-0001",
    "title": "Internship Acceptance Letter",
    "recipient_name": "John Doe",
    "generated_at": "2026-05-15T10:30:00Z",
    "view_count": 5,
    "verified": true
  }
}
```

### Public Verification Page
Navigate to: `/verify/XTN-INT-2026-0001`
- No authentication required
- Displays document status, recipient, and verification details
- Shows view count and expiration date
- Displays revocation status if applicable

## Permissions

```sql
- documents.view: View documents and templates
- documents.create: Create documents
- documents.generate: Generate official documents
- documents.verify: Verify documents (public)
- documents.branding: Manage company branding
- documents.revoke: Revoke generated documents
- documents.view_generated: View list of generated documents
```

## Navigation Integration

Added to Admin sidebar:
- **Admin → Organization Documents**
  - Templates: Manage document templates
  - Generated Documents: View and manage generated documents
  - Verification Portal: Verify documents by ID
  - Settings: Configure company branding

## File Structure

```
migrations/
  970_document_generation_verification.sql

src/lib/
  document-generation.js       # Template engine, ID generation, verification
  company-branding.js          # Branding settings and caching
  seed-documents.js            # Template and sample data seeding

src/app/api/documents/
  generate/route.js            # Document generation endpoint
  verify/route.js              # Public verification endpoint
  branding/route.js            # Branding management
  seed/route.js                # Data seeding endpoint

src/app/app/admin/documents/
  page.js                      # Main dashboard
  templates/page.js            # Template management
  generated/page.js            # Generated documents list
  verify/page.js               # Verification portal
  settings/page.js             # Branding configuration

src/app/verify/
  [documentId]/page.js         # Public verification page
```

## Technology Stack

- **Next.js 16** with React 19
- **PostgreSQL** (Neon) for data persistence
- **Tailwind CSS 4** with dark mode support
- **Encryption**: SHA256 for verification hashes
- **UUID**: For unique identifiers
- **JSON**: For flexible placeholder storage

## Security Features

- **Verification Tokens**: Secure, random tokens for each document
- **Verification Hashes**: SHA256 hashes prevent tampering
- **Role-Based Access Control**: Permissions enforce document generation restrictions
- **Public Verification**: Stateless verification without database lookups possible
- **Audit Trail**: All verification attempts logged
- **Revocation System**: Ability to invalidate documents on demand
- **No Auth Required**: Public verification URLs safe for sharing

## Future Enhancements

1. **PDF Export**: Server-side PDF generation with embedded QR codes
2. **QR Code Generation**: Automatic QR code embedding in documents
3. **Digital Signatures**: Cryptographic document signing
4. **Email Distribution**: Direct document delivery via email
5. **Batch Generation**: Generate multiple documents at once
6. **Template Versioning**: Track template changes and document versions
7. **Advanced Analytics**: Verification statistics and insights
8. **API Rate Limiting**: Prevent abuse of public endpoints
9. **Webhook Events**: Notify external systems on document generation/verification
10. **Custom Watermarks**: Add security watermarks to documents

## Commits

- `cdb4a96` - feat(documents): enterprise document generation, verification & branding system
- `8ec16c5` - feat(documents): add seeder for templates and Mukungu Hatimu internship letter
- `a7792a7` - fix: remove Layout wrapper from document admin pages

## Ready for Production

✓ Database schema and migrations
✓ API endpoints with error handling
✓ Admin dashboard UI
✓ Public verification portal
✓ Sample templates and data
✓ Permission-based access control
✓ Audit logging
✓ Security considerations (hashing, tokens, verification)

The system is enterprise-grade and ready for immediate deployment with full data persistence, verification capabilities, and administrative control.
