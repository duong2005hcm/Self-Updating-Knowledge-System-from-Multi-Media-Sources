import { useState } from "react";
import { ingestWeb, friendlyApiError } from "../api/ragapi";

export default function IngestWeb() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState(null);

  const validateUrl = (raw) => {
    if (!raw.trim()) {
      return "URL không được để trống";
    }

    try {
      const urlObj = new URL(raw);

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

      if (invalidPatterns.some((pattern) => pattern.test(domain))) {
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

      if (response.status === "ok" || response?.success === true) {
        setSuccess(true);
        setResult(response);
      } else {
        setError(response?.message || response?.detail || "Ingest web thất bại");
      }
    } catch (err) {
      console.error("Ingest error:", err);
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleIngest();
    }
  };

  const handleCloseAlert = () => {
    setError(null);
    setSuccess(false);
    setResult(null);
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
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          disabled={loading}
          className="url-input"
        />

        <div className="button-group">
          <button
            type="button"
            onClick={handleIngest}
            disabled={loading || !url.trim()}
            className="ingest-btn"
          >
            {loading ? "Đang xử lý..." : "Ingest Web"}
          </button>

          <button type="button" onClick={handleReset} className="reset-btn">
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="alert error" role="alert">
          <div className="alert-content">
            <span className="alert-icon" aria-hidden />
            <span>{error}</span>
          </div>
          <button type="button" onClick={handleCloseAlert} className="close-btn" aria-label="Đóng">
            &times;
          </button>
        </div>
      )}

      {success && result && (
        <div className="alert success" role="status">
          <div className="alert-content">
            <span className="alert-icon" aria-hidden />
            <span>Ingest web thành công</span>
          </div>
          <button type="button" onClick={handleCloseAlert} className="close-btn" aria-label="Đóng">
            &times;
          </button>

          <div className="result-details">
            <div className="result-item">
              <strong>Loại website:</strong>
              <span className="web-type">{result.web_type ?? "—"}</span>
            </div>

            <div className="result-item">
              <strong>Số file đã xử lý:</strong>
              <span>{result.files_processed ?? "—"}</span>
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
          <li>
            <strong>News sites:</strong> Crawl tự động các bài viết
          </li>
          <li>
            <strong>Documentation:</strong> Trích xuất nội dung docs
          </li>
          <li>
            <strong>E-commerce:</strong> Lấy thông tin sản phẩm
          </li>
        </ul>
        <p className="note">
          <strong>Lưu ý:</strong> Đảm bảo website cho phép truy cập và không yêu cầu xác thực.
        </p>
      </div>
    </div>
  );
}
