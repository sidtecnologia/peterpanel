export const CONFIG = {
  SB_URL: null,
  SB_ANON_KEY: null,
  STORAGE_BUCKET: "donde_peter",
  DEFAULT_IMG: "https://placehold.co/40x40/f1f5f9/94a3b8?text=IMG"
};

export const API_URLS = {
  BASE: `${CONFIG.SB_URL}/rest/v1`,
  AUTH: `${CONFIG.SB_URL}/auth/v1`,
  STORAGE: `${CONFIG.SB_URL}/storage/v1/object/public/${CONFIG.STORAGE_BUCKET}`
};

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export const formatDate = (dateString) => (dateString ? new Date(dateString).toLocaleString('es-CO') : '');