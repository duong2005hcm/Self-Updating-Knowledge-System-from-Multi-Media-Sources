import React, { useEffect } from "react";

export default function Dialog({ open, title, children, actions, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="dlg-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="dlg" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dlg-body">
          <div className="dlg-title">{title}</div>
          <div className="dlg-content">{children}</div>
        </div>
        <div className="dlg-actions">{actions}</div>
      </div>
    </div>
  );
}

