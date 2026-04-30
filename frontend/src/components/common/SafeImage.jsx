import { FileText, HeartPulse, ImageIcon, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";

const fallbackConfig = {
  medical: {
    icon: HeartPulse,
    label: "Chưa có ảnh",
  },
  article: {
    icon: Newspaper,
    label: "Chưa có ảnh",
  },
  document: {
    icon: FileText,
    label: "Chưa có ảnh",
  },
  default: {
    icon: ImageIcon,
    label: "Chưa có ảnh",
  },
};

export default function SafeImage({
  src,
  alt = "",
  className = "h-full w-full object-cover",
  fallbackType = "article",
  fallbackLabel,
  aspectRatio,
  height,
}) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = typeof src === "string" ? src.trim() : "";
  const config = fallbackConfig[fallbackType] || fallbackConfig.default;
  const Icon = config.icon;
  const label = fallbackLabel || config.label;
  const style = {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(height ? { height } : {}),
  };

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  if (imageUrl && !hasError) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        style={style}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-sky-100 via-cyan-100 to-emerald-100 p-5 text-center text-slate-600 ${className}`}
      style={style}
      role="img"
      aria-label={alt || label}
    >
      <span className="rounded-2xl bg-white/80 p-3 text-brand-700 shadow-sm">
        <Icon className="h-7 w-7" />
      </span>
      <span className="max-w-[80%] text-sm font-bold text-slate-700">
        {label}
      </span>
      {fallbackLabel ? (
        <span className="text-xs font-medium text-slate-500">Chưa có ảnh</span>
      ) : null}
    </div>
  );
}
