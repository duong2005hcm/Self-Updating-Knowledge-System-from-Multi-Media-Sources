    import { useState } from "react";
    import { ingestWeb } from "../api/ragapi";

    export default function IngestWeb() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [result, setResult] = useState(null);

    const validateUrl = (url) => {
        if (!url.trim()) {
        return "URL không được để trống";
        }

        try {
        const urlObj = new URL(url);
        
        if (!["http:", "https:"].includes(urlObj.protocol)) {
            return "URL phải bắt đầu với http:// hoặc https://";
        }

        const domain = urlObj.hostname;
        const invalidPatterns = [
            /^localhost$/,
            /^127\.\d+\.\d+\.\d+$/,
            /^192\.168\.\d+\.\d+$/,
            /^10\.\d+\.\d+\.\d+$/,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
        ];

        if (invalidPatterns.some(pattern => pattern.test(domain))) {
            return "URL không được là địa chỉ nội bộ (localhost, private IP)";
        }

        return null;
        } catch {
        return "URL không hợp lệ";
        }
    };

    const handleIngest = async () => {
        const validationError = validateUrl(url);
        if (validationError) {
        setError(validationError);
        return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);
        setResult(null);

        try {
        const response = await ingestWeb(url);
        
        if (response.status === "ok") {
            setSuccess(true);
            setResult(response);
            console.log("Ingest result:", response);
        } else {
            setError(response.message || "Ingest web thất bại");
        }
        } catch (err) {
        console.error("Ingest error:", err);
        
        if (err.response) {
            const errorData = err.response.data;
            
            if (errorData.detail) {
            setError(errorData.detail);
            } else if (errorData.message) {
            setError(errorData.message);
            } else if (typeof errorData === "string") {
            setError(errorData);
            } else {
            setError(`Lỗi server: ${err.response.status}`);
            }
        } else if (err.request) {
            setError("Không thể kết nối đến server. Vui lòng kiểm tra:");
            setError(prev => prev + " 1) Backend đang chạy? 2) CORS đã cấu hình?");
        } else if (err.message.includes("Network Error")) {
            setError("Lỗi kết nối mạng. Kiểm tra kết nối internet.");
        } else {
            setError("Đã xảy ra lỗi không xác định: " + err.message);
        }
        } finally {
        setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !loading) {
        handleIngest();
        }
    };

    const handleCloseAlert = () => {
        setError(null);
        setSuccess(false);
    };

    const handleReset = () => {
        setUrl("");
        setError(null);
        setSuccess(false);
        setResult(null);
    };

    return (
        <div className="ingest-web-container">
        <div className="input-group">
            <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://example.com"
            disabled={loading}
            className="url-input"
            />
            
            <div className="button-group">
            <button
                onClick={handleIngest}
                disabled={loading || !url.trim()}
                className="ingest-btn"
            >
                {loading ? "Đang xử lý..." : "Ingest Web"}
            </button>
            
            <button
                onClick={handleReset}
                type="button"
                className="reset-btn"
            >
                Reset
            </button>
            </div>
        </div>

        {error && (
            <div className="alert error">
            <div className="alert-content">
                <span className="alert-icon"></span>
                <span>{error}</span>
            </div>
            <button onClick={handleCloseAlert} className="close-btn">&times;</button>
            </div>
        )}

        {success && result && (
            <div className="alert success">
            <div className="alert-content">
                <span className="alert-icon"></span>
                <span>Ingest web thành công</span>
            </div>
            <button onClick={handleCloseAlert} className="close-btn">&times;</button>
            
            <div className="result-details">
                <div className="result-item">
                <strong>Loại website:</strong>
                <span className="web-type">{result.web_type}</span>
                </div>
                
                <div className="result-item">
                <strong>Số file đã xử lý:</strong>
                <span>{result.files_processed}</span>
                </div>
                
                {result.outputs && result.outputs.length > 0 && (
                <div className="result-item">
                    <strong>Output files:</strong>
                    <div className="output-list">
                    {result.outputs.slice(0, 3).map((output, idx) => (
                        <code key={idx} className="output-file">
                        {output.split("/").pop()}
                        </code>
                    ))}
                    {result.outputs.length > 3 && (
                        <span className="more-files">+ {result.outputs.length - 3} files khác</span>
                    )}
                    </div>
                </div>
                )}
            </div>
            </div>
        )}

        <div className="instructions">
            <h4>Hỗ trợ các loại website:</h4>
            <ul>
            <li><strong>News sites:</strong> Crawl tự động các bài viết</li>
            <li><strong>Documentation:</strong> Trích xuất nội dung docs</li>
            <li><strong>E-commerce:</strong> Lấy thông tin sản phẩm</li>
            </ul>
            <p className="note">
            <strong>Lưu ý:</strong> Đảm bảo website cho phép truy cập và không yêu cầu xác thực.
            </p>
        </div>
        </div>
    );
    }