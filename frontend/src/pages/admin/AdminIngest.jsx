import { useState } from "react";
import { ingestPdf, ingestWeb, saveDocumentSummary } from "../../api/adminApi";
import AiSummaryReview from "../../components/admin/AiSummaryReview";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import IngestStatusToast from "../../components/admin/IngestStatusToast";
import { useAuth } from "../../providers/AuthProvider";

const pdfDefaults = {
  file: null,
  pdfUrl: "",
  domain: "general",
  topic: "general",
  priority: "normal",
  status: "active",
  visibility: "public",
  sourceType: "PDF",
  createdBy: "",
};

const webDefaults = {
  url: "",
  limit: 5,
  domain: "general",
  topic: "general",
  priority: "normal",
  status: "active",
  visibility: "public",
  source_type: "Web",
  created_by: "",
};

const actionMessages = {
  created: "Đã tạo tài liệu mới.",
  updated: "Tài liệu đã được cập nhật phiên bản mới.",
  skipped: "Tài liệu không thay đổi, đã bỏ qua embedding lại.",
  failed: "Ingest thất bại.",
  mixed: "Ingest hoàn tất với nhiều trạng thái khác nhau.",
};

export default function AdminIngest() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("pdf");
  const [pdfForm, setPdfForm] = useState(pdfDefaults);
  const [webForm, setWebForm] = useState(webDefaults);
  const [busy, setBusy] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const showActionToast = (response) => {
    const action = response?.action || (response?.status === "failed" ? "failed" : "mixed");
    setToast({
      action,
      message: response?.message || actionMessages[action] || "Đã nhận kết quả ingest.",
    });
  };

  const submitPdf = async (event) => {
    event.preventDefault();
    if (!pdfForm.file) {
      setError("Vui lòng chọn file PDF.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await ingestPdf(pdfForm, token);
      setResult(response);
      showActionToast(response);
    } catch (nextError) {
      setError(nextError.message || "Không thể ingest PDF.");
      setToast({
        action: "failed",
        message: "Không thể nạp PDF. Vui lòng kiểm tra file hoặc backend.",
      });
    } finally {
      setBusy(false);
    }
  };

  const submitWeb = async (event) => {
    event.preventDefault();
    if (!webForm.url.trim()) {
      setError("Vui lòng nhập URL cần ingest.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await ingestWeb(
        {
          url: webForm.url.trim(),
          limit: Number(webForm.limit),
          domain: webForm.domain,
          topic: webForm.topic,
          priority: webForm.priority,
          status: webForm.status,
          visibility: webForm.visibility,
          source_type: webForm.source_type,
          created_by: webForm.created_by || undefined,
        },
        token
      );
      setResult(response);
      showActionToast(response);
    } catch (nextError) {
      setError(nextError.message || "Không thể ingest web.");
      setToast({
        action: "failed",
        message: "Không thể nạp Web. Vui lòng kiểm tra URL hoặc backend.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSummary = async (payload) => {
    const documentId = result?.document_id;
    if (!documentId) {
      setError("Thiếu document_id, không thể lưu summary.");
      return null;
    }

    setSavingSummary(true);
    setError("");
    try {
      const token = await getToken();
      const response = await saveDocumentSummary(documentId, payload, token);
      setResult((current) => ({
        ...current,
        ai_summary: {
          summary: payload.summary,
          key_points: payload.key_points,
          medical_warning: payload.medical_warning,
          suggested_tags: payload.suggested_tags,
          suggested_topic: payload.suggested_topic,
          summary_status: payload.summary_status,
        },
      }));
      setToast({
        action: payload.summary_status === "approved" ? "created" : "updated",
        message:
          payload.summary_status === "approved"
            ? "Summary đã được duyệt và lưu để hiển thị."
            : "Summary draft đã được lưu.",
      });
      return response;
    } catch (nextError) {
      setError(nextError.message || "Không thể lưu summary.");
      setToast({ action: "failed", message: "Không thể lưu summary." });
      return null;
    } finally {
      setSavingSummary(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ingest PDF và Web"
        description="Nạp tài liệu vào kho tri thức, tạo chunk/embedding và review AI Summary trước khi công khai."
      />

      <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
            activeTab === "pdf" ? "bg-white text-ink shadow-sm" : "text-slate-500"
          }`}
          onClick={() => setActiveTab("pdf")}
        >
          Ingest PDF
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
            activeTab === "web" ? "bg-white text-ink shadow-sm" : "text-slate-500"
          }`}
          onClick={() => setActiveTab("web")}
        >
          Ingest Web
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <IngestStatusToast
        action={toast?.action}
        message={toast?.message}
        onClose={() => setToast(null)}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <div className="glass-panel p-6">
          {activeTab === "pdf" ? (
            <form className="grid gap-4" onSubmit={submitPdf}>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">File PDF</span>
                <input
                  className="input-base"
                  type="file"
                  accept="application/pdf"
                  onChange={(event) =>
                    setPdfForm((current) => ({
                      ...current,
                      file: event.target.files?.[0] || null,
                    }))
                  }
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">PDF URL nguồn</span>
                <input
                  className="input-base"
                  type="url"
                  placeholder="https://example.com/document.pdf"
                  value={pdfForm.pdfUrl}
                  onChange={(event) =>
                    setPdfForm((current) => ({ ...current, pdfUrl: event.target.value }))
                  }
                />
                <span className="text-xs leading-5 text-slate-500">
                  Nếu có URL PDF gốc, hệ thống lưu URL này để đối chiếu. File upload vẫn được dùng
                  cho extraction/chunk/embedding.
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Domain</span>
                  <input
                    className="input-base"
                    value={pdfForm.domain}
                    onChange={(event) =>
                      setPdfForm((current) => ({ ...current, domain: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input
                    className="input-base"
                    value={pdfForm.topic}
                    onChange={(event) =>
                      setPdfForm((current) => ({ ...current, topic: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Priority</span>
                  <input
                    className="input-base"
                    value={pdfForm.priority}
                    onChange={(event) =>
                      setPdfForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <input
                    className="input-base"
                    value={pdfForm.status}
                    onChange={(event) =>
                      setPdfForm((current) => ({ ...current, status: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Visibility</span>
                  <select
                    className="input-base"
                    value={pdfForm.visibility}
                    onChange={(event) =>
                      setPdfForm((current) => ({ ...current, visibility: event.target.value }))
                    }
                  >
                    <option value="public">public</option>
                    <option value="protected">protected</option>
                    <option value="private">private</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Source type</span>
                  <input
                    className="input-base"
                    value={pdfForm.sourceType}
                    onChange={(event) =>
                      setPdfForm((current) => ({ ...current, sourceType: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Created by</span>
                <input
                  className="input-base"
                  value={pdfForm.createdBy}
                  onChange={(event) =>
                    setPdfForm((current) => ({ ...current, createdBy: event.target.value }))
                  }
                />
              </label>

              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Đang nạp dữ liệu và tạo tóm tắt AI..." : "Bắt đầu ingest PDF"}
              </button>
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={submitWeb}>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">URL</span>
                <input
                  className="input-base"
                  type="url"
                  placeholder="https://example.com"
                  value={webForm.url}
                  onChange={(event) =>
                    setWebForm((current) => ({ ...current, url: event.target.value }))
                  }
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Limit</span>
                  <input
                    className="input-base"
                    type="number"
                    min="1"
                    max="50"
                    value={webForm.limit}
                    onChange={(event) =>
                      setWebForm((current) => ({ ...current, limit: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Domain</span>
                  <input
                    className="input-base"
                    value={webForm.domain}
                    onChange={(event) =>
                      setWebForm((current) => ({ ...current, domain: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input
                    className="input-base"
                    value={webForm.topic}
                    onChange={(event) =>
                      setWebForm((current) => ({ ...current, topic: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Priority</span>
                  <input
                    className="input-base"
                    value={webForm.priority}
                    onChange={(event) =>
                      setWebForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <input
                    className="input-base"
                    value={webForm.status}
                    onChange={(event) =>
                      setWebForm((current) => ({ ...current, status: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Visibility</span>
                  <select
                    className="input-base"
                    value={webForm.visibility}
                    onChange={(event) =>
                      setWebForm((current) => ({ ...current, visibility: event.target.value }))
                    }
                  >
                    <option value="public">public</option>
                    <option value="protected">protected</option>
                    <option value="private">private</option>
                  </select>
                </label>
              </div>

              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Đang nạp dữ liệu và tạo tóm tắt AI..." : "Bắt đầu ingest Web"}
              </button>
            </form>
          )}
        </div>

        <AiSummaryReview
          result={result}
          busy={busy}
          saving={savingSummary}
          onSave={handleSaveSummary}
        />
      </div>
    </div>
  );
}
