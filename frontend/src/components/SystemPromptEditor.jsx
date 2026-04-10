import React, { useEffect, useState } from "react";
import {
  DEFAULT_SYSTEM_PROMPT,
  getSystemPrompt,
  PROMPT_PRESETS,
  resetSystemPrompt,
  setSystemPrompt,
} from "../chat/systemPrompt";
import {
  adminPromptGetScope,
  adminPromptListScopes,
  adminPromptListVersions,
  adminPromptSave,
} from "../api/ragapi";
import "../styles/system-prompt.css";

export default function SystemPromptEditor() {
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scopes, setScopes] = useState([]);
  const [scope, setScope] = useState("");
  const [activeVersion, setActiveVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await adminPromptListScopes();
        const list = Array.isArray(res?.scopes) ? res.scopes : [];
        const editable = list.filter((x) => x?.editable_from_dashboard);
        const selected = editable[0]?.scope || list[0]?.scope || "";

        if (!cancelled) {
          setScopes(list);
          setScope(selected);
        }
      } catch (e) {
        const cur = getSystemPrompt();
        if (!cancelled) {
          setDraft(cur);
          setBaseline(cur);
          setError(e.message || "Khong tai duoc prompt scope tu server");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!scope) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [scopeRes, versionsRes] = await Promise.all([
          adminPromptGetScope(scope),
          adminPromptListVersions(scope, 20),
        ]);

        const promptText = String(scopeRes?.resolved_prompt || "").trim() || DEFAULT_SYSTEM_PROMPT;
        const versions = Array.isArray(versionsRes?.versions) ? versionsRes.versions : [];

        if (!cancelled) {
          setDraft(promptText);
          setBaseline(promptText);
          setSystemPrompt(promptText);
          setActiveVersion(scopeRes?.active_version || null);
          setLatestVersion(versions[0]?.version || null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Khong tai duoc noi dung prompt");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const len = draft.length;
  const dirty = draft !== baseline;

  const handleSave = async () => {
    const content = String(draft || "").trim();
    if (!content) {
      setError("Prompt khong duoc de trong");
      return;
    }

    if (!scope) {
      setSystemPrompt(content);
      setBaseline(content);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const publishRes = await adminPromptSave(scope, content, "Updated from Admin Dashboard UI");
      setSystemPrompt(content);
      setBaseline(content);
      setActiveVersion(publishRes?.active_version || activeVersion);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e.message || "Khong luu duoc prompt len server");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Dat lai ve prompt mac dinh?")) {
      return;
    }
    resetSystemPrompt();
    setDraft(DEFAULT_SYSTEM_PROMPT);
    setError("");
  };

  return (
    <div className="sp-embedded">
      <div className="sp-panel-head">
        <h2 className="sp-panel-title" id="admin-sp-title">
          Prompt he thong
        </h2>
        <p className="sp-panel-sub">
          Quan tri prompt qua API <code>/admin/prompts</code> (backend Python) thay vi chi luu local.
        </p>
      </div>

      <div className="sp-panel-body">
        <div>
          <div className="sp-label">Prompt scope</div>
          <div className="sp-textarea-wrap" style={{ padding: 10 }}>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={loading || saving || scopes.length === 0}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #dbe3ee" }}
            >
              {scopes.length === 0 ? (
                <option value="">local-only</option>
              ) : (
                scopes.map((s) => (
                  <option key={s.scope} value={s.scope}>
                    {s.scope} {s.editable_from_dashboard ? "" : "(read-only)"}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="sp-meta">
            <span>Active version: {activeVersion || "fallback_default"}</span>
            <span>Latest version: {latestVersion || "-"}</span>
          </div>
        </div>

        <div>
          <div className="sp-label">Goi y nhanh</div>
          <div className="sp-presets">
            {PROMPT_PRESETS.map((p) => (
              <button key={p.id} type="button" className="sp-preset-chip" onClick={() => setDraft(p.text)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="sp-label">Noi dung prompt</div>
          <div className="sp-textarea-wrap">
            <textarea
              className="sp-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nhap huong dan cho mo hinh..."
              spellCheck={false}
            />
          </div>
          <div className="sp-meta">
            <span>{len.toLocaleString("vi-VN")} ky tu</span>
            {savedFlash ? (
              <span style={{ color: "#15803d", fontWeight: 700 }}>Da luu</span>
            ) : saving ? (
              <span style={{ color: "#0f172a", fontWeight: 600 }}>Dang luu...</span>
            ) : dirty ? (
              <span style={{ color: "#b45309", fontWeight: 600 }}>Chua luu</span>
            ) : (
              <span style={{ color: "#64748b" }}>Da dong bo</span>
            )}
          </div>
        </div>

        {error ? (
          <p className="sp-hint" style={{ color: "#b91c1c", fontWeight: 600 }}>
            {error}
          </p>
        ) : null}

        <p className="sp-hint">
          Save se tao draft roi publish theo flow cua <code>admin_prompts.py</code>. Prompt cung duoc sync local de tuong thich API chat hien tai.
        </p>
      </div>

      <div className="sp-panel-foot sp-panel-foot--embedded">
        <button type="button" className="sp-btn sp-btn-ghost" onClick={handleReset}>
          Ve mac dinh
        </button>
        <button
          type="button"
          className="sp-btn sp-btn-primary"
          onClick={handleSave}
          disabled={!dirty || loading || saving}
        >
          {loading ? "Dang tai..." : dirty ? "Luu prompt" : "Khong co thay doi"}
        </button>
      </div>
    </div>
  );
}
