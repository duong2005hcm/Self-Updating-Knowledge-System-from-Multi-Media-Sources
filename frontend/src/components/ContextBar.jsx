import React, { useState, useEffect } from "react";
import {
  CheckCircleFilled,
  SyncOutlined,
  ExclamationCircleFilled,
  MessageOutlined,
  PictureOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GlobalOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  CloudDownloadOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import "./ContextBar.css";

/**
 * ContextBar — RAG system status bar
 * Replaces old ChatTopbar. Shows system status, mode, sources, model, latency, processing steps.
 *
 * Props:
 *  tool      — current active tool key (chat, image-gen, deep-research, etc.)
 *  status    — "ready" | "processing" | "error"  (from parent or derived)
 *  sources   — "pdf" | "web" | "hybrid"
 *  model     — model name string
 *  latency   — number (ms) or null
 *  step      — current processing step key or null
 */

const STATUS_CONFIG = {
  ready:      { color: "#22c55e", label: "Ready",      Icon: CheckCircleFilled },
  processing: { color: "#f59e0b", label: "Processing", Icon: SyncOutlined },
  error:      { color: "#ef4444", label: "Error",      Icon: ExclamationCircleFilled },
};

const MODE_CONFIG = {
  chat:            { label: "Chat",      Icon: MessageOutlined },
  "ingest-doc":    { label: "Upload",    Icon: FileTextOutlined },
  "ingest-web":    { label: "Web",       Icon: GlobalOutlined },
  "image-gen":     { label: "Image",     Icon: PictureOutlined },
  "deep-research": { label: "Research",  Icon: ExperimentOutlined },
};

const SOURCE_CONFIG = {
  pdf:    { label: "PDF",    Icon: FileTextOutlined },
  web:    { label: "Web",    Icon: GlobalOutlined },
  hybrid: { label: "Hybrid", Icon: DatabaseOutlined },
};

const PROCESSING_STEPS = [
  { key: "searching",  label: "Searching",  Icon: SearchOutlined },
  { key: "retrieving", label: "Retrieving", Icon: CloudDownloadOutlined },
  { key: "generating", label: "Generating", Icon: ThunderboltOutlined },
];

export default function ContextBar({
  tool = "chat",
  status = "ready",
  sources = "hybrid",
  model = "SIMLESI v2.0",
  latency = null,
  step = null,
}) {
  // Derive processing step info
  const isProcessing = status === "processing";
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.ready;
  const modeCfg = MODE_CONFIG[tool] || MODE_CONFIG.chat;
  const sourceCfg = SOURCE_CONFIG[sources] || SOURCE_CONFIG.hybrid;

  // Animated latency counter during processing
  const [displayLatency, setDisplayLatency] = useState(latency);
  useEffect(() => {
    if (!isProcessing) {
      setDisplayLatency(latency);
      return;
    }
    // Simulate counting
    const start = Date.now();
    const interval = setInterval(() => {
      setDisplayLatency(Date.now() - start);
    }, 100);
    return () => clearInterval(interval);
  }, [isProcessing, latency]);

  return (
    <div className="cb" role="status" aria-label="System context">
      {/* ── Left: Status + Mode ── */}
      <div className="cb-left">
        {/* Status indicator */}
        <div className={`cb-status cb-status--${status}`}>
          <statusCfg.Icon
            className="cb-status-icon"
            spin={status === "processing"}
            style={{ color: statusCfg.color }}
          />
          <span className="cb-status-label">{statusCfg.label}</span>
        </div>

        <div className="cb-sep" />

        {/* Mode tag */}
        <div className="cb-tag cb-tag--mode">
          <modeCfg.Icon className="cb-tag-icon" />
          <span>{modeCfg.label}</span>
        </div>

        {/* Source tag */}
        <div className="cb-tag cb-tag--source">
          <sourceCfg.Icon className="cb-tag-icon" />
          <span>{sourceCfg.label}</span>
        </div>
      </div>

      {/* ── Center: Processing steps ── */}
      {isProcessing && (
        <div className="cb-center">
          <div className="cb-steps">
            {PROCESSING_STEPS.map((s) => {
              const isActive = s.key === step;
              const isDone =
                step &&
                PROCESSING_STEPS.findIndex((x) => x.key === step) >
                  PROCESSING_STEPS.findIndex((x) => x.key === s.key);
              return (
                <div
                  key={s.key}
                  className={`cb-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
                >
                  <s.Icon
                    className="cb-step-icon"
                    spin={isActive}
                  />
                  <span className="cb-step-text">{s.label}</span>
                  {isActive && (
                    <span className="cb-step-dots">
                      <span className="cb-dot" />
                      <span className="cb-dot" />
                      <span className="cb-dot" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Right: Model + Latency ── */}
      <div className="cb-right">
        <div className="cb-tag cb-tag--model">
          <ApiOutlined className="cb-tag-icon" />
          <span>{model}</span>
        </div>

        {displayLatency != null && (
          <div className={`cb-latency ${isProcessing ? "is-counting" : ""}`}>
            <ClockCircleOutlined className="cb-latency-icon" />
            <span>
              {displayLatency < 1000
                ? `${Math.round(displayLatency)}ms`
                : `${(displayLatency / 1000).toFixed(1)}s`}
            </span>
          </div>
        )}

        {typeof onLogout === "function" && (
          <>
            <div className="cb-sep" />
            <button
              type="button"
              className="cb-logout"
              onClick={onLogout}
              title="Đăng xuất"
            >
              <LogoutOutlined />
              <span className="cb-logout-text">Đăng xuất</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
