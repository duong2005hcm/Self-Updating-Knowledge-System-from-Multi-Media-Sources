import axios from 'axios';

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_RAG_API,
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