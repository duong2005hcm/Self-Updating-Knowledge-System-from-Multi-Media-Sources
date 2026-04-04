import React, { useId, useState, useRef, useEffect, useCallback } from "react";
import {
  PlusOutlined,
  SendOutlined,
  LoadingOutlined,
  FileImageOutlined,
  PictureOutlined,
  ExperimentOutlined,
  SearchOutlined,
  EllipsisOutlined,
  ReadOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  CloseOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import { askRAG, logQuestionAsked, logTokens } from "../api/ragapi";
import "./ChatInputBar.css";

/**
 * ChatInputBar — ChatGPT-style pill input with "+" dropdown menu
 *
 * Props: setMessages (updater), onSuggestion (string from welcome screen)
 */
export default function ChatInputBar({ setMessages, onSuggestion }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [files, setFiles] = useState([]);

  const fileInputRef = useRef(null);

  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const rid = useId();

  // ── Accept suggestion from Welcome screen ──
  useEffect(() => {
    if (onSuggestion) {
      setText(onSuggestion);
      textareaRef.current?.focus();
    }
  }, [onSuggestion]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [text]);

  // ── Close menu on outside click ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── File helpers ──
  const isImageFile = (file) => file.type?.startsWith("image/");

  const handleFilesSelected = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      name: file.name,
      isImage: isImageFile(file),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // ── Send message ──
  const hasContent = text.trim() || files.length > 0;

  const handleSend = useCallback(async () => {
    const question = text.trim();
    if ((!question && files.length === 0) || loading) return;

    // Build message content (include file names if attached)
    const fileNames = files.map((f) => f.name).join(", ");
    const fullContent = fileNames
      ? question
        ? `${question}\n\n📎 Đính kèm: ${fileNames}`
        : `📎 Đính kèm: ${fileNames}`
      : question;

    const userId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const pendingId = `${userId}-pending`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: fullContent },
      { id: pendingId, role: "assistant", content: "Đang suy nghĩ…", pending: true },
    ]);

    setLoading(true);
    setText("");
    setFiles([]);

    try {
      const res = await askRAG(question || fileNames);
      const answer = res?.answer || "Không có câu trả lời";

      void logQuestionAsked();
      let tok = 0;
      const u = res?.usage;
      if (u && typeof u.total_tokens === "number") tok = u.total_tokens;
      else if (typeof res?.total_tokens === "number") tok = res.total_tokens;
      else tok = Math.ceil((fullContent.length + (answer?.length || 0)) / 4);
      void logTokens(tok);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: answer, pending: false } : m
        )
      );
    } catch (err) {
      console.error("API ERROR:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: "Lỗi kết nối. Vui lòng thử lại sau.", pending: false, error: true }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [text, files, loading, setMessages]);

  // ── Menu item click handler ──
  const handleMenuAction = (action) => {
    setMenuOpen(false);
    setMoreOpen(false);

    if (action === "add-files") {
      openFilePicker();
      return;
    }
    // Placeholder — hook into actual features later
    console.log("Menu action:", action);
  };

  return (
    <div className="ci-area">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFilesSelected(e.target.files);
          }
          e.target.value = "";
        }}
      />

      <div className={`ci-pill ${files.length > 0 ? "has-files" : ""}`}>
        {/* ── "+" Button with Dropdown ── */}
        <div className="ci-plus-wrap" ref={menuRef}>
          <button
            type="button"
            className={`ci-plus-btn ${menuOpen ? "is-open" : ""}`}
            onClick={() => {
              setMenuOpen((v) => !v);
              setMoreOpen(false);
            }}
            aria-label="Thêm"
            aria-expanded={menuOpen}
            id="chat-add-btn"
          >
            <PlusOutlined />
          </button>

          {/* ── Dropdown Menu ── */}
          {menuOpen && (
            <div className="ci-menu" role="menu">
              <button
                className="ci-menu-item"
                onClick={() => handleMenuAction("add-files")}
                role="menuitem"
              >
                <FileImageOutlined className="ci-menu-icon" />
                <span>Add photos & files</span>
              </button>

              <button
                className="ci-menu-item"
                onClick={() => handleMenuAction("create-image")}
                role="menuitem"
              >
                <PictureOutlined className="ci-menu-icon" />
                <span>Create image</span>
              </button>

              <button
                className="ci-menu-item"
                onClick={() => handleMenuAction("deep-research")}
                role="menuitem"
              >
                <ExperimentOutlined className="ci-menu-icon" />
                <span>Deep research</span>
              </button>

              <button
                className="ci-menu-item"
                onClick={() => handleMenuAction("web-search")}
                role="menuitem"
              >
                <SearchOutlined className="ci-menu-icon" />
                <span>Web search</span>
              </button>

              <div className="ci-menu-divider" />

              {/* ── "More" with submenu ── */}
              <div className="ci-menu-more-wrap">
                <button
                  className={`ci-menu-item ci-menu-item--more ${moreOpen ? "is-active" : ""}`}
                  onClick={() => setMoreOpen((v) => !v)}
                  role="menuitem"
                  aria-expanded={moreOpen}
                >
                  <EllipsisOutlined className="ci-menu-icon" />
                  <span>More</span>
                  <span className="ci-menu-chevron">{moreOpen ? "‹" : "›"}</span>
                </button>

                {/* ── Submenu ── */}
                {moreOpen && (
                  <div className="ci-submenu" role="menu">
                    <button
                      className="ci-menu-item"
                      onClick={() => handleMenuAction("study-learn")}
                      role="menuitem"
                    >
                      <ReadOutlined className="ci-menu-icon" />
                      <span>Study and learn</span>
                    </button>
                    <button
                      className="ci-menu-item"
                      onClick={() => handleMenuAction("canvas")}
                      role="menuitem"
                    >
                      <EditOutlined className="ci-menu-icon" />
                      <span>Canvas</span>
                    </button>
                    <button
                      className="ci-menu-item"
                      onClick={() => handleMenuAction("quizzes")}
                      role="menuitem"
                    >
                      <QuestionCircleOutlined className="ci-menu-icon" />
                      <span>Quizzes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Content column: file tags + textarea ── */}
        <div className="ci-content">
          {/* File Tags */}
          {files.length > 0 && (
            <div className="ci-files">
              {files.map((f) => (
                <div key={f.id} className="ci-file-tag">
                  <span className="ci-file-tag-icon">
                    {f.isImage ? <PictureOutlined /> : <PaperClipOutlined />}
                  </span>
                  <span className="ci-file-tag-name">{f.name}</span>
                  <button
                    className="ci-file-tag-remove"
                    onClick={() => removeFile(f.id)}
                    aria-label={`Xoá ${f.name}`}
                    type="button"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Nhập tin nhắn cho SIMLESI AI..."
            aria-label="Chat message"
            id={`chat-input-${rid}`}
            className="ci-textarea"
            rows={1}
            disabled={loading}
          />
        </div>

        {/* ── Send Button ── */}
        <button
          type="button"
          className={`ci-send-btn ${hasContent ? "is-ready" : ""}`}
          onClick={handleSend}
          disabled={loading || !hasContent}
          aria-label="Gửi tin nhắn"
          id="send-message-btn"
        >
          {loading ? <LoadingOutlined spin /> : <SendOutlined />}
        </button>
      </div>

      <div className="ci-hint">
        SIMLESI AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
      </div>
    </div>
  );
}
