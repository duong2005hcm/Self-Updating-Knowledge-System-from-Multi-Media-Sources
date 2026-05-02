import { AlertTriangle, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SafeImage from "../common/SafeImage";
import { formatDateTime } from "../../lib/utils";
import { BLOG_TOPICS } from "./blogOptions";
import ImageUploader from "./ImageUploader";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const initialForm = {
  title: "",
  excerpt: "",
  content: "",
  topic: "Tin tức",
  tags: "",
  image_url: "",
  published_at: "",
  source_url: "",
  confirm: false,
};

function validateImage(file) {
  if (!file) return "";
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Ảnh phải là PNG, JPEG hoặc WebP.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Ảnh không được vượt quá 5MB.";
  }
  return "";
}

function validateImageUrl(value) {
  const nextValue = value.trim();
  if (!nextValue) return "";
  if (!nextValue.startsWith("https://")) {
    return "URL ảnh đại diện phải bắt đầu bằng https://.";
  }

  try {
    const url = new URL(nextValue);
    if (url.protocol !== "https:") {
      return "URL ảnh đại diện phải bắt đầu bằng https://.";
    }
  } catch {
    return "URL ảnh đại diện không hợp lệ.";
  }

  return "";
}

function validateDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Thời gian bài viết không hợp lệ.";
  }
  return "";
}

function validateForm(form, imageError) {
  if (form.title.trim().length < 10) {
    return "Tiêu đề bài viết tối thiểu 10 ký tự.";
  }
  if (!form.excerpt.trim()) {
    return "Vui lòng nhập mô tả ngắn.";
  }
  if (form.content.trim().length < 50) {
    return "Nội dung bài viết tối thiểu 50 ký tự.";
  }
  if (!form.topic) {
    return "Vui lòng chọn chủ đề.";
  }
  if (imageError) {
    return imageError;
  }
  const imageUrlError = validateImageUrl(form.image_url);
  if (imageUrlError) {
    return imageUrlError;
  }
  const dateTimeError = validateDateTime(form.published_at);
  if (dateTimeError) {
    return dateTimeError;
  }
  if (!form.confirm) {
    return "Vui lòng xác nhận nội dung chỉ mang tính tham khảo.";
  }
  return "";
}

export default function ArticleForm({
  currentUser,
  isSubmitting,
  submitError,
  submitSuccess,
  canPersistImageUpload = false,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const previewArticle = useMemo(
    () => ({
      title: form.title || "Tiêu đề bài viết",
      excerpt: form.excerpt || "Mô tả ngắn sẽ hiển thị tại đây.",
      topic: form.topic,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      image_url: imagePreviewUrl || form.image_url.trim(),
      author_name: currentUser?.displayName || currentUser?.email || "Người dùng",
      published_at: form.published_at || new Date().toISOString(),
    }),
    [currentUser?.displayName, currentUser?.email, form, imagePreviewUrl]
  );

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleImageChange = (file) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);

    const nextError = validateImage(file);
    setImageError(nextError);
    setImageFile(nextError ? null : file);
    setImagePreviewUrl(file && !nextError ? URL.createObjectURL(file) : "");
  };

  const clearImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl("");
    setImageError("");
  };

  const submit = (event) => {
    event.preventDefault();
    const nextError = validateForm(form, imageError);
    setValidationError(nextError);
    if (nextError) return;
    onSubmit({
      ...form,
      imageFile,
      localPreviewUrl: imagePreviewUrl,
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-2xl border border-white/70 bg-white p-6 shadow-soft">
        <div className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Tiêu đề bài viết</span>
            <input
              className="input-base"
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              placeholder="Ví dụ: Các dấu hiệu cần chú ý khi bị sốt kéo dài"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Mô tả ngắn / excerpt</span>
            <textarea
              className="input-base min-h-[110px] resize-y"
              value={form.excerpt}
              onChange={(event) => setField("excerpt", event.target.value)}
              placeholder="Tóm tắt nội dung chính của bài viết."
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Nội dung bài viết</span>
            <textarea
              className="input-base min-h-[260px] resize-y"
              value={form.content}
              onChange={(event) => setField("content", event.target.value)}
              placeholder="Chia sẻ thông tin sức khỏe, kinh nghiệm đọc nguồn tin y tế hoặc tài liệu tham khảo..."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Chủ đề</span>
              <select
                className="input-base"
                value={form.topic}
                onChange={(event) => setField("topic", event.target.value)}
              >
                {BLOG_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Tags</span>
              <input
                className="input-base"
                value={form.tags}
                onChange={(event) => setField("tags", event.target.value)}
                placeholder="sốt, hô hấp, phòng bệnh"
              />
            </label>
          </div>

          <ImageUploader
            previewUrl={imagePreviewUrl}
            fileName={imageFile?.name}
            error={imageError}
            onFileChange={handleImageChange}
            onClear={clearImage}
          />

          {imageFile && !canPersistImageUpload ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              Chưa cấu hình lưu ảnh lên server. Vui lòng dùng URL ảnh để ảnh hiển thị sau khi đăng.
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">URL ảnh đại diện</span>
            <input
              className="input-base"
              type="url"
              value={form.image_url}
              onChange={(event) => setField("image_url", event.target.value)}
              placeholder="https://example.com/health-cover.jpg"
            />
            <span className="text-xs leading-5 text-slate-500">
              Dán link ảnh HTTPS để ảnh được lưu vào bài viết. File local chỉ dùng preview nếu chưa cấu hình Firebase Storage.
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Thời gian bài viết</span>
            <input
              className="input-base"
              type="datetime-local"
              value={form.published_at}
              onChange={(event) => setField("published_at", event.target.value)}
            />
            <span className="text-xs leading-5 text-slate-500">
              Dùng để admin dễ quản lý bài theo mốc thời gian. Nếu để trống, hệ thống dùng thời điểm gửi bài.
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Nguồn tham khảo / source_url</span>
            <input
              className="input-base"
              value={form.source_url}
              onChange={(event) => setField("source_url", event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <input
              type="checkbox"
              checked={form.confirm}
              onChange={(event) => setField("confirm", event.target.checked)}
              className="mt-1"
            />
            <span>
              Tôi xác nhận nội dung chỉ mang tính tham khảo và không thay thế tư vấn y tế chuyên môn.
            </span>
          </label>

          {validationError || submitError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{validationError || submitError}</span>
            </div>
          ) : null}

          {submitSuccess ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {submitSuccess}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              <Send className="h-4 w-4" />
              {isSubmitting ? "Đang đăng bài..." : "Đăng bài"}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              <X className="h-4 w-4" />
              Hủy
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            Bài viết chỉ có giá trị tham khảo, không thay thế tư vấn, chẩn đoán hoặc điều trị từ bác sĩ/chuyên gia y tế.
          </div>
        </div>
      </div>

      <aside className="rounded-2xl border border-white/70 bg-white p-6 shadow-soft">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">
          Preview
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <div className="aspect-video w-full overflow-hidden bg-slate-100">
            <SafeImage
              src={previewArticle.image_url}
              alt={previewArticle.title}
              fallbackType="article"
              fallbackLabel={previewArticle.topic}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span>{previewArticle.topic}</span>
              <span>{previewArticle.author_name}</span>
              <span>{formatDateTime(previewArticle.published_at)}</span>
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold leading-8 text-ink">
              {previewArticle.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{previewArticle.excerpt}</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
