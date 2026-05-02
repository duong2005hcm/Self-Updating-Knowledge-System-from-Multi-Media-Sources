import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export default function StarRating({
  value = 0,
  onChange,
  readonly = false,
  size = "md",
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = readonly ? value : hoverValue || value;
  const iconSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHoverValue(0)}
      aria-label={`${value}/5 sao`}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        const active = starValue <= displayValue;
        const Icon = (
          <Star
            className={cn(
              iconSize,
              "transition",
              active ? "fill-amber-400 text-amber-400" : "text-slate-300",
              !readonly && "group-hover:scale-110"
            )}
          />
        );

        if (readonly) {
          return <span key={starValue}>{Icon}</span>;
        }

        return (
          <button
            key={starValue}
            type="button"
            className="group rounded-full p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            aria-label={`Chọn ${starValue} sao`}
            onMouseEnter={() => setHoverValue(starValue)}
            onClick={() => onChange?.(value === starValue ? 0 : starValue)}
          >
            {Icon}
          </button>
        );
      })}
    </div>
  );
}
