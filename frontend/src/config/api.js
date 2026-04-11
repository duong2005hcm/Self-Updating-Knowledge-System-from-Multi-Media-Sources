const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const CONTACT_ENDPOINT = API_BASE_URL
  ? `${API_BASE_URL}/api/contact`
  : "/api/contact";
