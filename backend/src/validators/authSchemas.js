const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Format email tidak valid.').max(254);

const password = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
  .regex(/[0-9]/, 'Kata sandi harus mengandung angka.');

const loginSchema = z.object({
  email,
  // Saat login tidak memakai aturan kekuatan, agar akun lama tetap bisa masuk
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(72)
});

const refreshSchema = z.object({
  refresh_token: z.string().min(10, 'Refresh token tidak valid.')
});

const registerVolunteerSchema = z.object({
  full_name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100),
  age: z.coerce.number().int('Umur harus bilangan bulat.').min(15, 'Usia minimal sukarelawan adalah 15 tahun.').max(80),
  email,
  phone: z.string().trim().regex(/^\+?[0-9\s-]{9,16}$/, 'Nomor telepon tidak valid.'),
  password,
  medical_history: z.string().trim().max(500).optional().default(''),
  health_declaration: z.literal(true, {
    errorMap: () => ({
      message: 'Anda wajib menyetujui pernyataan sehat dan kuat untuk menjadi sukarelawan.'
    })
  })
});

const createAdminSchema = z.object({
  full_name: z.string().trim().min(3).max(100),
  email,
  password
});

module.exports = { loginSchema, refreshSchema, registerVolunteerSchema, createAdminSchema };
