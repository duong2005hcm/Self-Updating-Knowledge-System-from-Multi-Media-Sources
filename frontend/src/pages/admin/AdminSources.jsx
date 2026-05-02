import { useEffect, useMemo, useState } from "react";
import {
  createSource,
  deleteSource,
  listSources,
  toggleSource,
  updateSource,
} from "../../api/adminApi";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { formatDateTime, getStatusTone } from "../../lib/utils";

const defaultSourceForm = {
  name: "",
  type: "web",
  url_or_path: "",
  domain: "health",
  active: true,
  schedule: "",
  trust_score: 0.8,
};

export default function AdminSources() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(defaultSourceForm);
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const loadSources = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listSources(token);
      setItems(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải sources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (!selectedItem) return;
    setForm({
      name: selectedItem.name || "",
      type: selectedItem.type || "web",
      url_or_path: selectedItem.url_or_path || "",
      domain: selectedItem.domain || "health",
      active: Boolean(selectedItem.active),
      schedule: selectedItem.schedule || "",
      trust_score: selectedItem.trust_score ?? 0.8,
    });
  }, [selectedItem]);

  const resetForm = () => {
    setSelectedId("");
    setForm(defaultSourceForm);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const payload = {
        ...form,
        trust_score: Number(form.trust_score),
        schedule: form.schedule || null,
      };

      if (selectedId) {
        await updateSource(selectedId, payload, token);
      } else {
        await createSource(payload, token);
      }

      await loadSources();
      resetForm();
    } catch (nextError) {
      setError(nextError.message || "Không thể lưu source.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (sourceId) => {
    try {
      const token = await getToken();
      await toggleSource(sourceId, token);
      await loadSources();
    } catch (nextError) {
      setError(nextError.message || "Không thể toggle source.");
    }
  };

  const handleDelete = async (sourceId) => {
    if (!window.confirm("Xóa source này?")) return;
    try {
      const token = await getToken();
      await deleteSource(sourceId, token);
      await loadSources();
      if (selectedId === sourceId) resetForm();
    } catch (nextError) {
      setError(nextError.message || "Không thể xóa source.");
    }
  };

  if (loading) {
    return <LoadingState title="Đang tải sources" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quản lý nguồn dữ liệu"
        description="Kết nối trực tiếp với `GET/POST/PUT/PATCH/DELETE /api/sources` và yêu cầu Firebase admin token thật."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink">Danh sách sources</h2>
            <span className="text-sm text-slate-500">{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <EmptyState title="Chưa có source" />
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-100">
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Domain</th>
                      <th className="px-4 py-3 font-semibold">Active</th>
                      <th className="px-4 py-3 font-semibold">Trust</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => setSelectedId(item.id)}
                          >
                            <div className="font-semibold text-ink">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.url_or_path}</div>
                          </button>
                        </td>
                        <td className="px-4 py-4">{item.type}</td>
                        <td className="px-4 py-4">{item.domain}</td>
                        <td className="px-4 py-4">
                          <span className={`status-pill ${getStatusTone(item.active ? "active" : "inactive")}`}>
                            {item.active ? "active" : "inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-4">{item.trust_score}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-ghost px-3 py-2 text-xs"
                              onClick={() => handleToggle(item.id)}
                            >
                              Toggle
                            </button>
                            <button
                              type="button"
                              className="btn-ghost px-3 py-2 text-xs"
                              onClick={() => setSelectedId(item.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-ghost px-3 py-2 text-xs text-rose-700"
                              onClick={() => handleDelete(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {selectedItem ? "Cập nhật source" : "Tạo source mới"}
            </h2>
            {selectedItem ? (
              <button type="button" className="text-sm font-semibold text-brand-700" onClick={resetForm}>
                Tạo mới
              </button>
            ) : null}
          </div>

          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                className="input-base"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Type</span>
              <select
                className="input-base"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="web">web</option>
                <option value="pdf">pdf</option>
                <option value="news">news</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">URL or path</span>
              <input
                className="input-base"
                value={form.url_or_path}
                onChange={(event) => setForm((current) => ({ ...current, url_or_path: event.target.value }))}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Domain</span>
                <input
                  className="input-base"
                  value={form.domain}
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Trust score</span>
                <input
                  className="input-base"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.trust_score}
                  onChange={(event) => setForm((current) => ({ ...current, trust_score: event.target.value }))}
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Schedule</span>
              <input
                className="input-base"
                value={form.schedule}
                onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))}
                placeholder="0 8 * * *"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span className="text-sm font-semibold text-slate-700">Active</span>
            </label>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu..." : selectedItem ? "Cập nhật source" : "Tạo source"}
            </button>
          </form>

          {selectedItem ? (
            <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
              <div>Created by: {selectedItem.created_by}</div>
              <div className="mt-2">Updated at: {formatDateTime(selectedItem.updated_at)}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
