import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

// `variant="header"` (default) sits on the orange top bar — the header
// itself stays orange in both themes (see requirement to keep the brand
// bar on-brand in dark mode), so this uses a fixed translucent-on-orange
// style rather than the swappable tokens. `variant="surface"` is for
// placing the toggle directly on a themed background (e.g. the login
// page) and reads the same CSS variables everything else does, so it
// always matches whichever mode is active.
export default function ThemeToggle({ variant = "header", className = "", style }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const base =
    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border transition-colors";
  const variantClass =
    variant === "surface"
      ? "border-line bg-card text-ink shadow-sm hover:bg-card-strong"
      : "border-white/30 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      // `style` (not just `className`) is accepted so a caller with its
      // own local CSS variables (e.g. Login.jsx's --login-* tokens) can
      // reliably win over the variant's own utility classes — inline
      // style always beats a class selector, whereas two same-
      // specificity utility classes are order-dependent on Tailwind's
      // generated stylesheet, not on className string order.
      style={style}
      className={`${base} ${variantClass} ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
