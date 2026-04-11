import React from "react";

export default function FormField({
  id,
  label,
  required = false,
  error = "",
  hint = "",
  children,
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {required && <span className="text-xs font-bold text-rose-500">*</span>}
      </div>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-rose-500">{error}</p>}
    </label>
  );
}
