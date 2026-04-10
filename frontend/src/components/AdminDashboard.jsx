import React, { useCallback, useEffect, useMemo, useState } from "react";
import Dialog from "./Dialog";
import {
  adminGetUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetUserChats,
  adminResetPassword,
  getKnowledgeList,
  ingestPDF,
  ingestWeb,
  deleteKnowledge,
  updateKnowledge,
  adminGetIngestDaily,
} from "../api/ragapi";
import AdminOverviewPanel from "./AdminOverviewPanel";
import SystemPromptEditor from "./SystemPromptEditor";
import "../styles/admin-dashboard.css";

function formatTs(value) {
  if (!value) return "—";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    }
    if (value.seconds) {
      return new Date(value.seconds * 1000).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });
    }
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      }
    }
  } catch {
    /* ignore */
  }
  return "—";
}

function ChatHistoryContent({ payload }) {
  if (!payload?.conversations?.length) {
    return <p className="dlg-sub">Chưa có dữ liệu đồng bộ từ phiên người dùng.</p>;
  }
  return (
    <div className="chat-history-block">
      {payload.conversations.map((c) => (
        <div key={c.id} className="chat-history-conv">
          <h4>{c.title || "Chat"}</h4>
          {(c.messages || []).slice(-30).map((m, i) => (
            <div key={m.id || i} className={`chat-history-msg ${m.role || ""}`}>
              <strong>{m.role}:</strong> {(m.content || "").slice(0, 500)}
              {(m.content || "").length > 500 ? "…" : ""}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function IngestActivityChart({ rows }) {
  const chartRows = Array.isArray(rows) ? rows : [];
  if (chartRows.length === 0) {
    return <div className="admin-empty">Chưa có dữ liệu ingest để hiển thị biểu đồ.</div>;
  }

  const max = Math.max(1, ...chartRows.map((r) => Number(r.total || 0)));

  return (
    <div className="ingest-chart-wrap">
      {chartRows.map((row) => {
        const total = Number(row.total || 0);
        const height = Math.max(6, Math.round((total / max) * 84));
        return (
          <div key={row.date} className="ingest-chart-col" title={`${row.date}: ${total}`}>
            <div className="ingest-chart-bar-wrap">
              <div className="ingest-chart-bar" style={{ height: `${height}px` }} />
            </div>
            <div className="ingest-chart-count">{total}</div>
            <div className="ingest-chart-label">{row.date.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard({ user, onExit }) {
  const [nav, setNav] = useState("overview");
  const [users, setUsers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [ingestActivityRows, setIngestActivityRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [menuUserId, setMenuUserId] = useState(null);

  const [viewUser, setViewUser] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleValue, setRoleValue] = useState("user");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [chatHistoryUser, setChatHistoryUser] = useState(null);
  const [chatHistoryPayload, setChatHistoryPayload] = useState(null);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("user");
  const [addBusy, setAddBusy] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestMode, setIngestMode] = useState("pdf");
  const [ingestFile, setIngestFile] = useState(null);
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestLimit, setIngestLimit] = useState(5);
  const [ingestDomain, setIngestDomain] = useState("general");
  const [ingestTopic, setIngestTopic] = useState("general");
  const [ingestPriority, setIngestPriority] = useState("normal");
  const [ingestStatus, setIngestStatus] = useState("active");
  const [ingestBusy, setIngestBusy] = useState(false);

  const displayName = user?.name || user?.email || "Admin";

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetUsers();
      if (res?.users) setUsers(res.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeList();
      const documents = Array.isArray(res?.documents) ? res.documents : [];
      setDocs(documents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIngestActivity = useCallback(async () => {
    try {
      const res = await adminGetIngestDaily(14);
      const rows = Array.isArray(res?.rows) ? res.rows : [];
      setIngestActivityRows(rows);
    } catch (e) {
      console.error(e);
      setIngestActivityRows([]);
    }
  }, []);

  useEffect(() => {
    setSearch("");
    if (nav === "users") fetchUsers();
    else if (nav === "knowledge") {
      fetchDocs();
      fetchIngestActivity();
    }
  }, [nav, fetchUsers, fetchDocs, fetchIngestActivity]);

  useEffect(() => {
    if (menuUserId == null) return;
    const onDocClick = () => setMenuUserId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuUserId]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const email = (u.email || "").toLowerCase();
      const name = (u.displayName || u.name || "").toLowerCase();
      return email.includes(q) || name.includes(q);
    });
  }, [users, search]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const name = String(d.name || d.filename || "").toLowerCase();
      const collection = String(d.collection_name || "").toLowerCase();
      const sourceType = String(d.source_type || "").toLowerCase();
      const domain = String(d.domain || "").toLowerCase();
      const topic = String(d.topic || "").toLowerCase();
      const actor = String(d.created_by || "").toLowerCase();
      return (
        name.includes(q) ||
        collection.includes(q) ||
        sourceType.includes(q) ||
        domain.includes(q) ||
        topic.includes(q) ||
        actor.includes(q)
      );
    });
  }, [docs, search]);

  const knowledgeActivityRows = useMemo(() => {
    if (Array.isArray(ingestActivityRows) && ingestActivityRows.length > 0) {
      return ingestActivityRows.slice(-14);
    }

    const rows = [];
    const map = new Map();
    const now = new Date();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, total: 0, pdf: 0, web: 0 });
    }

    for (const doc of docs) {
      const rawDate = doc?.created_at || doc?.last_crawled_at;
      if (!rawDate) continue;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) continue;
      const key = date.toISOString().slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.total += 1;
      if (String(doc?.source_type || "").toLowerCase() === "pdf") row.pdf += 1;
      else row.web += 1;
    }

    for (const value of map.values()) rows.push(value);
    return rows;
  }, [ingestActivityRows, docs]);

  const resolveActorInfo = useCallback((doc) => {
    const rawActor = String(doc?.created_by || "").trim();
    const workflowFromDoc = String(doc?.workflow_name || "").trim();
    if (!rawActor) {
      return { actor: "Không rõ", workflow: workflowFromDoc };
    }

    const match = rawActor.match(/^n8n\s*[:\-]\s*(.+)$/i);
    if (match) {
      return { actor: "n8n", workflow: workflowFromDoc || match[1].trim() };
    }

    if (/n8n/i.test(rawActor)) {
      return { actor: "n8n", workflow: workflowFromDoc || "workflow" };
    }

    return { actor: rawActor, workflow: workflowFromDoc };
  }, []);

  const openProfileEdit = (u) => {
    setProfileTarget(u);
    setProfileName(u.displayName || u.name || "");
    setProfileEmail(u.email || "");
  };

  const submitProfile = async () => {
    if (!profileTarget) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      alert("Email không hợp lệ.");
      return;
    }
    try {
      await adminUpdateUser(profileTarget.id, {
        displayName: profileName.trim(),
        email: profileEmail.trim(),
      });
      setProfileTarget(null);
      fetchUsers();
    } catch (e) {
      alert(e.message || "Không cập nhật được thông tin.");
    }
  };

  const openRoleEdit = (u) => {
    setRoleTarget(u);
    setRoleValue(u.role === "admin" ? "admin" : "user");
  };

  const submitRole = async () => {
    if (!roleTarget) return;
    try {
      await adminUpdateUser(roleTarget.id, { role: roleValue });
      setRoleTarget(null);
      fetchUsers();
    } catch (e) {
      alert(e.message || "Không cập nhật được quyền.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      alert("Không xóa được người dùng.");
    }
  };

  const submitAdd = async () => {
    const email = addEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Email không hợp lệ.");
      return;
    }
    if (!addPassword || addPassword.length < 6) {
      alert("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    setAddBusy(true);
    try {
      await adminCreateUser({
        email,
        password: addPassword,
        displayName: addDisplayName.trim(),
        role: addRole,
      });
      setAddOpen(false);
      setAddDisplayName("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("user");
      fetchUsers();
    } catch (e) {
      alert(e.message || "Không thêm được người dùng.");
    } finally {
      setAddBusy(false);
    }
  };

  const closeAdd = () => {
    if (addBusy) return;
    setAddOpen(false);
    setAddDisplayName("");
    setAddEmail("");
    setAddPassword("");
    setAddRole("user");
  };

  const getDocMutationId = (doc) => {
    const rawId = String(doc?.id || "").trim();
    if (rawId && !rawId.includes(":")) return rawId;
    if (Array.isArray(doc?.sample_ids) && doc.sample_ids.length > 0) {
      return String(doc.sample_ids[0] || "").trim();
    }
    return rawId;
  };

  const handleDeleteDoc = async (doc) => {
    if (doc?.mutable === false) {
      alert("API admin_knowledge.py hiện chưa hỗ trợ xóa trực tiếp nguồn tri thức.");
      return;
    }
    const targetId = getDocMutationId(doc);
    if (!targetId) {
      alert("Khong xac dinh duoc id tai lieu de xoa.");
      return;
    }
    if (!window.confirm(`Xoa tai lieu "${doc?.name || targetId}"?`)) return;
    try {
      await deleteKnowledge(targetId);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e) {
      alert(e.message || "Loi khi xoa tai lieu.");
    }
  };

  const handleEditDoc = async (doc) => {
    if (doc?.mutable === false) {
      alert("API admin_knowledge.py hiện chưa hỗ trợ cập nhật trực tiếp nguồn tri thức.");
      return;
    }
    const targetId = getDocMutationId(doc);
    if (!targetId) {
      alert("Khong xac dinh duoc id tai lieu de cap nhat.");
      return;
    }
    const currentName = String(doc?.name || "").trim();
    const nextName = window.prompt("Nhap ten moi cho tai lieu:", currentName);
    if (nextName == null) return;
    const cleanName = String(nextName).trim();
    if (!cleanName || cleanName === currentName) return;

    try {
      await updateKnowledge(targetId, {
        name: cleanName,
        document_name: cleanName,
      });
      setDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? { ...d, name: cleanName, document_name: cleanName }
            : d
        )
      );
    } catch (e) {
      alert(e.message || "Loi khi cap nhat tai lieu.");
    }
  };

  const closeIngestDialog = () => {
    setIngestOpen(false);
    setIngestMode("pdf");
    setIngestFile(null);
    setIngestUrl("");
    setIngestLimit(5);
    setIngestDomain("general");
    setIngestTopic("general");
    setIngestPriority("normal");
    setIngestStatus("active");
  };

  const handleSubmitIngest = async () => {
    setIngestBusy(true);
    try {
      const ingestOptions = {
        domain: ingestDomain,
        topic: ingestTopic,
        priority: ingestPriority,
        status: ingestStatus,
        source_type: ingestMode === "pdf" ? "PDF" : "Web",
        created_by: String(displayName || user?.email || "admin"),
      };
      if (ingestMode === "pdf") {
        if (!ingestFile) {
          alert("Vui long chon file PDF.");
          return;
        }
        await ingestPDF(ingestFile, ingestOptions);
      } else {
        const cleanUrl = String(ingestUrl || "").trim();
        if (!cleanUrl) {
          alert("Vui long nhap URL.");
          return;
        }
        await ingestWeb(cleanUrl, ingestLimit, ingestOptions);
      }
      closeIngestDialog();
      await fetchDocs();
    } catch (e) {
      alert(e.message || "Cap nhat tri thuc that bai.");
    } finally {
      setIngestBusy(false);
    }
  };

  const openChatHistory = async (u) => {
    setMenuUserId(null);
    setChatHistoryUser(u);
    setChatHistoryPayload(null);
    setChatHistoryLoading(true);
    try {
      const data = await adminGetUserChats(u.id);
      setChatHistoryPayload(data?.chats ?? null);
    } catch (e) {
      alert(e.message || "Không tải được lịch sử chat.");
      setChatHistoryUser(null);
    } finally {
      setChatHistoryLoading(false);
    }
  };

  const handleResetPassword = async (u) => {
    setMenuUserId(null);
    if (
      !window.confirm(
        `Đặt lại mật khẩu tài khoản "${u.email || u.displayName || u.id}" thành 11111111?`
      )
    ) {
      return;
    }
    try {
      await adminResetPassword(u.id);
      alert("Đã đặt mật khẩu tạm: 11111111");
    } catch (e) {
      alert(e.message || "Không reset được mật khẩu.");
    }
  };

  const title =
    nav === "overview"
      ? "Tổng quan hệ thống"
      : nav === "users"
        ? "Quản lý người dùng"
        : nav === "prompt"
          ? "Prompt hệ thống (chatbot)"
          : "Kho tri thức";

  const desc =
    nav === "overview"
      ? ""
      : nav === "users"
        ? "Tìm kiếm theo tên hoặc email, thêm tài khoản hoặc thao tác qua menu hàng."
        : nav === "prompt"
          ? "Chỉnh hướng dẫn cho mô hình: vai trò, giọng điệu, quy tắc RAG. Lưu trên trình duyệt, gửi kèm /api/ask."
          : "Quan ly kho tri thuc: cap nhat nguon moi, sua va xoa tai lieu neu backend cho phep.";

  return (
    <div className="admin-shell app-root">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark" aria-hidden>
            âœ¦
          </div>
          <div>
            <div className="admin-brand-text">Quản trị</div>
            <div className="admin-brand-sub">Knowledge &amp; RAG</div>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          <button
            type="button"
            className={`admin-nav-btn ${nav === "overview" ? "is-active" : ""}`}
            onClick={() => setNav("overview")}
          >
            <span className="admin-nav-ico"></span>
            Tổng quan
          </button>
          <button
            type="button"
            className={`admin-nav-btn ${nav === "users" ? "is-active" : ""}`}
            onClick={() => setNav("users")}
          >
            <span className="admin-nav-ico"></span>
            Người dùng
          </button>
          <button
            type="button"
            className={`admin-nav-btn ${nav === "prompt" ? "is-active" : ""}`}
            onClick={() => setNav("prompt")}
          >
            <span className="admin-nav-ico"></span>
            Prompt hệ thống
          </button>
          <button
            type="button"
            className={`admin-nav-btn ${nav === "knowledge" ? "is-active" : ""}`}
            onClick={() => setNav("knowledge")}
          >
            <span className="admin-nav-ico"></span>
            Kho tri thức
          </button>
        </nav>

        <div className="admin-sidebar-foot">
          <button type="button" className="admin-btn-exit" onClick={onExit}>
            ← Quay lại chat
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{title}</h1>
            <p className="admin-topbar-desc">{desc}</p>
          </div>
          <div className="admin-user-pill" title="Phiên đăng nhập">
            <span>Đã đăng nhập</span> · {displayName}
          </div>
        </header>

        <div className="admin-scroll">
          {nav === "overview" && <AdminOverviewPanel adminUser={user} />}

          {nav === "prompt" && <SystemPromptEditor />}

          {nav === "users" && (
            <>
              <div className="admin-toolbar">
                <div className="admin-search-wrap">
                  <input
                    type="search"
                    placeholder="Tìm theo tên hoặc email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Tìm người dùng"
                  />
                </div>
                <button type="button" className="admin-btn-primary" onClick={() => setAddOpen(true)}>
                  + Thêm người dùng
                </button>
              </div>

              {loading ? (
                <div className="admin-loading">Đang tải danh sách…</div>
              ) : (
                <div className="admin-table-card">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Tên</th>
                        <th>Email</th>
                        <th>Đăng nhập cuối (Firebase)</th>
                        <th>Tạo TK (Firebase)</th>
                        <th>Vai trò</th>
                        <th aria-label="Thao tác" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u, index) => (
                        <tr key={u.id}>
                          <td className="admin-mono">{index + 1}</td>
                          <td className="admin-name-cell">{u.displayName || u.name || "—"}</td>
                          <td className="admin-email-cell">{u.email || "—"}</td>
                          <td className="admin-date-cell">{formatTs(u.authLastSignInTime)}</td>
                          <td className="admin-date-cell">{formatTs(u.authCreationTime)}</td>
                          <td>
                            <span
                              className={`admin-role-badge ${
                                u.role === "admin" ? "is-admin" : "is-user"
                              }`}
                            >
                              {u.role || "user"}
                            </span>
                          </td>
                          <td className="admin-td-menu">
                            <button
                              type="button"
                              className="admin-icon-btn"
                              aria-label="Mở menu thao tác"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuUserId((v) => (v === u.id ? null : u.id));
                              }}
                            >
                              â‹¯
                            </button>
                            {menuUserId === u.id && (
                              <ul
                                className="admin-row-menu"
                                role="menu"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <li role="none">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setViewUser(u);
                                      setMenuUserId(null);
                                    }}
                                  >
                                    Xem thông tin
                                  </button>
                                </li>
                                <li role="none">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      openProfileEdit(u);
                                      setMenuUserId(null);
                                    }}
                                  >
                                    Sửa tên &amp; email
                                  </button>
                                </li>
                                <li role="none">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      openRoleEdit(u);
                                      setMenuUserId(null);
                                    }}
                                  >
                                    Phân quyền
                                  </button>
                                </li>
                                <li role="none">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => openChatHistory(u)}
                                  >
                                    Lịch sử chat
                                  </button>
                                </li>
                                <li role="none">
                                  <button
                                    type="button"
                                    className="is-danger"
                                    role="menuitem"
                                    onClick={() => {
                                      setDeleteTarget(u);
                                      setMenuUserId(null);
                                    }}
                                  >
                                    Xóa người dùng
                                  </button>
                                </li>
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="admin-empty">Không có người dùng phù hợp tìm kiếm.</div>
                  )}
                </div>
              )}
            </>
          )}

          {nav === "knowledge" && (
            <>
              <div className="admin-toolbar">
                <div className="admin-search-wrap">
                  <input
                    type="search"
                    placeholder="Tìm tài liệu, topic, domain, admin..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Tìm tài liệu"
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => setIngestOpen(true)}
                >
                  Cập nhật tri thức
                </button>
              </div>

              <div className="admin-table-card admin-ingest-activity-card" style={{ marginBottom: 14 }}>
                <div className="admin-table-title">Hoạt động thêm tài liệu vào ChromaDB (14 ngày gần nhất)</div>
                <div className="admin-chart-sub" style={{ margin: "8px 18px 0" }}>
                  Theo dõi số lượt ingest mỗi ngày để quản lý hoạt động nạp tri thức.
                </div>
                <IngestActivityChart rows={knowledgeActivityRows} />
              </div>

              {loading ? (
                <div className="admin-loading">Đang tải tài liệu...</div>
              ) : (
                <div className="admin-table-card">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Collection</th>
                        <th>Source</th>
                        <th>Type</th>
                        <th>Domain</th>
                        <th>Topic</th>
                        <th>Chunks</th>
                        <th>Latest</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((d, index) => {
                        const actorInfo = resolveActorInfo(d);
                        return (
                          <tr key={d.id}>
                            <td className="admin-mono">{index + 1}</td>
                            <td className="admin-email-cell">{d.collection_name || "default"}</td>
                            <td className="admin-name-cell">{d.name || d.filename || "-"}</td>
                            <td className="admin-email-cell">{d.source_type || "Web"}</td>
                            <td className="admin-email-cell">{d.domain || "general"}</td>
                            <td className="admin-email-cell">{d.topic || "general"}</td>
                            <td className="admin-mono">{Number(d.total_chunks || 0)}</td>
                            <td className="admin-email-cell">
                              {d.last_crawled_at || d.created_at
                                ? new Date(d.last_crawled_at || d.created_at).toLocaleDateString("vi-VN")
                                : "-"}
                            </td>
                            <td>
                              <div className="admin-action-meta">
                                <div className="admin-action-main">Admin: {actorInfo.actor}</div>
                                {actorInfo.workflow ? (
                                  <div className="admin-action-sub">n8n workflow: {actorInfo.workflow}</div>
                                ) : null}
                              </div>
                              {d.mutable === false ? (
                                <span style={{ fontSize: 12, opacity: 0.7 }}>API chưa hỗ trợ sửa/xóa</span>
                              ) : (
                                <div style={{ marginTop: 8 }}>
                                  <button
                                    type="button"
                                    className="admin-danger-outline"
                                    onClick={() => handleEditDoc(d)}
                                    style={{ marginRight: 8 }}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-danger-outline"
                                    onClick={() => handleDeleteDoc(d)}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredDocs.length === 0 && (
                    <div className="admin-empty">Chưa có tài liệu hoặc không khớp tìm kiếm.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog
        open={Boolean(viewUser)}
        title="Thông tin người dùng"
        onClose={() => setViewUser(null)}
        actions={
          <button type="button" className="dlg-btn is-primary" onClick={() => setViewUser(null)}>
            Đóng
          </button>
        }
      >
        {viewUser && (
          <div className="dlg-text">
            <p>
              <strong>ID:</strong> {viewUser.id}
            </p>
            <p className="dlg-sub">
              <strong>Email:</strong> {viewUser.email || "—"}
            </p>
            <p className="dlg-sub">
              <strong>Tên hiển thị:</strong> {viewUser.displayName || viewUser.name || "—"}
            </p>
            <p className="dlg-sub">
              <strong>Vai trò:</strong> {viewUser.role || "user"}
            </p>
            <p className="dlg-sub">
              <strong>Tạo lúc (Firestore):</strong> {formatTs(viewUser.createdAt)}
            </p>
            <p className="dlg-sub">
              <strong>Tạo tài khoản (Firebase Auth):</strong> {formatTs(viewUser.authCreationTime)}
            </p>
            <p className="dlg-sub">
              <strong>Đăng nhập cuối (Firebase Auth):</strong> {formatTs(viewUser.authLastSignInTime)}
            </p>
            {viewUser.authProviders?.length ? (
              <p className="dlg-sub">
                <strong>Phương thức đăng nhập:</strong> {viewUser.authProviders.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(profileTarget)}
        title="Sửa tên & email"
        onClose={() => setProfileTarget(null)}
        actions={
          <>
            <button type="button" className="dlg-btn" onClick={() => setProfileTarget(null)}>
              Hủy
            </button>
            <button type="button" className="dlg-btn is-primary" onClick={submitProfile}>
              Lưu thông tin
            </button>
          </>
        }
      >
        <div className="dlg-field">
          <span>Tên hiển thị</span>
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Tên hiển thị"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Email</span>
          <input
            type="email"
            value={profileEmail}
            onChange={(e) => setProfileEmail(e.target.value)}
            placeholder="email@domain.com"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 16 }}>
          <span>Mật khẩu (quên mật khẩu)</span>
          <p className="dlg-sub" style={{ margin: "8px 0 10px" }}>
            Đặt mật khẩu tạm <strong>11111111</strong> trên Firebase Auth. Thông báo cho người dùng đổi lại sau khi đăng nhập.
          </p>
          <button
            type="button"
            className="admin-danger-outline"
            onClick={() => profileTarget && handleResetPassword(profileTarget)}
          >
            Reset mật khẩu
          </button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(roleTarget)}
        title="Phân quyền"
        onClose={() => setRoleTarget(null)}
        actions={
          <>
            <button type="button" className="dlg-btn" onClick={() => setRoleTarget(null)}>
              Hủy
            </button>
            <button type="button" className="dlg-btn is-primary" onClick={submitRole}>
              Lưu vai trò
            </button>
          </>
        }
      >
        <p className="dlg-sub" style={{ marginBottom: 12 }}>
          Người dùng: <strong>{roleTarget?.email}</strong>
        </p>
        <div className="dlg-field">
          <span>Vai trò</span>
          <select
            value={roleValue}
            onChange={(e) => setRoleValue(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              fontSize: 14,
            }}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title="Xóa người dùng?"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button type="button" className="dlg-btn" onClick={() => setDeleteTarget(null)}>
              Hủy
            </button>
            <button type="button" className="dlg-btn is-danger" onClick={confirmDelete}>
              Xóa vĩnh viễn
            </button>
          </>
        }
      >
        <p className="dlg-text">
          Xóa <strong>{deleteTarget?.email}</strong>? Tài khoản sẽ bị xóa khỏi Firebase Authentication và
          Firestore. Hành động không thể hoàn tác.
        </p>
      </Dialog>

      <Dialog
        open={Boolean(chatHistoryUser)}
        title={chatHistoryUser ? `Lịch sử chat — ${chatHistoryUser.email || ""}` : ""}
        onClose={() => {
          setChatHistoryUser(null);
          setChatHistoryPayload(null);
        }}
        actions={
          <button
            type="button"
            className="dlg-btn is-primary"
            onClick={() => {
              setChatHistoryUser(null);
              setChatHistoryPayload(null);
            }}
          >
            Đóng
          </button>
        }
      >
        <p className="dlg-sub">
          Dữ liệu do client đồng bộ lên server (tối đa ~1MB). Hiển thị tối đa 30 tin nhắn cuối mỗi hội thoại.
        </p>
        {chatHistoryLoading ? (
          <p className="dlg-text">Đang tải…</p>
        ) : (
          <ChatHistoryContent payload={chatHistoryPayload} />
        )}
      </Dialog>

      <Dialog
        open={ingestOpen}
        title="Cập nhật tri thức"
        onClose={closeIngestDialog}
        actions={
          <>
            <button type="button" className="dlg-btn" disabled={ingestBusy} onClick={closeIngestDialog}>
              Hủy
            </button>
            <button type="button" className="dlg-btn is-primary" disabled={ingestBusy} onClick={handleSubmitIngest}>
              {ingestBusy ? "Đang xử lý..." : "Thực hiện"}
            </button>
          </>
        }
      >
        <div className="dlg-field">
          <span>Chế độ</span>
          <select
            value={ingestMode}
            onChange={(e) => setIngestMode(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              fontSize: 14,
            }}
          >
            <option value="pdf">Nạp file PDF</option>
            <option value="web">Nạp URL Web</option>
          </select>
        </div>

        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Domain</span>
          <input
            value={ingestDomain}
            onChange={(e) => setIngestDomain(e.target.value)}
            placeholder="general"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Topic</span>
          <input
            value={ingestTopic}
            onChange={(e) => setIngestTopic(e.target.value)}
            placeholder="general"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Priority</span>
          <select
            value={ingestPriority}
            onChange={(e) => setIngestPriority(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              fontSize: 14,
            }}
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Status</span>
          <select
            value={ingestStatus}
            onChange={(e) => setIngestStatus(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              fontSize: 14,
            }}
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="draft">draft</option>
          </select>
        </div>

        {ingestMode === "pdf" ? (
          <div className="dlg-field" style={{ marginTop: 12 }}>
            <span>File PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setIngestFile(e.target.files?.[0] || null)}
            />
          </div>
        ) : (
          <>
            <div className="dlg-field" style={{ marginTop: 12 }}>
              <span>URL</span>
              <input
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
            </div>
            <div className="dlg-field" style={{ marginTop: 12 }}>
              <span>Số link tối đa (news)</span>
              <input
                type="number"
                min={1}
                max={20}
                value={ingestLimit}
                onChange={(e) => setIngestLimit(Number(e.target.value) || 5)}
              />
            </div>
          </>
        )}
      </Dialog>

      <Dialog
        open={addOpen}
        title="Thêm người dùng mới"
        onClose={closeAdd}
        actions={
          <>
            <button type="button" className="dlg-btn" disabled={addBusy} onClick={closeAdd}>
              Hủy
            </button>
            <button type="button" className="dlg-btn is-primary" disabled={addBusy} onClick={submitAdd}>
              {addBusy ? "Đang tạo…" : "Tạo tài khoản"}
            </button>
          </>
        }
      >
        <div className="dlg-field">
          <span>Tên hiển thị</span>
          <input
            value={addDisplayName}
            onChange={(e) => setAddDisplayName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Email</span>
          <input
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Mật khẩu</span>
          <input
            type="password"
            value={addPassword}
            onChange={(e) => setAddPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
          />
        </div>
        <div className="dlg-field" style={{ marginTop: 12 }}>
          <span>Vai trò ban đầu</span>
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              fontSize: 14,
            }}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </Dialog>
    </div>
  );
}



