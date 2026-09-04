import React, { useEffect, useRef } from "react";

// Small reusable "are you sure?" modal — first used for the logout
// confirmation (Header.jsx), written generically enough to also replace
// the window.confirm() calls used for delete confirmations elsewhere
// (ManageStudents, StudentDetailModal, ManageTeachers) later, since it
// takes no assumptions about what it's confirming beyond the text/labels
// passed in. Same fixed-overlay / backdrop-click / Escape-to-close pattern
// StudentDetailModal already uses, and styled entirely with the app's
// theme tokens (bg-card, text-ink, border-line, bg-brand, ...) from
// index.css, so it repaints correctly under ThemeProvider's `dark` class
// with no light/dark branching of its own.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  // "brand" (green) for routine confirmations, "danger" (rose) for
  // destructive ones like delete — swap just the confirm button's color.
  tone = "brand",
}) {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    // Confirm is focused by default (not cancel) since this dialog only
    // ever appears after the user already chose to act (click Logout,
    // click Delete) — confirming is the expected next step, Escape/click-
    // outside covers backing out.
    confirmButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmToneClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-300"
      : "bg-brand hover:bg-brand-strong focus-visible:ring-green-300";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? "confirm-dialog-message" : undefined}
        className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl"
      >
        <h3 id="confirm-dialog-title" className="text-base font-bold text-ink">
          {title}
        </h3>
        {message && (
          <p id="confirm-dialog-message" className="mt-2 text-sm text-body">
            {message}
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-card-strong"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 ${confirmToneClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
