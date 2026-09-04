import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  Send,
  Search,
  Users,
  PenLine,
  Clock,
  RotateCcw,
  CheckCircle2,
  X,
  Info,
  Paperclip,
  Upload,
  FilePlus2,
  Inbox,
  Heart,
  CalendarClock,
  Eye,
  MessageSquareWarning,
  ThumbsUp,
  Sparkles,
  Check,
} from "lucide-react";
import {
  GLASS,
  GLASS_SOLID,
  GLASS_SUBTLE,
} from "../../components/shared/GlassCard";
import { getCurrentUser } from "../../api/auth";
import { createLetter, fetchLetters, updateLetter } from "../../api/letters";
import { fetchUsers } from "../../api/users";
import { groupLettersByStudent } from "../../utils/letterSelection";

/* ------------------------------------------------------------------ */
/* Shared config — mirrors the student My Letter Writing view exactly  */
/* ------------------------------------------------------------------ */

const statusConfig = {
  New: {
    icon: Mail,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
  },
  Drafting: {
    icon: PenLine,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
  },
  Submitted: {
    icon: Clock,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
  },
  Revise: {
    icon: RotateCcw,
    text: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-200",
  },
  Approved: {
    icon: CheckCircle2,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
  },
};

// Statuses that mean "this student still has an unresolved letter open".
// A student can hold a full history of letters, so the admin page tracks
// each letter record individually rather than collapsing everything to one.
const OPEN_STATUSES = ["Drafting", "Submitted", "Revise"];

