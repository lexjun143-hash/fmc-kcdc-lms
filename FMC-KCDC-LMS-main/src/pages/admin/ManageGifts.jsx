import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Gift,
  CheckCircle2,
  PackageCheck,
  Inbox,
  Clock,
  Send,
  FilePlus2,
  Users,
  Info,
  CalendarClock,
  X,
  Check,
  Eye,
  Sparkles,
  ImagePlus,
  BellRing,
  Undo2,
} from "lucide-react";
import {
  GLASS,
  GLASS_SOLID,
  GLASS_SUBTLE,
} from "../../components/shared/GlassCard";
import { getCurrentUser } from "../../api/auth";
import { fetchUsers } from "../../api/users";
import {
  fetchGifts,
  createGift,
  acknowledgeGift,
  reopenGift,
  remindGift,
} from "../../api/gifts";

/* ------------------------------------------------------------------ */
/* Shared config — mirrors the admin Sponsor Letters view exactly     */
/* ------------------------------------------------------------------ */

const statusConfig = {
  Awaiting: {
    label: "Awaiting acknowledgement",
    icon: Clock,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
  },
  Acknowledged: {
    label: "Acknowledged",
    icon: CheckCircle2,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
  },
};

const NOW = new Date("2026-07-17T09:00:00");
function todayISO() {
  return NOW.toISOString().slice(0, 10);
}

