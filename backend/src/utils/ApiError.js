class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  static badRequest(msg = 'Permintaan tidak valid.') { return new ApiError(400, msg); }
  static unauthorized(msg = 'Silakan login terlebih dahulu.') { return new ApiError(401, msg); }
  static forbidden(msg = 'Akses ditolak.') { return new ApiError(403, msg); }
  static notFound(msg = 'Data tidak ditemukan.') { return new ApiError(404, msg); }
  static conflict(msg = 'Data bertabrakan dengan kondisi saat ini.') { return new ApiError(409, msg); }
  static unavailable(msg = 'Layanan sedang tidak tersedia.') { return new ApiError(503, msg); }
}

module.exports = ApiError;
