import { useState } from "react";
import { ingestPDF, friendlyApiError } from "../api/ragapi";

export default function IngestDoc() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successDetail, setSuccessDetail] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Chỉ hỗ trợ file PDF");
      return;
    }

    const maxSize = 30 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File quá lớn. Kích thước tối đa là 30MB");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setSuccessDetail("");

    try {
      const response = await ingestPDF(file);

      if (response?.status === "ok" || response?.success === true || response?.message) {
        setSuccess(true);
        const chunks = response?.chunks_inserted;
        setSuccessDetail(
          typeof chunks === "number"
            ? `Đã xử lý ${chunks} đoạn (chunks).`
            : "Tải lên và xử lý thành công."
        );
      } else {
        setError(response?.message || response?.detail || "Upload thất bại");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleCloseAlert = () => {
    setError(null);
    setSuccess(false);
    setSuccessDetail("");
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
                <div className="spinner" />
                <span>Đang xử lý tài liệu…</span>
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
        <div className="alert error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={handleCloseAlert} className="close-btn" aria-label="Đóng">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="alert success" role="status">
          <span>
            <strong>Ingest PDF thành công.</strong> {successDetail}
          </span>
          <button type="button" onClick={handleCloseAlert} className="close-btn" aria-label="Đóng">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
