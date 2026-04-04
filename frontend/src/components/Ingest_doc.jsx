    import { useState } from "react";
    import { ingestDoc } from "../api/ragapi";

    export default function IngestDoc() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Chỉ hỗ trợ file PDF");
        return;
        }

        // Validate file size (max 30MB)
        const maxSize = 30 * 1024 * 1024;
        if (file.size > maxSize) {
        setError("File quá lớn. Kích thước tối đa là 30MB");
        return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
        const response = await ingestDoc(file);
        
        if (response.status === "ok") {
            setSuccess(true);
            console.log(`Đã xử lý ${response.chunks_inserted} chunks`);
        } else {
            setError(response.message || "Upload thất bại");
        }
        } catch (err) {
        console.error("Upload error:", err);
        
        if (err.response) {
            const errorData = err.response.data;
            if (errorData.detail) {
            setError(errorData.detail);
            } else if (errorData.message) {
            setError(errorData.message);
            } else {
            setError(`Lỗi server: ${err.response.status}`);
            }
        } else if (err.request) {
            setError("Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.");
        } else {
            setError("Đã xảy ra lỗi không xác định.");
        }
        } finally {
        setLoading(false);
        // Reset file input
        e.target.value = "";
        }
    };

    const handleCloseAlert = () => {
        setError(null);
        setSuccess(false);
    };

    return (
        <div className="ingest-doc-container">
        <div className="upload-area">
            <label className="upload-label">
            <input
                type="file"
                onChange={handleUpload}
                accept=".pdf,application/pdf"
                disabled={loading}
                className="file-input"
            />
            <div className="upload-content">
                {loading ? (
                <div className="loading-indicator">
                    <div className="spinner"></div>
                    <span>Đang xử lý...</span>
                </div>
                ) : (
                <>
                    <span>Chọn file PDF</span>
                    <span className="file-hint">Kích thước tối đa: 30MB</span>
                </>
                )}
            </div>
            </label>
        </div>

        {error && (
            <div className="alert error">
            <span>{error}</span>
            <button onClick={handleCloseAlert} className="close-btn">&times;</button>
            </div>
        )}

        {success && (
            <div className="alert success">
            <span>Ingest document thành công</span>
            <button onClick={handleCloseAlert} className="close-btn">&times;</button>
            </div>
        )}
        </div>
    );
    }