import { ImagePlus, X } from "lucide-react";
import SafeImage from "../common/SafeImage";

export default function ImageUploader({
  previewUrl,
  fileName,
  error,
  onFileChange,
  onClear,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-ink">Ảnh đại diện</div>
          <div className="mt-1 text-xs text-slate-500">PNG, JPEG hoặc WebP, tối đa 5MB.</div>
        </div>
        {previewUrl ? (
          <button type="button" className="btn-ghost px-3 py-2" onClick={onClear}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-white p-5 text-center transition hover:border-brand-400">
        {previewUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-100">
            <SafeImage
              src={previewUrl}
              alt="Preview ảnh bài viết"
              fallbackType="article"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="rounded-2xl bg-brand-50 p-3 text-brand-700">
              <ImagePlus className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-slate-700">Chọn ảnh cho bài viết</span>
          </div>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        />
      </label>

      {fileName ? <div className="mt-3 text-xs text-slate-500">{fileName}</div> : null}
      {error ? <div className="mt-3 text-sm font-semibold text-rose-600">{error}</div> : null}
    </div>
  );
}
