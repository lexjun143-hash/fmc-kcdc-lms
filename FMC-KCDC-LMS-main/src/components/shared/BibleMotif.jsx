import React from "react";

/*
 * Purely decorative 3D-styled Bible — CSS/SVG only, no model libraries.
 * Built as three flat quads (top page-edge, left spine, front cover) offset
 * to fake an isometric 3D read, plus a ribbon bookmark and a soft ground
 * shadow. `aria-hidden` + `pointer-events-none` so it can be placed right
 * over a header/form area without ever intercepting a click — which is
 * also why the motion is a continuous gentle float rather than a
 * hover-triggered one (a decorative element nobody can hover has no way to
 * animate otherwise).
 */
export default function BibleMotif({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none animate-float ${className}`}
    >
      <svg viewBox="0 0 110 135" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="bibleCover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="55%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="bibleSpine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f3d24" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="biblePages" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffdf5" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>
          <linearGradient id="bibleRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="bibleCross" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <radialGradient id="bibleShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ground shadow */}
        <ellipse cx="52" cy="122" rx="42" ry="8" fill="url(#bibleShadow)" />

        {/* ribbon bookmark, drawn first so the cover overlaps its top */}
        <path
          d="M67 18 L76 18 L76 122 L71.5 114 L67 122 Z"
          fill="url(#bibleRibbon)"
        />

        {/* top face — page edges */}
        <polygon
          points="25,30 85,30 69,16 9,16"
          fill="url(#biblePages)"
          stroke="#e2b455"
          strokeWidth="0.5"
        />
        {[19, 21.5, 24, 26.5].map((y, i) => (
          <line
            key={i}
            x1={9 + i * 1.2}
            y1={y - 1.5}
            x2={69 + i * 1.2}
            y2={y - 1.5}
            stroke="#e7c98a"
            strokeWidth="0.6"
            opacity="0.8"
          />
        ))}

        {/* left face — spine */}
        <polygon
          points="25,30 9,16 9,96 25,110"
          fill="url(#bibleSpine)"
        />

        {/* front face — cover */}
        <polygon
          points="25,30 85,30 85,110 25,110"
          fill="url(#bibleCover)"
        />

        {/* embossed border */}
        <rect
          x="32"
          y="38"
          width="46"
          height="64"
          rx="3"
          fill="none"
          stroke="#fbbf24"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />

        {/* cross emblem */}
        <rect x="52.5" y="50" width="5" height="34" rx="1.5" fill="url(#bibleCross)" />
        <rect x="41" y="61.5" width="28" height="5" rx="1.5" fill="url(#bibleCross)" />

        {/* cover sheen */}
        <polygon points="25,30 40,30 25,60" fill="#ffffff" opacity="0.08" />
      </svg>
    </div>
  );
}
