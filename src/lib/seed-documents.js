import { query } from '@/lib/db.js';
import {
  generateUniqueDocumentId,
  substitutePlaceholders,
  generateVerificationToken,
  generateVerificationHash,
  formatDocumentWithBranding,
  logDocumentGeneration,
} from '@/lib/document-generation.js';

export async function seedDocumentTemplates() {
  try {
    // Check if templates already exist
    const existing = await query(
      `SELECT COUNT(*) as count FROM document_templates WHERE category = 'internship'`
    );

    if (existing.rows[0].count > 0) {
      console.log('Templates already seeded');
      return { success: true, message: 'Templates already exist' };
    }

    // Template 1: Internship Acceptance Letter
    const internshipTemplate = `
<h2 style="color: #1F2937; text-align: center; margin-bottom: 30px;">
  INTERNSHIP ACCEPTANCE LETTER
</h2>

<p style="margin-bottom: 20px;">{{issue_date}}</p>

<p style="margin-bottom: 20px;">
  <strong>{{applicant_name}}</strong><br>
  Registration No: {{registration_number}}<br>
  Email: {{applicant_email}}<br>
  Phone: {{applicant_phone}}
</p>

<p style="margin-bottom: 20px;">Dear {{applicant_name}},</p>

<p style="margin-bottom: 20px;">
  <strong>RE: INTERNSHIP ACCEPTANCE LETTER</strong>
</p>

<p style="margin-bottom: 20px;">
  We are pleased to inform you that your application for an internship position with our organization has been accepted.
  This letter is to formally confirm your acceptance into our internship program.
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">Program Details:</h3>

<p style="margin-bottom: 10px;">
  <strong>Position:</strong> {{position_title}}<br>
  <strong>Department:</strong> {{department}}<br>
  <strong>Duration:</strong> {{start_date}} to {{end_date}}<br>
  <strong>Mode:</strong> {{mode_of_work}}<br>
  <strong>Supervisor:</strong> {{supervisor_name}}
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">Terms and Conditions:</h3>

<ul style="margin-bottom: 20px;">
  <li>You are expected to arrive on {{start_date}} at {{reporting_time}}</li>
  <li>The internship is unpaid and offered for skill development purposes</li>
  <li>You must maintain professional conduct and adhere to company policies</li>
  <li>Confidentiality agreements must be signed upon arrival</li>
  <li>Regular attendance is mandatory</li>
  <li>A completion certificate will be issued upon successful completion</li>
</ul>

<p style="margin-bottom: 20px;">
  Please confirm your acceptance by signing and returning this letter within 5 days of receipt.
  Should you have any questions or require clarification on any matter, please do not hesitate to contact us.
</p>

<p style="margin-bottom: 20px;">
  We look forward to welcoming you to our team and providing you with valuable experience and mentorship during your internship.
</p>

<p style="margin-bottom: 20px;">
  Yours sincerely,
</p>

<p style="margin-top: 50px;">
  <strong>{{approver_name}}</strong><br>
  {{approver_title}}<br>
  {{organization_name}}
</p>
    `;

    const result1 = await query(
      `INSERT INTO document_templates (
        name, description, category, body, body_format, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Internship Acceptance Letter',
        'Official internship acceptance letter with terms and conditions',
        'internship',
        internshipTemplate,
        'html',
        JSON.stringify([
          'applicant_name',
          'registration_number',
          'applicant_email',
          'applicant_phone',
          'issue_date',
          'position_title',
          'department',
          'start_date',
          'end_date',
          'mode_of_work',
          'supervisor_name',
          'reporting_time',
          'approver_name',
          'approver_title',
          'organization_name',
        ]),
        null,
      ]
    );

    // Template 2: Interview Invitation
    const interviewTemplate = `
<h2 style="color: #1F2937; text-align: center; margin-bottom: 30px;">
  INTERVIEW INVITATION
</h2>

<p style="margin-bottom: 20px;">
  <strong>{{applicant_name}}</strong><br>
  Email: {{applicant_email}}<br>
  Phone: {{applicant_phone}}
</p>

<p style="margin-bottom: 20px;">Dear {{applicant_name}},</p>

<p style="margin-bottom: 20px;">
  Congratulations! Your application has been shortlisted for an interview with our organization.
  We are impressed by your qualifications and would like to learn more about you.
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">Interview Details:</h3>

<p style="margin-bottom: 20px;">
  <strong>Position:</strong> {{position_title}}<br>
  <strong>Date:</strong> {{interview_date}}<br>
  <strong>Time:</strong> {{interview_time}}<br>
  <strong>Location:</strong> {{interview_location}}<br>
  <strong>Duration:</strong> Approximately {{interview_duration}} minutes<br>
  <strong>Interviewer:</strong> {{interviewer_name}}
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">What to Bring:</h3>

<ul style="margin-bottom: 20px;">
  <li>Original identification documents</li>
  <li>Copies of relevant certificates and qualifications</li>
  <li>Any portfolio or work samples</li>
  <li>Completed application form</li>
</ul>

<p style="margin-bottom: 20px;">
  Please confirm your attendance by replying to this email within 48 hours.
  Should you be unable to attend on the scheduled date, please inform us as soon as possible.
</p>

<p style="margin-bottom: 20px;">
  We look forward to meeting with you.
</p>

<p style="margin-bottom: 20px;">
  Best regards,
</p>

<p style="margin-top: 50px;">
  {{hr_name}}<br>
  Human Resources Department<br>
  {{organization_name}}
</p>
    `;

    await query(
      `INSERT INTO document_templates (
        name, description, category, body, body_format, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Interview Invitation',
        'Formal interview invitation letter with date, time, and location',
        'employment',
        interviewTemplate,
        'html',
        JSON.stringify([
          'applicant_name',
          'applicant_email',
          'applicant_phone',
          'position_title',
          'interview_date',
          'interview_time',
          'interview_location',
          'interview_duration',
          'interviewer_name',
          'hr_name',
          'organization_name',
        ]),
        null,
      ]
    );

    // Template 3: Job Application Acknowledgement
    const ackTemplate = `
<h2 style="color: #1F2937; text-align: center; margin-bottom: 30px;">
  APPLICATION ACKNOWLEDGEMENT
</h2>

<p style="margin-bottom: 20px;">
  <strong>{{applicant_name}}</strong><br>
  Registration No: {{registration_number}}<br>
  Email: {{applicant_email}}
</p>

<p style="margin-bottom: 20px;">Dear {{applicant_name}},</p>

<p style="margin-bottom: 20px;">
  Thank you for submitting your application for the position of <strong>{{position_title}}</strong> with {{organization_name}}.
  We appreciate your interest in joining our organization.
</p>

<h3 style="color: #1F2937; margin-top: 25px; margin-bottom: 15px;">Application Reference:</h3>

<p style="margin-bottom: 20px;">
  <strong>Reference Number:</strong> {{application_reference}}<br>
  <strong>Submitted Date:</strong> {{submission_date}}<br>
  <strong>Expected Review Period:</strong> {{review_period}} days
</p>

<p style="margin-bottom: 20px;">
  We have received your application and it is currently under review. Our selection process involves multiple stages,
  and shortlisted candidates will be contacted for further evaluation.
</p>

<p style="margin-bottom: 20px;">
  We appreciate your patience and will keep you updated on the status of your application.
  If your profile matches our requirements, we will contact you directly.
</p>

<p style="margin-bottom: 20px;">
  Thank you for considering {{organization_name}} as your potential employer.
</p>

<p style="margin-bottom: 20px;">
  Best regards,
</p>

<p style="margin-top: 50px;">
  {{hr_name}}<br>
  Human Resources Department<br>
  {{organization_name}}
</p>
    `;

    await query(
      `INSERT INTO document_templates (
        name, description, category, body, body_format, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        'Application Acknowledgement',
        'Application receipt and processing confirmation letter',
        'employment',
        ackTemplate,
        'html',
        JSON.stringify([
          'applicant_name',
          'registration_number',
          'applicant_email',
          'position_title',
          'organization_name',
          'application_reference',
          'submission_date',
          'review_period',
          'hr_name',
        ]),
        null,
      ]
    );

    return {
      success: true,
      message: 'Templates seeded successfully',
      count: 3,
    };
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
}

export async function seedMukunguHatimu() {
  try {
    // Check if already seeded
    const existing = await query(
      `SELECT COUNT(*) FROM generated_documents WHERE recipient_name = 'Mukungu Hatimu'`
    );

    if (existing.rows[0].count > 0) {
      return { success: true, message: 'Mukungu Hatimu document already exists' };
    }

    // Get the internship template
    const templateRes = await query(
      `SELECT id FROM document_templates WHERE name = 'Internship Acceptance Letter' LIMIT 1`
    );

    if (!templateRes.rows[0]) {
      // Seed templates first
      await seedDocumentTemplates();
      return seedMukunguHatimu(); // Recursive call
    }

    const templateId = templateRes.rows[0].id;

    // Get active branding
    const brandingRes = await query(
      `SELECT id FROM document_branding WHERE is_active = TRUE LIMIT 1`
    );
    const brandingId = brandingRes.rows[0]?.id;

    // Document generation functions already imported at top

    const uniqueId = await generateUniqueDocumentId('INT', query);
    const verificationToken = generateVerificationToken();
    const verificationHash = generateVerificationHash(uniqueId);

    const placeholderData = {
      applicant_name: 'Mukungu Hatimu',
      registration_number: '24C/BIT/312/UMC',
      applicant_email: 'mukungu.hatimu@university.ac.ug',
      applicant_phone: '+256 700 123456',
      issue_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      position_title: 'Software Development Intern',
      department: 'Engineering & Technology',
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      mode_of_work: 'Hybrid (3 days on-site, 2 days remote)',
      supervisor_name: 'Sarah Johnson',
      reporting_time: '09:00 AM',
      approver_name: 'Dr. James Smith',
      approver_title: 'Director of Human Resources',
      organization_name: 'Xhenvolt Technologies',
    };

    const result = await query(
      `INSERT INTO generated_documents (
        template_id, branding_id, unique_id, title, document_type,
        recipient_name, recipient_email, recipient_phone,
        placeholder_data, verification_token, verification_hash,
        generated_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        templateId,
        brandingId,
        uniqueId,
        'Internship Acceptance Letter - Mukungu Hatimu',
        'internship_acceptance',
        'Mukungu Hatimu',
        'mukungu.hatimu@university.ac.ug',
        '+256 700 123456',
        JSON.stringify(placeholderData),
        verificationToken,
        verificationHash,
        null, // No specific user
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      ]
    );

    return {
      success: true,
      message: 'Mukungu Hatimu internship acceptance letter generated',
      document_id: result.rows[0].unique_id,
      verification_url: `/verify/${result.rows[0].unique_id}`,
    };
  } catch (error) {
    console.error('Mukungu seed error:', error);
    throw error;
  }
}
