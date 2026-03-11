export const CONFIG = {
  SB_URL: "https://nqjdtwocsnruptnkaucd.supabase.co",
  SB_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xamR0d29jc25ydXB0bmthdWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDU4NDEsImV4cCI6MjA4ODgyMTg0MX0.7ykbCaogj7OhI1QJTwKs2V9fWQGOUv4SlBk0uFUidHc",
  STORAGE_BUCKET: "images",
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