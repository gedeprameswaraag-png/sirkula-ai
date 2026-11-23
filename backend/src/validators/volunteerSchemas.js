const { z } = require('zod');

const claimSchema = z.object({
  group_id: z.string().uuid().nullable().optional()
});

const completeTaskSchema = z.object({
  actual_weight_kg: z.coerce.number().min(0).max(5000).optional().default(0),
  // Frontend mengirim "completion_notes"; "notes" tetap diterima untuk kompatibilitas
  completion_notes: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional()
});

const createGroupSchema = z.object({
  name: z.string().trim().min(3, 'Nama grup minimal 3 karakter.').max(60),
  description: z.string().trim().max(300).optional().default('')
});

module.exports = { claimSchema, completeTaskSchema, createGroupSchema };
