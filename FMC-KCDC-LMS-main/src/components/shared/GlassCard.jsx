import React from "react";

/*
 * Shared frosted-glass surface classes. Exported as plain strings (not just
 * the <GlassCard> component below) because most existing cards build their
 * className with template literals for active/error/etc. states — pulling
 * these in keeps every surface visually identical without restructuring
 * that logic. Only the outer panel gets the blur; nested content chips
 * (file rows, comment boxes, small info bubbles) intentionally stay solid
 * so text sitting on text never doubles up the blur and hurts legibility.
 */

// Opacity-suffixed utilities (bg-white/70) aren't practical to re-target
// with the plain-selector remap in index.css, so these three get explicit
// dark: companions here instead — a translucent dark surface against the
// dark page gradient (App.jsx), not an inverted white-on-black.

// Default glass panel — cards, list rows, form panels.
export const GLASS =
  "rounded-2xl border border-white/50 bg-white/70 shadow-lg shadow-slate-900/5 backdrop-blur-lg dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/30";

// Higher-opacity variant for text-dense panels (detail pages, long forms)
// where /70 starts to fight with the amount of small text on top of it.
export const GLASS_SOLID =
  "rounded-2xl border border-white/60 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-lg dark:border-white/10 dark:bg-slate-900/75 dark:shadow-black/30";

// Muted variant for dashed "preview" / empty-state placeholders.
export const GLASS_SUBTLE =
  "rounded-2xl border border-dashed border-white/60 bg-white/50 backdrop-blur-lg dark:border-white/10 dark:bg-slate-900/40";

export default function GlassCard({
  as: Tag = "div",
  solid = false,
  className = "",
  children,
  ...props
}) {
  return (
    <Tag className={`${solid ? GLASS_SOLID : GLASS} ${className}`} {...props}>
      {children}
    </Tag>
  );
}
