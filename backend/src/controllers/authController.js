
const authService = require('../services/authService');

// ==========================================
// LOGIN UMUM
// ==========================================

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    return res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// LOGIN VOLUNTEER
// ==========================================

exports.loginVolunteer = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, {
      allowedRoles: ['volunteer']
    });

    return res.status(200).json({
      success: true,
      message: 'Login relawan berhasil.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// LOGIN ADMIN
// ==========================================

exports.loginAdmin = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, {
      allowedRoles: ['admin', 'super_admin']
    });

    return res.status(200).json({
      success: true,
      message: 'Login admin berhasil.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REGISTER VOLUNTEER
// ==========================================

exports.registerVolunteer = async (req, res, next) => {
  try {
    const result = await authService.registerVolunteer(req.body);

    return res.status(201).json({
      success: true,
      message:
        'Pendaftaran berhasil. Silakan periksa email untuk verifikasi.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REFRESH TOKEN
// ==========================================

exports.refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    const result = await authService.refresh(refresh_token);

    return res.status(200).json({
      success: true,
      message: 'Token berhasil diperbarui.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// LOGOUT
// ==========================================

exports.logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.token);

    return res.status(200).json({
      success: true,
      message: 'Logout berhasil.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET CURRENT USER
// ==========================================

exports.me = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Data pengguna berhasil diambil.',
      user: req.user, // dibaca frontend (me.user)
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};
