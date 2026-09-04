import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

const DEFAULT_DURATION = 3500;

let nextId = 0;

/*
 * Small reusable toast system — no app-wide provider required. Any
 * component calls useToast() for its own stack of floating
 * notifications and renders <ToastStack /> once, wherever in its tree is
 * convenient. Built first for "assignment created successfully" but kept
 * generic on purpose so edit/delete/letters/gifts flows elsewhere can
 * call the same showToast(message, { type, title }) without copying
 * anything.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, { type = "success", title, duration = DEFAULT_DURATION } = {}) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type, title }]);
      timers.current[id] = setTimeout(() => dismissToast(id), duration);
      return id;
    },
    [dismissToast],
  );

  // Clears any timers still pending if the owning component unmounts
  // mid-toast, so a dismiss never fires setState on an unmounted tree.
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      Object.values(activeTimers).forEach(clearTimeout);
    };
  }, []);

  return { toasts, showToast, dismissToast };
}

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-green-50 text-green-700",
    ring: "ring-green-100",
  },
  error: {
    icon: AlertCircle,
    iconWrap: "bg-rose-50 text-rose-700",
    ring: "ring-rose-100",
  },
};

function ToastItem({ toast, onDismiss }) {
  const variant = VARIANTS[toast.type] || VARIANTS.success;
  const Icon = variant.icon;
  return (
    <div
      role="status"
      // w-full (capped by the stack's own inset-x-4 on mobile) instead of
      // a flat w-80 — at 320px wide, a fixed 320px toast plus the stack's
      // own edge offset would run past the viewport edge.
      className={`flex w-full max-w-80 animate-toast-in items-start gap-3 rounded-xl bg-white p-3.5 shadow-lg ring-1 ${variant.ring}`}
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${variant.iconWrap}`}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && <p className="text-sm font-semibold text-slate-800">{toast.title}</p>}
        <p className="text-sm text-slate-600">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// Fixed top-right stack. Drop this once per page/section that uses
// useToast() — nothing in this app needs more than one stack on screen at
// a time.
export default function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
