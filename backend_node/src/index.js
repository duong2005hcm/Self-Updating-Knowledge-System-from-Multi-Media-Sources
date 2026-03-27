const express = require('express'); // Đảm bảo CÓ dòng này
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');

const app = express(); // Bây giờ biến 'express' đã tồn tại

// Cấu hình CORS
app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Node Auth Server is running on: http://localhost:${PORT}`);
});