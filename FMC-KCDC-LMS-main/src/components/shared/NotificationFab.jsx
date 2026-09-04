import React, { useEffect, useRef, useState } from "react";
import { Bell, X, Clock, Copy, Check } from "lucide-react";
import { GLASS } from "./GlassCard";
import { parsePhDate, formatPhTime, formatPhMonthDay, toPhCalendarDate } from "../../utils/phDate";

// Same "Due today, 5:00 PM" / "Due tomorrow, ..." phrasing used in
// MyAssignment.jsx and NotificationBar.jsx, so the wording is familiar
// wherever a student sees it. "Today"/"tomorrow" are compared as
// Philippine calendar days (not the viewer's own device timezone) so the
// bucketing agrees with the PH time shown right next to it.
function relativeDueSoon(iso) {
  const due = parsePhDate(iso);
  const time = formatPhTime(iso);
  const dueDay = toPhCalendarDate(due);
  const today = toPhCalendarDate(new Date());
  const tomorrow = toPhCalendarDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  if (dueDay === today) return `Due today, ${time}`;
  if (dueDay === tomorrow) return `Due tomorrow, ${time}`;

  return `Due ${formatPhMonthDay(iso)}, ${time}`;
}

function badgeLabel(count) {
  return count > 99 ? "99+" : count;
}

// Messenger-style floating notification button. Reuses the exact same
// `data` object App.jsx already fetched for the Sidebar badges and
// NotificationBar — no fetch of its own. `count` is the number shown on the
// red badge (student: pending-assignment count; teacher/admin: awaitingCount),
// computed by the caller and passed in so this component stays a pure
// presentational piece.
export default function NotificationFab({ role, data, count = 0 }) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isStaff = role === "teacher" || role === "admin";
  const assignments = isStaff ? data?.assignments || [] : [];
  const dueSoon = !isStaff ? data?.dueSoon || [] : [];

  async function handleCopy(assignment) {
    const list = (assignment.nonSubmitters || [])
      .map((s) => `${s.name} (${s.participantId})`)
      .join(", ");
    if (!list) return;
    try {
      await navigator.clipboard.writeText(list);
      setCopiedId(assignment.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === assignment.id ? null : prev));
      }, 1500);
    } catch {
      // Clipboard access can be denied by the browser — nothing else to
      // fall back to without adding a text-selection UI.
    }
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40">
      {open && (
        <div
          className={`absolute bottom-[72px] right-0 flex max-h-[28rem] w-80 flex-col overflow-hidden sm:w-96 ${GLASS}`}
        >
          <div className="flex flex-shrink-0 items-center justify-between border-b border-white/40 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Bell size={15} className="text-green-700" />
              Notifications
            </p>
            <button
              onClick={() => setOpen(false)}
              className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close notifications"
            >
              <X size={15} />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            {isStaff ? (
              assignments.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Nothing needs your attention right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.answered / a.total) * 100) : 0;
                    const nonSubmitters = a.nonSubmitters || [];
                    return (
                      <div key={a.id}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-slate-700">
                            {a.title}
                            {a.section && (
                              <span className="ml-1.5 font-normal text-slate-400">
                                {a.section}
                              </span>
                            )}
                          </span>
                          <span className="flex-shrink-0 text-slate-500">
                            {a.answered}/{a.total}
                            <span className="ml-1.5 text-slate-400">
                              due {formatPhMonthDay(a.dueDate)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-green-600 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {nonSubmitters.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCopy(a)}
                            className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:text-green-800"
                          >
                            {copiedId === a.id ? (
                              <>
                                <Check size={11} />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                Copy {nonSubmitters.length} non-submitter
                                {nonSubmitters.length !== 1 ? "s" : ""}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : dueSoon.length > 0 ? (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600">
                  <Clock size={12} />
                  Due soon
                </p>
                {dueSoon.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-slate-700">{a.title}</span>
                    <span className="flex-shrink-0 font-semibold text-amber-600">
                      {relativeDueSoon(a.dueDate)}
                    </span>
                  </div>
                ))}
              </div>
            ) : count > 0 ? (
              // The student notifications endpoint only returns dueSoon for
              // items due within 24h — count can still be > 0 from
              // assignments that are open longer than that, which have no
              // per-item detail to show here.
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <Bell size={15} className="mt-0.5 flex-shrink-0 text-green-700" />
                You have {count} assignment{count !== 1 ? "s" : ""} still to turn in.
              </p>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                You're all caught up!
              </p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-white shadow-lg shadow-green-900/20 transition-transform hover:scale-105 active:scale-95"
      >
        <Bell size={24} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {badgeLabel(count)}
          </span>
        )}
      </button>
    </div>
  );
}
