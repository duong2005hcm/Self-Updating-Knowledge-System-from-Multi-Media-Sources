const DEPLOY_NODE_API = "https://self-updating-knowledge-system-from-98qj.onrender.com";

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? DEPLOY_NODE_API : "");

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const CONTACT_ENDPOINT = API_BASE_URL
  ? `${API_BASE_URL}/api/contact`
  : "/api/contact";
