import { useState } from "react";
import { ingestPdf, ingestWeb } from "../../api/adminApi";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../providers/AuthProvider";

const pdfDefaults = {
  file: null,
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

export default function AdminIngest() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("pdf");
  const [pdfForm, setPdfForm] = useState(pdfDefaults);
  const [webForm, setWebForm] = useState(webDefaults);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
    } catch (nextError) {
      setError(nextError.message || "Không thể ingest PDF.");
    } finally {
      setBusy(false);
    }
  };

  const submitWeb = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await ingestWeb(
        {
          url: webForm.url,
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
    } catch (nextError) {
      setError(nextError.message || "Không thể ingest web.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ingest PDF và Web"
        description="Tách riêng 2 tab để gọi `POST /api/admin/ingest/pdf` bằng form-data và `POST /api/admin/ingest/web` bằng JSON."
      />

      <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "pdf" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
          onClick={() => setActiveTab("pdf")}
        >
          Ingest PDF
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "web" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
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

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
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
                    setPdfForm((current) => ({ ...current, file: event.target.files?.[0] || null }))
                  }
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Domain</span>
                  <input className="input-base" value={pdfForm.domain} onChange={(event) => setPdfForm((current) => ({ ...current, domain: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input className="input-base" value={pdfForm.topic} onChange={(event) => setPdfForm((current) => ({ ...current, topic: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Priority</span>
                  <input className="input-base" value={pdfForm.priority} onChange={(event) => setPdfForm((current) => ({ ...current, priority: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <input className="input-base" value={pdfForm.status} onChange={(event) => setPdfForm((current) => ({ ...current, status: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Visibility</span>
                  <select className="input-base" value={pdfForm.visibility} onChange={(event) => setPdfForm((current) => ({ ...current, visibility: event.target.value }))}>
                    <option value="public">public</option>
                    <option value="protected">protected</option>
                    <option value="private">private</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Source type</span>
                  <input className="input-base" value={pdfForm.sourceType} onChange={(event) => setPdfForm((current) => ({ ...current, sourceType: event.target.value }))} />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Created by</span>
                <input className="input-base" value={pdfForm.createdBy} onChange={(event) => setPdfForm((current) => ({ ...current, createdBy: event.target.value }))} />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Đang ingest..." : "Bắt đầu ingest PDF"}
              </button>
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={submitWeb}>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">URL</span>
                <input className="input-base" value={webForm.url} onChange={(event) => setWebForm((current) => ({ ...current, url: event.target.value }))} />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Limit</span>
                  <input className="input-base" type="number" min="1" max="50" value={webForm.limit} onChange={(event) => setWebForm((current) => ({ ...current, limit: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Domain</span>
                  <input className="input-base" value={webForm.domain} onChange={(event) => setWebForm((current) => ({ ...current, domain: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input className="input-base" value={webForm.topic} onChange={(event) => setWebForm((current) => ({ ...current, topic: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Priority</span>
                  <input className="input-base" value={webForm.priority} onChange={(event) => setWebForm((current) => ({ ...current, priority: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <input className="input-base" value={webForm.status} onChange={(event) => setWebForm((current) => ({ ...current, status: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Visibility</span>
                  <select className="input-base" value={webForm.visibility} onChange={(event) => setWebForm((current) => ({ ...current, visibility: event.target.value }))}>
                    <option value="public">public</option>
                    <option value="protected">protected</option>
                    <option value="private">private</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Đang ingest..." : "Bắt đầu ingest Web"}
              </button>
            </form>
          )}
        </div>

        <div className="glass-panel p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">Kết quả</h2>
          <p className="mt-2 text-sm text-slate-500">
            Nếu backend trả về các trường như `created`, `skipped`, `updated`, giao diện sẽ hiển thị nguyên payload để dễ kiểm tra.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-[24px] bg-slate-950 p-5 text-xs leading-6 text-slate-100">
            {JSON.stringify(result, null, 2) || "Chưa có kết quả."}
          </pre>
        </div>
      </div>
    </div>
  );
}
