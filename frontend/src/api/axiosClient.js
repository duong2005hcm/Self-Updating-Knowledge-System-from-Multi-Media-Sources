import axios from 'axios';

const DEPLOY_RAG_API = "https://self-updating-knowledge-system-from.onrender.com";

const axiosClient = axios.create({
    baseURL:
        import.meta.env.VITE_RAG_API ||
        (import.meta.env.PROD ? DEPLOY_RAG_API : "http://localhost:8000"),
});

// Tự động đính kèm Token từ Firebase vào mỗi Request (nếu cần)
axiosClient.interceptors.request.use(async (config) => {
    const token = localStorage.getItem("ragai_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default axiosClient;
