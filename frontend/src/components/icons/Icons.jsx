import React from "react";

/**
 * SIMLESI AI — Custom SVG Icon Set
 * Clean, minimal icons inspired by Lucide / Heroicons
 * All icons accept size (default 20) and color (default "currentColor")
 */

const defaultProps = { size: 20, color: "currentColor" };

function Icon({ size = 20, color = "currentColor", children, className = "", style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

// ─── Brand / Logo ───
export function IconSparkles({ size, color, className, style }) {
  return (
    <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" fill={color || "currentColor"} className={className} style={{ flexShrink: 0, ...style }}>
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  );
}

export function IconSparkle({ size, color, className, style }) {
  return (
    <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" className={className} style={{ flexShrink: 0, ...style }}>
      <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" fill={color || "currentColor"} />
    </svg>
  );
}

// ─── Navigation / Actions ───
export function IconPlus({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

export function IconSend({ size, color, className, style }) {
  return (
    <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" fill={color || "currentColor"} className={className} style={{ flexShrink: 0, ...style }}>
      <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" />
    </svg>
  );
}

export function IconPaperclip({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M21.44 11.05L12.25 20.24C10.4 22.09 7.42 22.09 5.57 20.24C3.72 18.39 3.72 15.41 5.57 13.56L14.76 4.36C15.99 3.13 17.99 3.13 19.22 4.36C20.45 5.59 20.45 7.59 19.22 8.82L10.03 18.01C9.41 18.63 8.42 18.63 7.8 18.01C7.18 17.39 7.18 16.4 7.8 15.78L16.99 6.59" />
    </Icon>
  );
}

export function IconX({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  );
}

export function IconTrash({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6V20C19 21.1 18.1 22 17 22H7C5.9 22 5 21.1 5 20V6" />
      <path d="M8 6V4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6" />
    </Icon>
  );
}

// ─── Communication ───
export function IconMessageSquare({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" />
    </Icon>
  );
}

// ─── Tools ───
export function IconFileText({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </Icon>
  );
}

export function IconGlobe({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z" />
    </Icon>
  );
}

export function IconShield({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" />
      <polyline points="9 12 11 14 15 10" />
    </Icon>
  );
}

// ─── Suggestions ───
export function IconPenLine({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M12 20H21" />
      <path d="M16.5 3.5C16.8978 3.10217 17.4374 2.87868 18 2.87868C18.5626 2.87868 19.1022 3.10217 19.5 3.5C19.8978 3.89782 20.1213 4.43739 20.1213 5C20.1213 5.56261 19.8978 6.10217 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" />
    </Icon>
  );
}

export function IconImage({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </Icon>
  );
}

export function IconFileEdit({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M4 13.5V4C4 3.46957 4.21071 2.96086 4.58579 2.58579C4.96086 2.21071 5.46957 2 6 2H14L20 8V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H12.5" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10.42 12.61C10.615 12.415 10.8465 12.2603 11.1 12.155C11.3536 12.0497 11.6247 11.9961 11.8985 11.9975C12.1723 11.9989 12.4429 12.0553 12.6955 12.1633C12.948 12.2712 13.1776 12.4283 13.37 12.625C13.5653 12.82 13.72 13.0515 13.825 13.305C13.9303 13.5586 13.9839 13.8297 13.9825 14.1035C13.9811 14.3773 13.9247 14.6479 13.8167 14.9005C13.7088 15.153 13.5517 15.3826 13.355 15.575L7.5 21.43L3 22L3.57 17.5L10.42 12.61Z" />
    </Icon>
  );
}

export function IconCode({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="14" y1="4" x2="10" y2="20" />
    </Icon>
  );
}

// ─── User / Auth ───
export function IconLogOut({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}

export function IconUser({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

// ─── Status ───
export function IconLoader({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={{ flexShrink: 0, animation: "spin 1s linear infinite", ...style }}>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </Icon>
  );
}

export function IconBot({ size, color, className, style }) {
  return (
    <Icon size={size} color={color} className={className} style={style}>
      <path d="M12 8V4H8" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M2 14H4" />
      <path d="M20 14H22" />
      <circle cx="9" cy="13" r="1" fill={color || "currentColor"} />
      <circle cx="15" cy="13" r="1" fill={color || "currentColor"} />
      <path d="M10 17H14" />
    </Icon>
  );
}
