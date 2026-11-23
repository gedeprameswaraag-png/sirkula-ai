const { z } = require('zod');

const SEVERITIES = ['ringan', 'sedang', 'parah'];

const verifyReportSchema = z.object({
  approved: z.boolean(),
  title: z.string().trim().max(100).optional(),
  severity_level: z.enum(SEVERITIES).optional(),
  impact_score: z.coerce.number().min(0).max(100).optional(),
  primary_category: z.string().trim().max(50).optional()
});

const verifyVolunteerSchema = z.object({
  status: z.enum(['verified', 'rejected'], { errorMap: () => ({ message: 'Status harus verified atau rejected.' }) })
});

const approveTaskSchema = z.object({
  approved: z.boolean(),
  review_notes: z.string().trim().max(500).optional()
});

const reportStatusQuery = z.object({
  status: z.enum(['analysis_completed', 'needs_review', 'verified', 'rejected']).optional()
});

module.exports = { verifyReportSchema, verifyVolunteerSchema, approveTaskSchema, reportStatusQuery };