const NOW = new Date("2026-07-17T09:00:00");
const CURRENT_QUARTER = "3rd Quarter 2026";
function initials(name) {
  return name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

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

const initialStudents = [
  {
    id: "st1",
    name: "Maria Santos",
    section: "Section A",
    sponsor: { name: "The Whitfield Family", country: "USA" },
    quarter: CURRENT_QUARTER,
    prompt:
      "Tell your sponsor about your school year so far and thank them for their support.",
    dueDate: "2026-07-25",
    status: "Submitted",
    body: "Dear Whitfield Family,\n\nThank you so much for your continued support. This quarter I did well in Math and Science, and I joined the school choir. I'm very grateful for everything you've done for me and my family...",
    feedback: null,
    submittedAt: "2026-07-16",
  },
  {
    id: "st2",
    name: "John Dela Cruz",
    section: "Section A",
    sponsor: { name: "Karen Müller", country: "Germany" },
    quarter: CURRENT_QUARTER,
    prompt:
      "Tell your sponsor about your school year so far and thank them for their support.",
    dueDate: "2026-07-25",
    status: "Revise",
    body: "Dear Karen,\n\nHi. School is good. Thank you for the gift.",
    feedback:
      "This is a good start! Please add more detail — share what subject you enjoy most and one thing you learned this quarter before you resubmit.",
    submittedAt: "2026-07-14",
  },
  {
    id: "st3",
    name: "Ana Reyes",
    section: "Section A",
    sponsor: { name: "Robert Chan", country: "Canada" },
    quarter: CURRENT_QUARTER,
    prompt:
      "Tell your sponsor about your school year so far and thank them for their support.",
    dueDate: "2026-07-25",
    status: "New",
    body: "",
    feedback: null,
    submittedAt: null,
  },
  {
    id: "st4",
    name: "Carla Mendoza",
    section: "Section B",
    sponsor: { name: "Junko Tanaka", country: "Japan" },
    quarter: CURRENT_QUARTER,
    prompt:
      "Tell your sponsor about your school year so far and thank them for their support.",
    dueDate: "2026-07-25",
    status: "Submitted",
    body: "Dear Junko,\n\nI hope you are doing well. This quarter I studied hard and passed all my subjects. I also helped my mother at home and read the book you sent me last time. Thank you for always thinking of me...",
    feedback: null,
    submittedAt: "2026-07-15",
  },
  {
    id: "st5",
    name: "Paolo Ramos",
    section: "Section B",
    sponsor: { name: "The Ferreira Family", country: "Brazil" },
    quarter: CURRENT_QUARTER,
    prompt:
      "Tell your sponsor about your school year so far and thank them for their support.",
    dueDate: "2026-07-25",
    status: "Drafting",
    body: "Dear Ferreira Family,\n\nHi po. Thank you for...",
    feedback: null,
    submittedAt: null,
  },
  {
    id: "st6",
    name: "Bea Villanueva",
    section: "Section B",
    sponsor: { name: "Susan Clarke", country: "Australia" },
    quarter: CURRENT_QUARTER,
    prompt:
      "Tell your sponsor about your school year so far and thank them for their support.",
    dueDate: "2026-07-25",
    status: "Approved",
    body: "Dear Susan,\n\nThank you so much for your kindness this year. I was able to join the summer reading program because of your support, and I want you to know how much it means to me and my family...",
    feedback: null,
    submittedAt: "2026-07-10",
    sentAt: "2026-07-13",
  },
];

void initialStudents;

/* ------------------------------------------------------------------ */
/* Tab 1 — Send Sponsor Letter (post the reply-cycle to a student)     */
/* ------------------------------------------------------------------ */

function SendSponsorLetter({ students, onPost }) {
  const [form, setForm] = useState({
    quarter: "",
    recipientId: null,
    prompt: "",
    dueDate: "",
    letterMode: "type", // "type" | "upload" — the sponsor's letter is entered one way or the other
    letterText: "",
    attachment: null,
  });
  const [errors, setErrors] = useState({});
  const [posted, setPosted] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [query, setQuery] = useState("");

  const setFile = (file) => setForm((prev) => ({ ...prev, attachment: file }));
  const handleFile = (e) => setFile(e.target.files?.[0] || null);
  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(file);
  }
  const setLetterMode = (mode) =>
    setForm((prev) => ({ ...prev, letterMode: mode }));

  const isOpen = (s) => OPEN_STATUSES.includes(s.status);
  const selectRecipient = (id) =>
    setForm((prev) => ({ ...prev, recipientId: id }));
  const clearRecipient = () =>
    setForm((prev) => ({ ...prev, recipientId: null }));
  const q = query.trim().toLowerCase();
  const searchResults = q
    ? (() => {
        const seen = new Set();
        return students
          .filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.section.toLowerCase().includes(q) ||
              s.sponsor.name.toLowerCase().includes(q),
          )
          .filter((s) => {
            const key = String(s.studentId ?? s.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8);
      })()
    : [];
  const selectedStudent =
    students.find((s) => s.id === form.recipientId) || null;

  const validate = () => {
    const next = {};
    if (!form.quarter.trim()) next.quarter = "Give this cycle a name.";
    if (!form.recipientId) next.recipient = "Select a student.";
    if (!form.prompt.trim()) next.prompt = "Write the reply prompt.";
    if (!form.dueDate) next.dueDate = "Set a reply due date.";
    if (form.letterMode === "type" && !form.letterText.trim())
      next.letter = "Enter the sponsor letter.";
    if (form.letterMode === "upload" && !form.attachment)
      next.letter = "Attach the sponsor letter.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await onPost(form, [selectedStudent]);
      setPosted(true);
      setForm({
        quarter: "",
        recipientId: null,
        prompt: "",
        dueDate: "",
        letterMode: "type",
        letterText: "",
        attachment: null,
      });
      setQuery("");
      setTimeout(() => setPosted(false), 3000);
    } catch {
      // The parent displays the API error in its toast.
    }
  };

  return (
    <div>
      {posted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Posted — the participant can now write their reply.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className={`p-5 sm:p-6 lg:col-span-3 ${GLASS_SOLID}`}
        >
          {/* Cycle name */}
          <div className="mt-4">
            <label
              htmlFor="quarter"
              className="text-sm font-semibold text-slate-700"
            >
              {" "}
              Title name
            </label>
            <input
              id="quarter"
              type="text"
              value={form.quarter}
              onChange={(e) =>
                setForm((p) => ({ ...p, quarter: e.target.value }))
              }
              placeholder="e.g. 4th Quarter 2026"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.quarter
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.quarter && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.quarter}
              </p>
            )}
          </div>

          {/* Recipient — search and select a single student */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Send to
            </label>

            <div className="relative mt-1.5">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by participant name, section, or sponsor..."
                className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.recipient
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
            </div>

            {q && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
                {searchResults.length === 0 ? (
                  <p className="bg-slate-50 px-3 py-3 text-xs text-slate-400">
                    No students match "{query}".
                  </p>
                ) : (
                  searchResults.map((s, i) => {
                    const open = isOpen(s);
                    const selected = form.recipientId === s.id;
                    const cfg = statusConfig[s.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2.5 bg-white px-3 py-2.5 ${i !== 0 ? "border-t border-slate-100" : ""}`}
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {s.name}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {s.section} · Sponsor: {s.sponsor.name}
                          </p>
                        </div>
                        {open ? (
                          <span
                            className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                          >
                            <StatusIcon size={12} />
                            {s.status}
                          </span>
                        ) : selected ? (
                          <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                            <Check size={12} />
                            Selected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => selectRecipient(s.id)}
                            className="flex flex-shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Selected recipient */}
            {selectedStudent ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">
                  This letter will go to
                </p>
                <div className="mt-1.5 flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs font-medium text-slate-700 w-fit">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                    {initials(selectedStudent.name)}
                  </span>
                  {selectedStudent.name}
                  <button
                    type="button"
                    onClick={clearRecipient}
                    aria-label={`Remove ${selectedStudent.name}`}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-slate-400">
                No participant selected yet — search above and choose one.
              </p>
            )}

            {errors.recipient && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.recipient}
              </p>
            )}
          </div>

          {/* Prompt */}
          <div className="mt-4">
            <label
              htmlFor="prompt"
              className="text-sm font-semibold text-slate-700"
            >
              What should the participant tell their sponsor?
            </label>
            <textarea
              id="prompt"
              rows={4}
              value={form.prompt}
              onChange={(e) =>
                setForm((p) => ({ ...p, prompt: e.target.value }))
              }
              placeholder="e.g. Share a highlight from this quarter and thank your sponsor for their support."
              className={`mt-1.5 w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.prompt
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.prompt && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.prompt}
              </p>
            )}
          </div>

          {/* Due date */}
          <div className="mt-4">
            <label
              htmlFor="dueDate"
              className="text-sm font-semibold text-slate-700"
            >
              Reply due date
            </label>
            <div className="relative mt-1.5">
              <CalendarClock
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dueDate: e.target.value }))
                }
                className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 ${
                  errors.dueDate
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
            </div>
            {errors.dueDate && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.dueDate}
              </p>
            )}
          </div>

          {/* Sponsor's letter — type it in, or upload a scanned copy */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Sponsor's letter
            </label>
            <p className="mt-0.5 text-xs text-slate-400">
              Give the student the letter their sponsor wrote — type it in, or
              attach a scanned copy.
            </p>

            <div className="mt-2 inline-flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setLetterMode("type")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  form.letterMode === "type"
                    ? "bg-white text-green-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <PenLine size={13} />
                Type letter
              </button>
              <button
                type="button"
                onClick={() => setLetterMode("upload")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  form.letterMode === "upload"
                    ? "bg-white text-green-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Upload size={13} />
                Upload file
              </button>
            </div>

            {form.letterMode === "type" ? (
              <textarea
                rows={6}
                value={form.letterText}
                onChange={(e) =>
                  setForm((p) => ({ ...p, letterText: e.target.value }))
                }
                placeholder="Type the sponsor's letter here, exactly as it should reach the student..."
                className={`mt-2.5 w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.letter
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
            ) : form.attachment ? (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2 truncate text-slate-700">
                  <Paperclip
                    size={14}
                    className="flex-shrink-0 text-slate-400"
                  />
                  <span className="truncate">{form.attachment.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex-shrink-0 text-slate-400 hover:text-rose-600"
                  aria-label="Remove attachment"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-6 text-center transition-all ${
                  dragActive
                    ? "scale-[1.01] border-green-500 bg-green-50"
                    : errors.letter
                      ? "border-rose-300"
                      : "border-slate-300 hover:border-green-400"
                }`}
              >
                <Upload
                  size={18}
                  className={dragActive ? "text-green-600" : "text-slate-400"}
                />
                <label className="cursor-pointer text-sm font-medium text-slate-500 hover:text-green-700">
                  Drag a file here, or click to attach
                  <input type="file" onChange={handleFile} className="hidden" />
                </label>
              </div>
            )}
            {errors.letter && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.letter}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800"
            >
              <Send size={14} />
              Post to student
            </button>
          </div>
        </form>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Sparkles size={13} />
              Participant preview
            </p>
            {!form.quarter && !form.prompt ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
                <Mail size={22} className="text-slate-300" />
                <p className="text-xs text-slate-400">
                  Start filling out the form to see what the participant will
                  see on their end.
                </p>
              </div>
            ) : (
              <div className={`mt-3 p-4 ${GLASS}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {form.quarter || "Untitled cycle"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  Letter to Your Sponsor
                </p>
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 p-3">
                  <Info
                    size={13}
                    className="mt-0.5 flex-shrink-0 text-slate-400"
                  />
                  <p className="text-xs leading-relaxed text-slate-600">
                    {form.prompt || "Your instructions will appear here."}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {form.dueDate ? dueLabel(form.dueDate) : "No due date yet"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Letter review modal                                                  */
/* ------------------------------------------------------------------ */

function ReviewModal({ student, onClose, onRequestRevision, onMarkReviewed }) {
  const [feedback, setFeedback] = useState("");
  const [showFeedbackField, setShowFeedbackField] = useState(false);
  const cfg = statusConfig[student.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/60 bg-white/90 shadow-2xl shadow-slate-900/20 backdrop-blur-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {student.quarter}
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`}
              >
                <StatusIcon size={10} />
                {student.status}
              </span>
            </p>
            <h4 className="mt-1 truncate text-base font-bold text-slate-900">
              {student.name}
            </h4>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Heart size={12} className="text-rose-400" />
              Sponsor: {student.sponsor.name} ({student.sponsor.country})
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <p className="text-sm leading-relaxed text-slate-600">
              {student.prompt}
            </p>
          </div>

          {(student.sponsorLetterText || student.sponsorLetterFile) && (
            <div className="mt-3 rounded-lg bg-rose-50/60 p-3.5 ring-1 ring-rose-100">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                <Heart size={12} />
                Letter from {student.sponsor.name}
              </p>
              {student.sponsorLetterMode === "type" ? (
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {student.sponsorLetterText}
                </p>
              ) : (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-rose-100">
                  <Paperclip
                    size={14}
                    className="flex-shrink-0 text-rose-400"
                  />
                  <span className="truncate">{student.sponsorLetterFile}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Participant's letter
            </label>
            <div className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
              {student.body || "The participant hasn't written anything yet."}
            </div>
            {student.submittedAt && (
              <p className="mt-1.5 text-xs text-slate-400">
                Submitted {student.submittedAt}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              {student.seenAt
                ? `Seen by participant on ${student.seenAt}`
                : "Not yet viewed by participant"}
            </p>
          </div>

          {showFeedbackField && (
            <div className="mt-4">
              <label
                htmlFor="feedback"
                className="text-sm font-semibold text-slate-700"
              >
                What should they change?
              </label>
              <textarea
                id="feedback"
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Please add a detail about your family and a closing thank-you."
                className="mt-1.5 w-full resize-none rounded-lg border border-red-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        {student.status === "Submitted" && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4">
            {showFeedbackField ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowFeedbackField(false)}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!feedback.trim()}
                  onClick={() => onRequestRevision(student.id, feedback)}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MessageSquareWarning size={14} />
                  Send back to revise
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowFeedbackField(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <MessageSquareWarning size={14} />
                  Needs revision
                </button>
                <button
                  type="button"
                  onClick={() => onMarkReviewed(student.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800"
                >
                  <ThumbsUp size={14} />
                  Mark approved &amp; send to sponsor
                </button>
              </>
            )}
          </div>
        )}

        {student.status === "Approved" && (
          <div className="border-t border-slate-100 p-4 text-center text-xs font-medium text-green-700">
            Approved and sent to {student.sponsor.name} on {student.sentAt}.
          </div>
        )}

        {student.status === "Revise" && (
          <div className="border-t border-slate-100 p-4 text-xs text-red-600">
            <span className="font-semibold">Waiting on the participant</span> —
            they've been asked to revise and resubmit.
          </div>
        )}

        {(student.status === "New" || student.status === "Drafting") && (
          <div className="border-t border-slate-100 p-4 text-center text-xs text-slate-400">
            Nothing to review yet — the participant hasn't submitted a reply.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 2 — Review Responses                                            */
/* ------------------------------------------------------------------ */

function ReviewResponses({ students, onRequestRevision, onMarkReviewed }) {
  const [statusFilter, setStatusFilter] = useState("Submitted");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const counts = useMemo(() => {
    const c = { All: students.length };
    for (const s of Object.keys(statusConfig)) {
      c[s] = students.filter((st) => st.status === s).length;
    }
    return c;
  }, [students]);

  const filtered = students.filter((s) => {
    const matchesStatus = statusFilter === "All" || s.status === statusFilter;
    const matchesQuery = s.name.toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const openStudent = students.find((s) => s.id === openId) || null;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {["All", ...Object.keys(statusConfig)].map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-green-700 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {s}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-56">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search participant..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {filtered.map((s) => {
          const cfg = statusConfig[s.status];
          const StatusIcon = cfg.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenId(s.id)}
              className={`flex w-full items-center gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80 ${GLASS}`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {initials(s.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {s.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {s.section} · Sponsor: {s.sponsor.name} ({s.sponsor.country})
                </p>
              </div>
              <div className="hidden flex-shrink-0 text-right sm:block">
                <p className="text-xs text-slate-400">
                  {s.seenAt
                    ? `Seen ${s.seenAt}`
                    : s.status === "Approved"
                      ? `Sent ${s.sentAt}`
                      : s.submittedAt
                        ? `Submitted ${s.submittedAt}`
                        : "Not submitted"}
                </p>
              </div>
              <span
                className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
              >
                <StatusIcon size={12} />
                {s.status}
              </span>
              <span className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <Eye size={13} />
                <span className="hidden md:inline">View</span>
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className={`py-14 text-center ${GLASS_SUBTLE}`}>
            <Inbox size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Nothing here
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Try a different filter or search
            </p>
          </div>
        )}
      </div>

      {openStudent && (
        <ReviewModal
          student={openStudent}
          onClose={() => setOpenId(null)}
          onRequestRevision={(id, fb) => {
            onRequestRevision(id, fb);
            setOpenId(null);
          }}
          onMarkReviewed={(id) => {
            onMarkReviewed(id);
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                  */
/* ------------------------------------------------------------------ */

const tabs = [
  { key: "send", label: "Send Sponsor Letter", icon: FilePlus2 },
  { key: "review", label: "Review Responses", icon: Inbox },
];

export default function AdminSponsorLetters() {
  const currentUser = getCurrentUser();
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState("review");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    Promise.all([
      fetchLetters(currentUser.id),
      fetchUsers("student", currentUser.id),
    ])
      .then(([loadedLetters, users]) => {
        const groupedLetters = groupLettersByStudent(loadedLetters);
        const roster = users.flatMap((user) => {
          const history = groupedLetters.get(String(user.id)) ?? [];

          if (history.length === 0) {
            return [
              {
                id: user.id,
                studentId: user.id,
                name: user.name,
                section: user.section || "",
                sponsor: { name: "Sponsor", country: "" },
                quarter: "",
                prompt: "",
                dueDate: "",
                status: "New",
                body: "",
                feedback: null,
                submittedAt: null,
              },
            ];
          }

          return history.map((letter) => ({
            ...letter,
            id: letter.id,
            studentId: user.id,
            name: user.name,
            section: user.section || "",
            sponsor: letter.sponsor || { name: "Sponsor", country: "" },
          }));
        });

        const unmatchedLetters = loadedLetters
          .filter(
            (letter) =>
              !users.some(
                (user) => String(user.id) === String(letter.studentId),
              ),
          )
          .map((letter) => ({
            ...letter,
            sponsor: letter.sponsor || { name: "Sponsor", country: "" },
          }));

        setStudents([...roster, ...unmatchedLetters]);
      })
      .catch((error) => setToast(error.message));
  }, [currentUser?.id]);

  const overview = useMemo(() => {
    const uniqueStudents = new Set(
      students.map((student) => String(student.studentId ?? student.id)),
    );
    const pending = students.filter((s) => s.status === "Submitted").length;
    const revising = students.filter((s) => s.status === "Revise").length;
    const reviewed = students.filter((s) => s.status === "Approved").length;
    return { total: uniqueStudents.size, pending, revising, reviewed };
  }, [students]);

  async function handlePost(form, affectedStudents) {
    const student = affectedStudents[0];
    const payload = new FormData();
    payload.set("requesterId", currentUser.id);
    payload.set("studentId", student.studentId ?? student.id);
    payload.set("quarter", form.quarter);
    payload.set("prompt", form.prompt);
    payload.set("dueDate", form.dueDate);
    payload.set("sponsorName", student.sponsor?.name || "Sponsor");
    payload.set("sponsorCountry", student.sponsor?.country || "");
    if (form.letterMode === "type")
      payload.set("sponsorLetterText", form.letterText);
    if (form.attachment) payload.set("attachment", form.attachment);
    const created = await createLetter(payload);
    setStudents((prev) => [created, ...prev]);
  }

  async function handleRequestRevision(id, feedback) {
    try {
      const updated = await updateLetter(id, {
        requesterId: currentUser.id,
        action: "revise",
        feedback,
      });
      setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (error) {
      setToast(error.message);
      return;
    }
    const student = students.find((s) => s.id === id);
    setToast(`Sent back to ${student?.name} for revision.`);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleMarkReviewed(id) {
    try {
      const updated = await updateLetter(id, {
        requesterId: currentUser.id,
        action: "approve",
      });
      setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (error) {
      setToast(error.message);
      return;
    }
    const student = students.find((s) => s.id === id);
    setToast(`Approved — sending to ${student?.sponsor.name}.`);
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

      <div>
        <h3 className="mt-0.5 text-lg font-bold text-slate-900">
          Sponsor Letters
        </h3>
        <p className="text-sm text-slate-500">
          Post each cycle's reply prompt and review what participants write back
          before it's sent
        </p>
      </div>

      {/* Overview stat strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Users size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.total}
            </p>
            <p className="truncate text-xs text-slate-500">
              Participants in program
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Clock size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.pending}
            </p>
            <p className="truncate text-xs text-slate-500">
              Waiting for review
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <RotateCcw size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.revising}
            </p>
            <p className="truncate text-xs text-slate-500">
              Sent back to revise
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <ThumbsUp size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.reviewed}
            </p>
            <p className="truncate text-xs text-slate-500">
              Approved &amp; sent
            </p>
          </div>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="mt-5 inline-flex rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-white text-green-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeTab === "send" ? (
          <SendSponsorLetter students={students} onPost={handlePost} />
        ) : (
          <ReviewResponses
            students={students}
            onRequestRevision={handleRequestRevision}
            onMarkReviewed={handleMarkReviewed}
          />
        )}
      </div>
    </section>
  );
}
