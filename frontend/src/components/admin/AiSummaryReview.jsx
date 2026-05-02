import { useEffect, useMemo, useState } from "react";

const DEFAULT_WARNING =
  "Thông tin chỉ phục vụ tham khảo, không thay thế tư vấn, chẩn đoán hoặc điều trị từ bác sĩ/chuyên gia y tế.";

const actionTones = {
  created: "border-emerald-100 bg-emerald-50 text-emerald-700",
  updated: "border-sky-100 bg-sky-50 text-sky-700",
  skipped: "border-amber-100 bg-amber-50 text-amber-700",
  failed: "border-rose-100 bg-rose-50 text-rose-700",
  mixed: "border-slate-200 bg-slate-50 text-slate-700",
};

function normalizeSummary(result) {
  const summary = result?.ai_summary || {};
  return {
    summary: summary.summary || "",
    key_points: Array.isArray(summary.key_points) ? summary.key_points : [],
    medical_warning: summary.medical_warning || DEFAULT_WARNING,
    suggested_tags: Array.isArray(summary.suggested_tags) ? summary.suggested_tags : [],
    suggested_topic: summary.suggested_topic || "",
    summary_status: summary.summary_status || "draft",
  };
}

function compactList(items) {
  return (items || []).map((item) => String(item).trim()).filter(Boolean);
}

function parseTags(value) {
  if (Array.isArray(value)) return compactList(value).slice(0, 10);
  return compactList(String(value || "").split(",")).slice(0, 10);
}

export default function AiSummaryReview({ result, busy, saving, onSave }) {
  const [form, setForm] = useState(normalizeSummary(result));
  const [showPayload, setShowPayload] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setForm(normalizeSummary(result));
    setLocalError("");
    setShowPayload(false);
  }, [result]);

  const action = result?.action || "";
  const metadata = useMemo(
    () => [
      ["Document ID", result?.document_id],
      ["Version ID", result?.version_id],
      ["Ingest Job ID", result?.ingest_job_id],
      ["Tiêu đề", result?.title || result?.filename],
      ["Source URL", result?.source_url || result?.url],
    ],
    [result]
  );

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setPoint = (index, value) => {
    setForm((current) => {
      const nextPoints = current.key_points.length ? [...current.key_points] : [""];
      nextPoints[index] = value;
      return { ...current, key_points: nextPoints };
    });
  };

  const addPoint = () => {
    setForm((current) => ({
      ...current,
      key_points: [...current.key_points, ""].slice(0, 10),
    }));
  };

  const removePoint = (index) => {
    setForm((current) => ({
      ...current,
      key_points: current.key_points.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const submit = async (status) => {
    if (!result?.document_id) {
      setLocalError("Thiếu document_id, không thể lưu summary.");
      return;
    }

    const summary = form.summary.trim();
    if (status === "approved" && !summary) {
      setLocalError("Cần có tóm tắt trước khi duyệt công khai.");
      return;
    }
    if (summary.length > 3000) {
      setLocalError("Tóm tắt tối đa 3000 ký tự.");
      return;
    }

    setLocalError("");
    await onSave({
      version_id: result?.version_id,
      summary,
      key_points: compactList(form.key_points).slice(0, 10),
      medical_warning: form.medical_warning.trim() || DEFAULT_WARNING,
      suggested_tags: parseTags(form.suggested_tags),
      suggested_topic: form.suggested_topic.trim(),
      summary_status: status,
    });
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">AI Summary Review</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Tóm tắt được tạo sau khi ingest. Admin có thể kiểm tra, chỉnh sửa rồi lưu để
            hiển thị nhanh ở trang chi tiết tài liệu.
          </p>
        </div>
        {action ? (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
              actionTones[action] || actionTones.mixed
            }`}
          >
            {action}
          </span>
        ) : null}
      </div>

      {busy ? (
        <div className="mt-6 rounded-3xl border border-sky-100 bg-sky-50 p-5 text-sm font-semibold text-sky-800">
          Đang nạp dữ liệu và tạo tóm tắt AI...
        </div>
      ) : null}

      {!result && !busy ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-500">
          Chưa có kết quả ingest. Sau khi nạp PDF/Web, khu vực này sẽ hiển thị summary
          để admin duyệt thay vì bắt đọc JSON raw.
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            {metadata.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {label}
                </div>
                <div className="mt-1 break-all text-sm font-semibold text-slate-700">
                  {value || "N/A"}
                </div>
              </div>
            ))}
          </div>

          {!result.ai_summary ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ingest thành công nhưng chưa tạo được AI Summary. Admin có thể nhập summary thủ
              công rồi lưu.
            </div>
          ) : null}

          {localError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {localError}
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Tóm tắt nội dung</span>
            <textarea
              className="input-base min-h-[150px]"
              value={form.summary}
              maxLength={3000}
              onChange={(event) => setField("summary", event.target.value)}
              placeholder="Nhập hoặc chỉnh sửa tóm tắt tài liệu..."
            />
            <span className="text-xs text-slate-400">{form.summary.length}/3000</span>
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-700">Ý chính</span>
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={addPoint}>
                Thêm ý
              </button>
            </div>
            {(form.key_points.length ? form.key_points : [""]).map((point, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="input-base"
                  value={point}
                  onChange={(event) => setPoint(index, event.target.value)}
                  placeholder={`Ý chính ${index + 1}`}
                />
                <button type="button" className="btn-ghost px-3" onClick={() => removePoint(index)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Cảnh báo tham khảo y tế</span>
            <textarea
              className="input-base min-h-[90px]"
              value={form.medical_warning}
              onChange={(event) => setField("medical_warning", event.target.value)}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Tags gợi ý</span>
              <input
                className="input-base"
                value={
                  Array.isArray(form.suggested_tags)
                    ? form.suggested_tags.join(", ")
                    : form.suggested_tags
                }
                onChange={(event) => setField("suggested_tags", event.target.value)}
                placeholder="tim mạch, phòng bệnh, dinh dưỡng"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Topic gợi ý</span>
              <input
                className="input-base"
                value={form.suggested_topic}
                onChange={(event) => setField("suggested_topic", event.target.value)}
                placeholder="general"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => submit("draft")}>
              {saving ? "Đang lưu..." : "Lưu summary"}
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => submit("approved")}>
              {saving ? "Đang lưu..." : "Duyệt & công khai"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setForm(normalizeSummary(result))}>
              Hủy
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              className="text-sm font-semibold text-sky-700 hover:text-sky-900"
              onClick={() => setShowPayload((current) => !current)}
            >
              {showPayload ? "Ẩn payload kỹ thuật" : "Xem payload kỹ thuật"}
            </button>
            {showPayload ? (
              <pre className="mt-4 max-h-80 overflow-auto rounded-[24px] bg-slate-950 p-5 text-xs leading-6 text-slate-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
