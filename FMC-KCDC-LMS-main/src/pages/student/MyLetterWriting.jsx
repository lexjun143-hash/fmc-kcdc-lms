import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Mail,
  PenLine,
  Clock,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  X,
  Info,
  Save,
  Send,
  ImagePlus,
  Paperclip,
  Heart,
  CalendarClock,
} from "lucide-react";
import { getCurrentUser } from "../../api/auth";
import { fetchUserByParticipantId } from "../../api/users";
import { fetchLetters, markLetterSeen, updateLetter } from "../../api/letters";

/* ---------------------------------------------------------
   Same restrained palette as My Assignment:
   - gray  = in progress / no action needed from the student yet
   - green = done (brand color, matches the portal's accent)
   - red   = reserved only for "needs your attention"
--------------------------------------------------------- */
const statusConfig = {
  New: {
    icon: Mail,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
    helper: "Your teacher posted a new letter prompt for this quarter.",
  },
  Drafting: {
    icon: PenLine,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
    helper: "You've started writing — pick up where you left off.",
  },
  Submitted: {
    icon: Clock,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
    helper:
      "Waiting for your teacher to review before it's sent to your sponsor.",
  },
  Revise: {
    icon: RotateCcw,
    text: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-200",
    dot: "bg-red-500",
    helper: "Your teacher asked for a few changes before this can be sent.",
  },
  Approved: {
    icon: CheckCircle2,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
    dot: "bg-green-500",
    helper: "Approved and on its way to your sponsor.",
  },
};

const ADMIN_NAME = "your teacher";

const NOW = new Date("2026-07-17T09:00:00");

function daysUntil(dateStr) {
  const due = new Date(dateStr + "T17:00:00");
  return Math.round((due.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24));
}

function dueLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) > 1 ? "s" : ""} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

/* ------------------------------------------------------------------ */
/* Letter composer — read or write depending on status                 */
/* ------------------------------------------------------------------ */

