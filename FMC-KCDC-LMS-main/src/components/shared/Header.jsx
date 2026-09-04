import React, { useState } from "react";
import { LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import ConfirmDialog from "./ConfirmDialog";

// The header bar stays orange (not a slate/card "surface") in both themes
// on purpose — it's the brand bar. Its color comes from --header-bg/
// --header-bg-end (index.css), a muted terracotta rather than a
// saturated orange, specifically because a bright fill read as harsh
// across the full-width bar. No `dark:` variant is needed here: those
// two variables already carry their own deeper/dimmer dark-mode values,
// so `from-header`/`to-header-end` alone repaint correctly under
// ThemeProvider's `dark` class. Header is the one instance rendered for
// every role (App.jsx mounts it once, above the role-specific nav/page
// content), so gating Logout here behind a confirmation covers
// student/teacher/admin and every page identically — there's nowhere
// else Logout lives to forget.
export default function Header({ onLogout }) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <header className="z-50 flex flex-shrink-0 items-center justify-between bg-gradient-to-r from-orange-400 to-orange-500 px-4 py-3 shadow-sm dark:from-header dark:to-header-end sm:px-6">
      {/* min-w-0 lets the title truncate instead of forcing the row wider
          than the viewport — a flex item's default min-width is `auto`
          (its content's natural width), which overrides truncate/ellipsis
          entirely unless overridden here. */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <img
          src="images/img-logo.png"
          alt=""
          className="h-8 w-8 flex-shrink-0 sm:h-10 sm:w-10"
        />
        <span className="min-w-0 truncate text-base font-bold tracking-wide text-white sm:text-lg">
          {/* Short label below sm (≈360px is already tight for the full
              name at this weight/size), full name from sm up. */}
          <span className="sm:hidden">PH626 Kaakbay CDC</span>
          <span className="hidden sm:inline">
            PH626 Kaakbay Child Development Center LMS
          </span>
        </span>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
        <ThemeToggle />
        <button
          onClick={() => setConfirmingLogout(true)}
          className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-white/95 hover:bg-white/10 hover:text-white sm:px-3"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Yes, log out"
        cancelLabel="Cancel"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false);
          onLogout();
        }}
      />
    </header>
  );
}
