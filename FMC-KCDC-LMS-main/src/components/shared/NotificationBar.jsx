import React, { useState } from "react";
import { Bell, ChevronDown, ChevronUp, X, Clock, Copy, Check } from "lucide-react";
import { GLASS } from "./GlassCard";
import { parsePhDate, formatPhTime, formatPhMonthDay, toPhCalendarDate } from "../../utils/phDate";

// Same "Due today, 5:00 PM" / "Due tomorrow, ..." phrasing MyAssignment.jsx
// already uses for its own due-date labels, so the wording is familiar.
// "Today"/"tomorrow" are compared as Philippine calendar days (not the
// viewer's own device timezone) so the bucketing agrees with the PH time
// shown right next to it.
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

// Dismissable summary anchored just below the page banner. `data` is
// whatever GET /api/notifications last returned for the logged-in user —
// shape depends on role:
//   student: { role: "student", count, dueSoon: [{id,title,dueDate}] }
//   teacher/admin: { role, assignments: [{id,title,section,dueDate,
//                    answered,total,nonSubmitters:[{participantId,name}]}],
//                    totalAnswered, totalExpected }
export default function NotificationBar({ data }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  if (dismissed || !data) return null;

  if (data.role === "student") {
    const dueSoon = data.dueSoon || [];
    if (dueSoon.length === 0) return null;

    return (
      <div className={`mx-4 mt-4 overflow-hidden sm:mx-8 ${GLASS}`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Clock size={16} />
          </div>
          <span className="flex-1 text-sm font-semibold text-slate-700">
            {dueSoon.length} assignment{dueSoon.length !== 1 ? "s" : ""} due soon
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>

        {/* Reminders only — never overdue/"Missing" items, which this list
            deliberately excludes (see notificationController.js). Amber
            throughout so it never reads as the red "Missing" state used
            elsewhere in the app. */}
        <div className="space-y-2 border-t border-white/40 px-4 py-3">
          {dueSoon.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-700">{a.title}</span>
              <span className="flex-shrink-0 font-semibold text-amber-600">
                {relativeDueSoon(a.dueDate)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Teacher / admin
  if (!data.assignments || data.assignments.length === 0) return null;

  const { assignments, totalAnswered, totalExpected } = data;

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
      // Clipboard access can be denied by the browser (permissions, non-
      // HTTPS context, etc.) — nothing else to fall back to without adding
      // a text-selection UI, so just leave the button as-is.
    }
  }

  return (
    <div className={`mx-4 mt-4 overflow-hidden sm:mx-8 ${GLASS}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
          <Bell size={16} />
        </div>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-semibold text-slate-700">
            {totalAnswered} of {totalExpected} submissions in
          </span>
          {expanded ? (
            <ChevronUp size={16} className="flex-shrink-0 text-slate-400" />
          ) : (
            <ChevronDown size={16} className="flex-shrink-0 text-slate-400" />
          )}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-white/40 px-4 py-3">
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
      )}
    </div>
  );
}