function LetterComposer({ letter, sponsor, onClose, onSaveDraft, onSubmit }) {
  const [draft, setDraft] = useState(letter.body || "");
  const [photoAttached, setPhotoAttached] = useState(false);
  const cfg = statusConfig[letter.status];
  const StatusIcon = cfg.icon;

  const isEditable = ["New", "Drafting", "Revise"].includes(letter.status);
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {letter.quarter}
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`}
              >
                <StatusIcon size={10} />
                {letter.status}
              </span>
            </p>
            <h4 className="mt-1 truncate text-base font-bold text-slate-900">
              {letter.subject}
            </h4>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Heart size={12} className="text-rose-400" />
              To: {sponsor.name} ({sponsor.country})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Admin prompt */}
          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-600">
                Prompt posted by {ADMIN_NAME} · {letter.postedAt}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {letter.prompt}
              </p>
            </div>
          </div>

          {/* Letter from the sponsor — exactly what the admin entered, typed or uploaded */}
          {(letter.sponsorLetterText || letter.sponsorLetterFile) && (
            <div className="mt-3 rounded-lg bg-rose-50/60 p-3.5 ring-1 ring-rose-100">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                <Heart size={12} />
                Letter from {sponsor.name}
              </p>
              {letter.sponsorLetterMode === "type" ? (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {letter.sponsorLetterText}
                </p>
              ) : (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-rose-100">
                  <Paperclip
                    size={14}
                    className="flex-shrink-0 text-rose-400"
                  />
                  <span className="truncate">{letter.sponsorLetterFile}</span>
                </div>
              )}
            </div>
          )}

          {/* Revision feedback */}
          {letter.status === "Revise" && letter.feedback && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-red-50 p-3.5 ring-1 ring-red-200">
              <RotateCcw
                size={15}
                className="mt-0.5 flex-shrink-0 text-red-500"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-700">
                  {ADMIN_NAME} asked for a few changes
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-700">
                  {letter.feedback}
                </p>
              </div>
            </div>
          )}

          {/* Due date, when relevant */}
          {isEditable && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarClock size={13} />
              {dueLabel(letter.dueDate)}
            </div>
          )}

          {/* Letter body */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Your letter
            </label>
            {isEditable ? (
              <textarea
                rows={10}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Dear ${sponsor.name},\n\n...`}
                className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            ) : (
              <div className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
                {letter.body}
              </div>
            )}
            {isEditable && (
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {wordCount} words
              </p>
            )}
          </div>

          {/* Photo attach — optional, common for sponsor letters */}
          {isEditable ? (
            <button
              type="button"
              onClick={() => setPhotoAttached((v) => !v)}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-sm font-medium transition-colors ${
                photoAttached
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-slate-300 text-slate-500 hover:border-green-400 hover:text-green-700"
              }`}
            >
              <ImagePlus size={16} />
              {photoAttached
                ? "Photo attached — tap to remove"
                : "Attach a photo (optional)"}
            </button>
          ) : (
            letter.attachment && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <Paperclip size={13} className="text-slate-400" />
                {letter.attachment}
              </div>
            )
          )}

          {/* Status helper / timeline note */}
          <div className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
            {letter.status === "Submitted" &&
              `Submitted ${letter.submittedAt}. ${cfg.helper}`}
            {letter.status === "Approved" &&
              `Approved and sent to your sponsor on ${letter.sentAt}.`}
            {letter.status === "New" && cfg.helper}
            {letter.status === "Drafting" && cfg.helper}
            {letter.status === "Revise" &&
              "Make the changes above, then resubmit for review."}
          </div>
        </div>

        {/* Footer actions */}
        {isEditable && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSaveDraft(letter.id, draft)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              <Save size={14} />
              Save draft
            </button>
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => onSubmit(letter.id, draft)}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} />
              Submit to {ADMIN_NAME}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function MyLetterWriting() {
  const currentUser = getCurrentUser();
  const [letters, setLetters] = useState([]);
  const [studentDetail, setStudentDetail] = useState(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [openLetterId, setOpenLetterId] = useState(null);
  const [toast, setToast] = useState(null);

  const sponsor = useMemo(() => {
    const name =
      studentDetail?.sponsorName ||
      studentDetail?.sponsor?.name ||
      [studentDetail?.sponsorFirstName, studentDetail?.sponsorLastName]
        .filter(Boolean)
        .join(" ") ||
      "Your sponsor";
    const country =
      studentDetail?.sponsorCountry || studentDetail?.sponsor?.country || "";
    const initials =
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "YS";

    return { name, country, initials };
  }, [studentDetail]);

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchLetters(currentUser.id)
      .then(setLetters)
      .catch((error) => setToast(error.message));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.participantId || !currentUser?.id) return;
    let cancelled = false;

    fetchUserByParticipantId(currentUser.participantId, currentUser.id)
      .then((detail) => {
        if (!cancelled) setStudentDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setStudentDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.participantId, currentUser?.id]);

  const counts = useMemo(() => {
    const c = { All: letters.length };
    for (const s of Object.keys(statusConfig)) {
      c[s] = letters.filter((l) => l.status === s).length;
    }
    return c;
  }, [letters]);

  const filtered = letters.filter((l) => {
    const matchesFilter = filter === "All" || l.status === filter;
    const matchesQuery =
      query.trim() === "" ||
      l.subject.toLowerCase().includes(query.toLowerCase()) ||
      l.quarter.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  // The letter that most needs the student's attention, surfaced up top.
  const actionable =
    letters.find((l) => l.status === "New" || l.status === "Revise") ||
    letters.find((l) => l.status === "Drafting");

  const openLetter = letters.find((l) => l.id === openLetterId) || null;

  function openLetterForParticipant(letter) {
    const seenStatus = letter.status === "Revise" ? "Revise" : "New";

    if (currentUser?.id && Number.isInteger(letter.id)) {
      markLetterSeen(letter.id, currentUser.id, seenStatus)
        .then(() => {
          window.dispatchEvent(new Event("letters:refresh"));
        })
        .catch(() => {});
    }
    setLetters((prev) =>
      prev.map((item) =>
        item.id === letter.id
          ? { ...item, seenAt: item.seenAt || new Date().toISOString() }
          : item,
      ),
    );
    setOpenLetterId(letter.id);
  }

  async function handleSaveDraft(id, body) {
    try {
      const updated = await updateLetter(id, {
        requesterId: currentUser.id,
        action: "draft",
        body,
      });
      setLetters((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (error) {
      setToast(error.message);
      return;
    }
    setOpenLetterId(null);
    setToast("Draft saved.");
    setTimeout(() => setToast(null), 2200);
  }

  async function handleSubmit(id, body) {
    try {
      const updated = await updateLetter(id, {
        requesterId: currentUser.id,
        action: "submit",
        body,
      });
      setLetters((prev) => prev.map((l) => (l.id === id ? updated : l)));
      window.dispatchEvent(new Event("letters:refresh"));
    } catch (error) {
      setToast(error.message);
      return;
    }
    setOpenLetterId(null);
    setToast(`Sent to ${ADMIN_NAME} for review.`);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 size={16} className="text-green-400" />
          {toast}
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">
            Letter Writing
          </h3>
          <p className="text-sm text-slate-500">
            Write to {sponsor.name} ({sponsor.country}) — your teacher posts
            each quarter's prompt here
          </p>
        </div>
      </div>

      {/* Actionable letter — the one thing the student should do next */}
      {actionable && (
        <button
          type="button"
          onClick={() => openLetterForParticipant(actionable)}
          className="mt-4 flex w-full flex-col items-start gap-3 rounded-xl border border-green-200 bg-green-50/60 p-4 text-left transition-colors hover:bg-green-50 sm:flex-row sm:items-center sm:p-5"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
            {sponsor.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">
              {actionable.status === "Revise"
                ? "Needs your changes"
                : "Action needed"}
              <span className="text-slate-300">·</span>
              {dueLabel(actionable.dueDate)}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
              {actionable.subject}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {actionable.prompt}
            </p>
          </div>
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white shadow-sm">
            <PenLine size={13} />
            {actionable.status === "New" ? "Write letter" : "Continue"}
          </span>
        </button>
      )}

      {/* Search + filter tabs */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search letters..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {["All", ...Object.keys(statusConfig)].map((s) => {
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-green-700 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {s}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Letters list */}
      <div className="mt-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
            <Mail size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              No letters found
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Try a different search or filter
            </p>
          </div>
        ) : (
          filtered.map((letter) => {
            const cfg = statusConfig[letter.status];
            const StatusIcon = cfg.icon;
            return (
              <button
                key={letter.id}
                onClick={() => openLetterForParticipant(letter)}
                className="group flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {sponsor.initials}
                  </div>
                  {letter.status === "New" && (
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {sponsor.name}{" "}
                      <span className="font-normal text-slate-400">
                        ({sponsor.country})
                      </span>
                    </p>
                    <span className="flex-shrink-0 text-xs text-slate-400">
                      {letter.quarter}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
                    {letter.subject}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {letter.status === "Revise" && letter.feedback
                      ? letter.feedback
                      : letter.prompt}
                  </p>
                </div>

                {/* Status pill */}
                <div
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                >
                  <StatusIcon size={13} />
                  {letter.status}
                </div>

                <ChevronRight
                  size={16}
                  className="hidden flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400 sm:block"
                />
              </button>
            );
          })
        )}
      </div>

      {openLetter && (
        <LetterComposer
          letter={openLetter}
          sponsor={sponsor}
          onClose={() => setOpenLetterId(null)}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}