function initials(name) {
  return name
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function sponsorName(sponsor) {
  if (!sponsor) return "Sponsor";
  if (typeof sponsor === "string") return sponsor.trim() || "Sponsor";
  if (typeof sponsor === "object") {
    return (
      sponsor.name ||
      sponsor.fullName ||
      sponsor.label ||
      sponsor.sponsorName ||
      sponsor.sponsor_name ||
      "Sponsor"
    );
  }
  return "Sponsor";
}

function sponsorId(student) {
  if (!student) return null;
  return (
    student.sponsorId ??
    student.sponsor_id ??
    student.sponsor?.id ??
    student.sponsor?.sponsorId ??
    student.sponsor?.sponsor_id ??
    null
  );
}

function daysWaiting(dateStr) {
  const sent = new Date(dateStr + "T00:00:00");
  return Math.max(
    0,
    Math.round((NOW.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function waitingLabel(dateStr) {
  const d = daysWaiting(dateStr);
  if (d === 0) return "Sent today";
  if (d === 1) return "Waiting 1 day";
  return `Waiting ${d} days`;
}

/* ------------------------------------------------------------------ */
/* Tab 1 — Send Gift Notification (notify one student of a gift)      */
/* ------------------------------------------------------------------ */

function SendGiftNotification({ students, onSend }) {
  const [form, setForm] = useState({
    recipientId: null,
    sponsor: "",
    item: "",
    note: "",
    dateReceived: todayISO(),
    photo: null,
  });
  const [errors, setErrors] = useState({});
  const [posted, setPosted] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [query, setQuery] = useState("");

  const setPhoto = (file) => setForm((prev) => ({ ...prev, photo: file }));
  const handlePhoto = (e) => setPhoto(e.target.files?.[0] || null);
  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setPhoto(file);
  }

  // One notification goes to exactly one student, so picking a new one
  // simply replaces whichever was previously chosen.
  const selectRecipient = (id) => {
    const student = students.find((item) => item.id === id);
    const sponsor = student
      ? sponsorName(
          student.sponsorName ||
            student.sponsor_name ||
            student.sponsor ||
            student.sponsor?.name,
        )
      : "";

    setForm((prev) => ({
      ...prev,
      recipientId: id,
      sponsor: sponsor || prev.sponsor,
    }));
  };
  const clearRecipient = () =>
    setForm((prev) => ({ ...prev, recipientId: null }));

  const q = query.trim().toLowerCase();
  const searchResults = q
    ? students
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.section.toLowerCase().includes(q),
        )
        .slice(0, 8)
    : [];

  const selectedStudent =
    students.find((s) => s.id === form.recipientId) || null;

  const validate = () => {
    const next = {};
    if (!form.recipientId)
      next.recipient = "Search for and select a participant.";
    if (!form.sponsor.trim())
      next.sponsor = "Say which sponsor sent this gift.";
    if (!form.item.trim())
      next.item = "Give the gift a short title, e.g. Birthday Gift Box.";
    if (!form.dateReceived)
      next.dateReceived = "Set the date the gift arrived at the center.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSend(form, selectedStudent);
    setPosted(true);
    setForm({
      recipientId: null,
      sponsor: "",
      item: "",
      note: "",
      dateReceived: todayISO(),
      photo: null,
    });
    setQuery("");
    setTimeout(() => setPosted(false), 3000);
  };

  return (
    <div>
      {posted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Sent — the participant can now acknowledge this gift.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className={`p-5 sm:p-6 lg:col-span-3 ${GLASS_SOLID}`}
        >
          <p className="mt-1 text-xs text-slate-500">
            This lets the selected participant know a gift has arrived, so they
            can confirm they received it.
          </p>

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
                placeholder="Search by participant name or section..."
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
                    No participants match "{query}".
                  </p>
                ) : (
                  searchResults.map((s, i) => {
                    const selected = form.recipientId === s.id;
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
                            {s.section}
                          </p>
                        </div>
                        {selected ? (
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

            {selectedStudent ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">
                  This notification will go to
                </p>
                <div className="mt-1.5 flex w-fit items-center gap-2 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs font-medium text-slate-700">
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

          {/* Sponsor */}
          <div className="mt-4">
            <label
              htmlFor="sponsor"
              className="text-sm font-semibold text-slate-700"
            >
              Sent by
            </label>
            <input
              id="sponsor"
              type="text"
              value={form.sponsor}
              onChange={(e) =>
                setForm((p) => ({ ...p, sponsor: e.target.value }))
              }
              placeholder="e.g. The Whitfield Family"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.sponsor
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.sponsor && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.sponsor}
              </p>
            )}
          </div>

          {/* Gift title */}
          <div className="mt-4">
            <label
              htmlFor="item"
              className="text-sm font-semibold text-slate-700"
            >
              Gift
            </label>
            <input
              id="item"
              type="text"
              value={form.item}
              onChange={(e) => setForm((p) => ({ ...p, item: e.target.value }))}
              placeholder="e.g. Birthday Gift Box"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.item
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.item && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.item}
              </p>
            )}
          </div>

          {/* Note */}
          <div className="mt-4">
            <label
              htmlFor="note"
              className="text-sm font-semibold text-slate-700"
            >
              What's inside{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="e.g. A jacket, slippers, and a personal letter from the sponsor."
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Date received */}
          <div className="mt-4">
            <label
              htmlFor="dateReceived"
              className="text-sm font-semibold text-slate-700"
            >
              Date received at the center
            </label>
            <div className="relative mt-1.5">
              <CalendarClock
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="dateReceived"
                type="date"
                value={form.dateReceived}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dateReceived: e.target.value }))
                }
                className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 ${
                  errors.dateReceived
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
            </div>
            {errors.dateReceived && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.dateReceived}
              </p>
            )}
          </div>

          {/* Optional photo of the gift */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700">
              Photo of the gift{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            {form.photo ? (
              <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2 truncate text-slate-700">
                  <ImagePlus
                    size={14}
                    className="flex-shrink-0 text-slate-400"
                  />
                  <span className="truncate">{form.photo.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="flex-shrink-0 text-slate-400 hover:text-rose-600"
                  aria-label="Remove photo"
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
                className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-6 text-center transition-all ${
                  dragActive
                    ? "scale-[1.01] border-green-500 bg-green-50"
                    : "border-slate-300 hover:border-green-400"
                }`}
              >
                <ImagePlus
                  size={18}
                  className={dragActive ? "text-green-600" : "text-slate-400"}
                />
                <label className="cursor-pointer text-sm font-medium text-slate-500 hover:text-green-700">
                  Drag a photo here, or click to attach
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhoto}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800"
            >
              <Send size={14} />
              Notify participant
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
            {!form.sponsor && !form.item ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
                <Gift size={22} className="text-slate-300" />
                <p className="text-xs text-slate-400">
                  Start filling out the form to see what the participant will
                  see on their end.
                </p>
              </div>
            ) : (
              <div className={`mt-3 p-4 ${GLASS}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <Gift size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {form.item || "Untitled gift"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {form.sponsor || "Sponsor"}
                    </p>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    <Clock size={12} />
                    Awaiting
                  </span>
                </div>
                {form.note && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-slate-50 p-3">
                    <Info
                      size={13}
                      className="mt-0.5 flex-shrink-0 text-slate-400"
                    />
                    <p className="text-xs leading-relaxed text-slate-600">
                      {form.note}
                    </p>
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Received {form.dateReceived || "date not set"}
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
/* Gift detail modal — read-only monitoring, with admin acknowledgement    */
/* ------------------------------------------------------------------ */

function GiftDetailModal({ gift, onClose, onRemind, onMarkAcknowledged }) {
  const cfg = statusConfig[gift.status];
  const StatusIcon = cfg.icon;
  const seenLabel = gift.seenAt
    ? `Seen by participant on ${gift.seenAt}.`
    : "Not yet viewed by participant.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/60 bg-white/90 shadow-2xl shadow-slate-900/20 backdrop-blur-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {gift.section}
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`}
              >
                <StatusIcon size={10} />
                {cfg.label}
              </span>
            </p>
            <h4 className="mt-1 truncate text-base font-bold text-slate-900">
              {gift.studentName}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              From {sponsorName(gift.sponsor)}
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
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-100">
              <Gift size={19} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {gift.item}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarClock size={12} />
                Received {gift.dateReceived}
              </p>
            </div>
          </div>

          {gift.note && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-slate-50 p-3.5 ring-1 ring-slate-100">
              <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <p className="text-sm leading-relaxed text-slate-600">
                {gift.note}
              </p>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
            <p>
              {gift.status === "Awaiting"
                ? `Sent to ${gift.studentName} · ${waitingLabel(gift.dateReceived)}.`
                : `Acknowledged by ${gift.studentName} on ${gift.acknowledgedAt}.`}
            </p>
            <p className="mt-1 font-medium text-slate-600">{seenLabel}</p>
          </div>
        </div>

        {/* Footer actions */}
        {gift.status === "Awaiting" ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => onRemind(gift.id)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <BellRing size={14} />
              Send reminder
            </button>
            <button
              type="button"
              onClick={() => onMarkAcknowledged(gift.id)}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800"
            >
              <CheckCircle2 size={14} />
              Mark acknowledged
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => onRemind(gift.id, true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              <Undo2 size={13} />
              Reopen as awaiting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 2 — Monitor Acknowledgements                                     */
/* ------------------------------------------------------------------ */

function MonitorAcknowledgements({
  gifts,
  onRemind,
  onMarkAcknowledged,
  onReopen,
}) {
  const [statusFilter, setStatusFilter] = useState("Awaiting");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);

  const counts = useMemo(() => {
    const c = { All: gifts.length };
    for (const s of Object.keys(statusConfig)) {
      c[s] = gifts.filter((g) => g.status === s).length;
    }
    return c;
  }, [gifts]);

  const filtered = gifts.filter((g) => {
    const matchesStatus = statusFilter === "All" || g.status === statusFilter;
    const matchesQuery =
      query.trim() === "" ||
      g.studentName.toLowerCase().includes(query.toLowerCase()) ||
      g.item.toLowerCase().includes(query.toLowerCase()) ||
      sponsorName(g.sponsor).toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const openGift = gifts.find((g) => g.id === openId) || null;

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <div>
      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {["All", ...Object.keys(statusConfig)].map((s) => {
            const active = statusFilter === s;
            const label = s === "All" ? "All" : statusConfig[s].label;
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
                {s === "Awaiting" ? "Awaiting" : label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search participant, gift, or sponsor..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {filtered.map((g) => {
          const cfg = statusConfig[g.status];
          const StatusIcon = cfg.icon;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setOpenId(g.id);
              }}
              className={`flex w-full items-center gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80 ${GLASS}`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Gift size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {g.studentName}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {g.item} · From {sponsorName(g.sponsor)}
                </p>
              </div>
              <div className="hidden flex-shrink-0 text-right sm:block">
                <p className="text-xs text-slate-400">
                  {g.seenAt
                    ? `Seen ${g.seenAt}`
                    : g.status === "Acknowledged"
                      ? `Ack'd ${g.acknowledgedAt}`
                      : waitingLabel(g.dateReceived)}
                </p>
              </div>
              <span
                className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
              >
                <StatusIcon size={12} />
                {cfg.label}
              </span>
              {g.seenAt && (
                <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  Seen
                </span>
              )}
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

      {openGift && (
        <GiftDetailModal
          gift={openGift}
          onClose={() => setOpenId(null)}
          onRemind={(id, reopen) => {
            if (reopen) {
              onReopen(id);
              flashToast(
                `Reopened — ${openGift.studentName} can acknowledge again.`,
              );
            } else {
              onRemind(id);
              flashToast(`Reminder sent to ${openGift.studentName}.`);
            }
            setOpenId(null);
          }}
          onMarkAcknowledged={(id) => {
            onMarkAcknowledged(id);
            flashToast(`Marked acknowledged for ${openGift.studentName}.`);
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
  { key: "send", label: "Send Gift Notification", icon: FilePlus2 },
  { key: "monitor", label: "Monitor Acknowledgements", icon: Inbox },
];

export default function AdminGiftNotifications() {
  const currentUser = getCurrentUser();
  const requesterId = currentUser?.id;
  const [students, setStudents] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [activeTab, setActiveTab] = useState("monitor");
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!requesterId) return;
    Promise.all([fetchUsers("student", requesterId), fetchGifts(requesterId)])
      .then(([roster, giftRows]) => {
        setStudents(roster);
        setGifts(giftRows);
      })
      .catch((err) => setError(err.message));
  }, [requesterId]);

  const overview = useMemo(() => {
    const awaiting = gifts.filter((g) => g.status === "Awaiting").length;
    const acknowledged = gifts.filter(
      (g) => g.status === "Acknowledged",
    ).length;
    return {
      totalStudents: students.length,
      totalGifts: gifts.length,
      awaiting,
      acknowledged,
    };
  }, [gifts, students.length]);

  async function handleSend(form, student) {
    try {
      const sponsorValue = (
        form.sponsor ||
        sponsorName(
          student?.sponsor || student?.sponsorName || student?.sponsor_name,
        )
      ).trim();

      const newGift = await createGift({
        requesterId,
        studentId: student.id,
        ...(sponsorId(student) ? { sponsorId: sponsorId(student) } : {}),
        sponsor: sponsorValue,
        item: form.item,
        note: form.note,
        dateReceived: form.dateReceived,
      });
      setGifts((prev) => [newGift, ...prev]);
      setToast(`Notified ${student.name} about "${form.item}".`);
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => setToast(null), 2500);
  }

  async function handleRemind(id) {
    try {
      const updated = await remindGift(id, requesterId);
      setGifts((prev) => prev.map((gift) => (gift.id === id ? updated : gift)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkAcknowledged(id) {
    try {
      const updated = await acknowledgeGift(id, requesterId);
      setGifts((prev) => prev.map((gift) => (gift.id === id ? updated : gift)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReopen(id) {
    try {
      const updated = await reopenGift(id, requesterId);
      setGifts((prev) => prev.map((gift) => (gift.id === id ? updated : gift)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 size={16} className="text-green-400" />
          {toast}
        </div>
      )}

      <div>
        <h3 className="mt-0.5 text-lg font-bold text-slate-900">
          Gift Notifications
        </h3>
        <p className="text-sm text-slate-500">
          Let participants know a gift has arrived, then track who's confirmed
          receiving it
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
              {overview.totalStudents}
            </p>
            <p className="truncate text-xs text-slate-500">
              Participants in program
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Gift size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.totalGifts}
            </p>
            <p className="truncate text-xs text-slate-500">Gifts logged</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Clock size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.awaiting}
            </p>
            <p className="truncate text-xs text-slate-500">
              Awaiting acknowledgement
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <PackageCheck size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.acknowledged}
            </p>
            <p className="truncate text-xs text-slate-500">Acknowledged</p>
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
          <SendGiftNotification students={students} onSend={handleSend} />
        ) : (
          <MonitorAcknowledgements
            gifts={gifts}
            onRemind={handleRemind}
            onMarkAcknowledged={handleMarkAcknowledged}
            onReopen={handleReopen}
          />
        )}
      </div>
    </section>
  );
}
