import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchUserById, updateThemePref as saveThemePref } from "../api/users";

const ThemeContext = createContext(null);

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

// Holds "light" | "dark" for the whole app and applies it by toggling a
// `dark` class on <html> (see index.css's `@custom-variant dark` and the
// `.dark …` token overrides) — deliberately never localStorage. The
// source of truth is users.theme_pref in the DB: `user` (passed down from
// App.jsx, the same object it already tracks for auth) drives a re-fetch
// whenever a session (re)appears — a fresh login, or a page reload where
// the session was already cached — so the right theme loads on reload
// without ever reading it back out of the browser. Before any user is
// known (Login screen) this falls back to the OS-level preference, which
// is a media query, not stored state.
export function ThemeProvider({ user, children }) {
  const [theme, setTheme] = useState(() => (systemPrefersDark() ? "dark" : "light"));

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    // Apply whatever the login response already carried immediately (no
    // flash of the wrong theme), then reconcile with a fresh fetch in
    // case it was changed elsewhere since that login happened.
    if (user.themePref === "light" || user.themePref === "dark") {
      setTheme(user.themePref);
    }
    fetchUserById(user.id)
      .then((fresh) => {
        if (!cancelled && (fresh.themePref === "light" || fresh.themePref === "dark")) {
          setTheme(fresh.themePref);
        }
      })
      .catch(() => {
        // Keep whatever we already applied above.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (user?.id) {
        // Best-effort: the toggle still applies to this session even if
        // the write fails (e.g. a transient network hiccup) — it just
        // won't be remembered on the next login.
        saveThemePref(user.id, next).catch(() => {});
      }
      return next;
    });
  }, [user]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
