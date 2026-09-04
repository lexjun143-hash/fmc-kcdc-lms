import React from "react";

/*
 * Floating 3D-styled Bible used as the login page's hero object (the
 * "object on the right" in a fuse-style glassmorphism panel). Pure
 * SVG/CSS — three flat quads (page-edge top, spine, cover) offset to fake
 * an isometric 3D read, a dual-tone light-blue/gold halo behind it, and a
 * soft diagonal sheen that sweeps across the cover on a loop. Gradient ids
 * are prefixed `ab` so this can share a page with <BibleMotif /> without
 * id collisions. aria-hidden + pointer-events-none so it never intercepts
 * a click, which is also why the motion is a continuous idle float rather
 * than a hover trigger — nothing can hover a decorative object.
 */
export default function AnimatedBible({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none animate-float ${className}`}
      style={{ animationDuration: "7s" }}
    >
      <svg viewBox="0 0 110 150" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="abHaloBlue" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="abHaloGold" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="abCover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="55%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f4c46" />
          </linearGradient>
          <linearGradient id="abSpine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#083a35" />
            <stop offset="100%" stopColor="#0f4c46" />
          </linearGradient>
          <linearGradient id="abPages" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffdf5" />
            <stop offset="100%" stopColor="#fde9c8" />
          </linearGradient>
          <linearGradient id="abRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="abCross" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <radialGradient id="abShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#020617" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="abSheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="abCoverClip">
            <polygon points="25,30 85,30 85,110 25,110" />
          </clipPath>
        </defs>

        {/* dual-tone halo glow, pulsing behind the whole object */}
        <circle cx="52" cy="70" r="62" fill="url(#abHaloBlue)" className="animate-glow-pulse" style={{ transformOrigin: "52px 70px" }} />
        <circle cx="56" cy="82" r="50" fill="url(#abHaloGold)" className="animate-glow-pulse" style={{ transformOrigin: "56px 82px", animationDelay: "1.2s" }} />

        {/* ground shadow */}
        <ellipse cx="52" cy="122" rx="42" ry="8" fill="url(#abShadow)" />

        {/* ribbon bookmark, drawn first so the cover overlaps its top */}
        <path d="M67 18 L76 18 L76 122 L71.5 114 L67 122 Z" fill="url(#abRibbon)" />

        {/* top face — page edges */}
        <polygon points="25,30 85,30 69,16 9,16" fill="url(#abPages)" stroke="#e2b455" strokeWidth="0.5" />
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
        <polygon points="25,30 9,16 9,96 25,110" fill="url(#abSpine)" />

        {/* front face — cover */}
        <polygon points="25,30 85,30 85,110 25,110" fill="url(#abCover)" />

        {/* embossed border */}
        <rect x="32" y="38" width="46" height="64" rx="3" fill="none" stroke="#7dd3fc" strokeOpacity="0.45" strokeWidth="1.2" />

        {/* cross emblem */}
        <rect x="52.5" y="50" width="5" height="34" rx="1.5" fill="url(#abCross)" />
        <rect x="41" y="61.5" width="28" height="5" rx="1.5" fill="url(#abCross)" />

        {/* static cover sheen (corner highlight) */}
        <polygon points="25,30 40,30 25,60" fill="#ffffff" opacity="0.08" />

        {/* animated diagonal shine sweeping across the cover, clipped to it */}
        <g clipPath="url(#abCoverClip)">
          <rect x="0" y="20" width="24" height="110" fill="url(#abSheen)" className="animate-sheen" />
        </g>
      </svg>
    </div>
  );
}
