import React, { useMemo, useState } from "react";
import { submitContact } from "../../services/contactApi";
import FormField from "./FormField";

const INTEREST_OPTIONS = ["Web", "PDF", "RSS", "Video", "Tài liệu nội bộ"];

const FORM_META = {
  consultation: {
    submitLabel: "Gửi yêu cầu tư vấn",
    messagePlaceholder: "Mô tả nhu cầu tư vấn của bạn...",
  },
  demo: {
    submitLabel: "Gửi yêu cầu demo",
    messagePlaceholder: "Mô tả bối cảnh demo bạn muốn xem...",
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_VALUES = {
  fullName: "",
  phone: "",
  email: "",
  company: "",
  message: "",
  interests: [],
  usageScale: "",
};

function validate(values) {
  const errors = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Vui lòng nhập họ và tên.";
  }

  if (!values.phone.trim() && !values.email.trim()) {
    errors.phone = "Vui lòng nhập số điện thoại hoặc email.";
    errors.email = "Vui lòng nhập số điện thoại hoặc email.";
  }

  if (values.email.trim() && !EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Email không đúng định dạng.";
  }

  return errors;
}

function normalizeError(error) {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  return "Gửi yêu cầu thất bại. Vui lòng thử lại.";
}

export default function ContactForm({
  type = "consultation",
  onSuccess,
  onCancel,
}) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState("idle");
  const [apiError, setApiError] = useState("");
  const errors = useMemo(() => validate(values), [values]);
  const isValid = Object.keys(errors).length === 0;
  const meta = FORM_META[type] || FORM_META.consultation;

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setValues((prev) => ({ ...prev, [field]: nextValue }));
    if (status !== "idle") setStatus("idle");
    if (apiError) setApiError("");
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const toggleInterest = (interest) => {
    setValues((prev) => {
      const exists = prev.interests.includes(interest);
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter((item) => item !== interest)
          : [...prev.interests, interest],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setTouched({
      fullName: true,
      phone: true,
      email: true,
      company: true,
      message: true,
      usageScale: true,
    });

    if (!isValid) return;

    setStatus("loading");
    setApiError("");

    try {
      await submitContact({
        type,
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        company: values.company.trim(),
        message: values.message.trim(),
        interests: values.interests,
        usageScale: values.usageScale.trim(),
      });

      setStatus("success");
      setValues(INITIAL_VALUES);
      setTouched({});
      setSubmitted(false);
      onSuccess?.(type);
    } catch (error) {
      setStatus("error");
      setApiError(normalizeError(error));
    }
  };

  const shouldShowError = (field) => (submitted || touched[field]) && errors[field];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        id="contact-full-name"
        label="Họ và tên"
        required
        error={shouldShowError("fullName")}
      >
        <input
          id="contact-full-name"
          type="text"
          value={values.fullName}
          onChange={handleChange("fullName")}
          onBlur={handleBlur("fullName")}
          placeholder="Nguyễn Văn A"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="contact-phone"
          label="Số điện thoại"
          error={shouldShowError("phone")}
        >
          <input
            id="contact-phone"
            type="tel"
            value={values.phone}
            onChange={handleChange("phone")}
            onBlur={handleBlur("phone")}
            placeholder="0900000000"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </FormField>

        <FormField
          id="contact-email"
          label="Email"
          error={shouldShowError("email")}
        >
          <input
            id="contact-email"
            type="email"
            value={values.email}
            onChange={handleChange("email")}
            onBlur={handleBlur("email")}
            placeholder="name@company.com"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </FormField>
      </div>

      <FormField id="contact-company" label="Tên công ty / tổ chức">
        <input
          id="contact-company"
          type="text"
          value={values.company}
          onChange={handleChange("company")}
          onBlur={handleBlur("company")}
          placeholder="ABC Corp"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </FormField>

      <FormField
        id="contact-message"
        label="Nhu cầu / nội dung cần tư vấn"
      >
        <textarea
          id="contact-message"
          value={values.message}
          onChange={handleChange("message")}
          onBlur={handleBlur("message")}
          placeholder={meta.messagePlaceholder}
          className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </FormField>

      <FormField
        id="contact-interests"
        label="Nguồn dữ liệu quan tâm"
        hint="Chọn một hoặc nhiều nguồn."
      >
        <div id="contact-interests" className="mt-1 flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((option) => {
            const checked = values.interests.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleInterest(option)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  checked
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
      </FormField>

      <FormField
        id="contact-usage-scale"
        label="Quy mô sử dụng hoặc ghi chú thêm"
      >
        <input
          id="contact-usage-scale"
          type="text"
          value={values.usageScale}
          onChange={handleChange("usageScale")}
          onBlur={handleBlur("usageScale")}
          placeholder="Ví dụ: 50 nhân sự, 3 phòng ban..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </FormField>

      {apiError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
          {apiError}
        </div>
      )}

      {status === "success" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          Gửi yêu cầu thành công.
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={!isValid || status === "loading"}
          className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Đang gửi..." : meta.submitLabel}
        </button>
      </div>
    </form>
  );
}
