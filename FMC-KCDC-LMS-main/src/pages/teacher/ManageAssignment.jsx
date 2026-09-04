import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Calculator,
  Calendar,
  FileText,
  Paperclip,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  FilePlus2,
  ClipboardList,
  X,
  Upload,
  Bell,
  Search,
  Sparkles,
  Users,
  TrendingUp,
  Trophy,
  Gift,
  Medal,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  createAssignment,
  updateAssignment,
  fetchTeacherOverview,
  deleteAssignment,
} from "../../api/assignments";
import { getCurrentUser } from "../../api/auth";
import {
  parsePhDate,
  formatPhDateTime,
  toPhCalendarDate,
} from "../../utils/phDate";
import {
  GLASS,
  GLASS_SOLID,
  GLASS_SUBTLE,
} from "../../components/shared/GlassCard";
import BibleMotif from "../../components/shared/BibleMotif";
import ToastStack, { useToast } from "../../components/shared/Toast";
import { useSections } from "../../hooks/useSections";

/* ------------------------------------------------------------------ */
/* Shared data                                                         */
/* ------------------------------------------------------------------ */

const categories = [
  { value: "academic-support", label: "Academic Support", icon: Calculator },
  {
    value: "christian-living-education",
    label: "Christian Living Education",
    icon: BookOpen,
  },
];

// Mirrors assignmentController.ALL_SECTIONS_SENTINEL exactly — a plain
// string, not imported, since there's no shared module across the
// frontend/backend boundary here. Admin-only: a teacher never has a
// section picker at all, so this never even renders for them.
const ALL_SECTIONS_VALUE = "ALL";

// Anywhere a section value is shown back to an admin (the create-form
// preview, the Check Assignment list, ...) this turns the raw sentinel
// into the label they actually picked from the dropdown, rather than
// leaking "ALL" as if it were a real section's name.
function sectionLabel(section) {
  return section === ALL_SECTIONS_VALUE ? "All Sections" : section;
}

const initialForm = {
  category: "",
  section: "",
  title: "",
  dueDate: "",
  instructions: "",
  attachment: null,
  hasPrize: false,
  prizeDescription: "",
  prizeWinners: 3,
};

const NOW = new Date();

const statusStyles = {
  submitted: {
    label: "Submitted",
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700 ring-1 ring-green-200",
  },
  late: {
    label: "Late",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  missing: {
    label: "Missing",
    icon: AlertCircle,
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  },
};

const rankStyles = [
  {
    className: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
    label: "1st",
  },
  {
    className: "bg-slate-200 text-slate-600 ring-1 ring-slate-300",
    label: "2nd",
  },
  {
    className: "bg-orange-100 text-orange-700 ring-1 ring-orange-300",
    label: "3rd",
  },
];

function initials(name) {
  return name
    .replace(/\(.*\)/, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// dueDateStr is either a plain "YYYY-MM-DD" (from the AddAssignment form,
// still being typed) or the full "YYYY-MM-DD HH:mm:ss" the API returns —
// parsePhDate handles both, treating the plain form the same way the
// backend pins it once saved: 5:00 PM PH time.
function daysUntil(dueDateStr) {
  const due = parsePhDate(dueDateStr);
  return Math.round((due.getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24));
}

function dueLabel(dueDateStr) {
  const d = daysUntil(dueDateStr);
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) > 1 ? "s" : ""} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

function formatSubmittedAt(iso) {
  if (!iso) return null;
  return formatPhDateTime(iso);
}

// Returns a map of student -> rank index (0-based) for the first N on-time finishers.
function computeWinners(assignment) {
  if (!assignment.prize?.enabled || !assignment.prize.winners) return {};
  const onTime = assignment.submissions
    .filter((s) => s.status === "submitted" && s.submittedAt)
    .map((s) => ({ ...s, ts: parsePhDate(s.submittedAt).getTime() }))
    .sort((a, b) => a.ts - b.ts)
    .slice(0, assignment.prize.winners);

  const map = {};
  onTime.forEach((s, i) => {
    map[s.student] = i;
  });
  return map;
}

/* ------------------------------------------------------------------ */
/* Add Assignment                                                      */
/* ------------------------------------------------------------------ */

function quickDate(daysFromNow) {
  return toPhCalendarDate(
    new Date(NOW.getTime() + daysFromNow * 24 * 60 * 60 * 1000),
  );
}

const quickDateOptions = [
  { label: "Tomorrow", value: quickDate(1) },
  { label: "In a week", value: quickDate(7) },
  { label: "In 2 weeks", value: quickDate(14) },
];

function AddAssignment({ onCreated, sectionOptions }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();
  const isAdmin = getCurrentUser()?.role === "admin";

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setFile = (file) => setForm((prev) => ({ ...prev, attachment: file }));
  const handleFile = (e) => setFile(e.target.files?.[0] || null);
  const removeFile = () => setFile(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(file);
  }

  const validate = () => {
    const next = {};
    if (!form.category) next.category = "Please choose a category.";
    if (isAdmin && !form.section) next.section = "Please choose a section.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.dueDate) next.dueDate = "Please set a due date.";
    if (form.hasPrize) {
      if (!form.prizeDescription.trim())
        next.prizeDescription = "Describe the reward.";
      if (!form.prizeWinners || Number(form.prizeWinners) < 1) {
        next.prizeWinners = "Must be at least 1.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const categoryLabel = categories.find(
      (c) => c.value === form.category,
    )?.label;
    const postedTitle = form.title.trim();

    setIsSubmitting(true);
    try {
      await createAssignment({
        title: postedTitle,
        category: categoryLabel,
        participantId: getCurrentUser()?.participantId,
        teacherName: getCurrentUser()?.name,
        // Only sent for admin — the backend ignores this field entirely
        // for a teacher and forces their own section instead.
        ...(isAdmin ? { section: form.section } : {}),
        instructions: form.instructions,
        dueDate: form.dueDate,
        hasPrize: form.hasPrize,
        prizeDescription: form.prizeDescription,
        prizeWinners: form.prizeWinners,
      });
      showToast(postedTitle, {
        type: "success",
        title: "Assignment created successfully",
      });
      setForm(initialForm);
      // Refreshes the "Active assignments" stat and the Check Assignment
      // list (loadOverview, passed down as onCreated) — no page reload.
      onCreated?.();
    } catch {
      // Form is deliberately left as-is on failure so the teacher doesn't
      // lose what they typed.
      showToast("Failed to create assignment, try again.", {
        type: "error",
        title: "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = toPhCalendarDate(NOW);
  const selectedCategory = categories.find((c) => c.value === form.category);
  // Admin: whatever they picked in the section dropdown below. Teacher: no
  // dropdown at all — always their own assigned section.
  const previewSection = isAdmin ? form.section : getCurrentUser()?.section;
  const hasPreview = form.title || form.category || form.dueDate;

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={`p-5 sm:p-6 lg:col-span-3 ${GLASS_SOLID}`}
        >
          {/* Category */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Category
            </label>
            <p className="mt-0.5 text-xs text-slate-400">
              Choose which subject area this assignment belongs to
            </p>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {categories.map((cat) => {
                const isSelected = form.category === cat.value;
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, category: cat.value }))
                    }
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? "border-green-600 bg-green-50 ring-1 ring-green-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? "bg-green-700 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <CatIcon size={16} />
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? "text-green-800" : "text-slate-700"
                      }`}
                    >
                      {cat.label}
                    </span>
                    <span
                      className={`ml-auto h-4 w-4 flex-shrink-0 rounded-full border-2 transition-colors ${
                        isSelected
                          ? "border-green-700 bg-green-700"
                          : "border-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {errors.category && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.category}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="mt-5">
            <label
              htmlFor="title"
              className="text-sm font-semibold text-slate-700"
            >
              Title of the Assignment
            </label>
            <div className="relative mt-1.5">
              <FileText
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={handleChange("title")}
                placeholder="e.g. Reflection Paper on Chapter 3"
                className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.title
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
            </div>
            {errors.title && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.title}
              </p>
            )}
          </div>

          {/* Due date + Section */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="dueDate"
                className="text-sm font-semibold text-slate-700"
              >
                Due Date
              </label>
              <div className="relative mt-1.5">
                <Calendar
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="dueDate"
                  type="date"
                  min={today}
                  value={form.dueDate}
                  onChange={handleChange("dueDate")}
                  className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 ${
                    errors.dueDate
                      ? "border-rose-300 focus:ring-rose-100"
                      : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                  }`}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {quickDateOptions.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, dueDate: q.value }))
                    }
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      form.dueDate === q.value
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              {errors.dueDate && (
                <p className="mt-1.5 text-xs font-medium text-rose-600">
                  {errors.dueDate}
                </p>
              )}
            </div>

            {/* Admin only — a teacher never sees a section picker at all;
                the backend forces their own users.section regardless. */}
            {isAdmin && (
              <div>
                <label
                  htmlFor="section"
                  className="text-sm font-semibold text-slate-700"
                >
                  Section
                </label>
                <div className="relative mt-1.5">
                  <select
                    id="section"
                    value={form.section}
                    onChange={handleChange("section")}
                    className={`w-full appearance-none rounded-lg border bg-white py-2.5 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 ${
                      errors.section
                        ? "border-rose-300 focus:ring-rose-100"
                        : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                    } ${form.section ? "text-slate-700" : "text-slate-400"}`}
                  >
                    <option value="" disabled>
                      Select a section
                    </option>
                    <option
                      value={ALL_SECTIONS_VALUE}
                      className="font-semibold text-slate-700"
                    >
                      All Sections
                    </option>
                    {sectionOptions.map((sec) => (
                      <option key={sec} value={sec} className="text-slate-700">
                        {sec}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
                {errors.section && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {errors.section}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-5">
            <label
              htmlFor="instructions"
              className="text-sm font-semibold text-slate-700"
            >
              Instructions{" "}
              
            </label>
            <textarea
              id="instructions"
              rows={4}
              value={form.instructions}
              onChange={handleChange("instructions")}
              placeholder="Add any details, requirements, or grading criteria..."
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Attachment */}
          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700">
              Attachment{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>

            {form.attachment ? (
              <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2 truncate text-slate-700">
                  <Paperclip
                    size={14}
                    className="flex-shrink-0 text-slate-400"
                  />
                  <span className="truncate">{form.attachment.name}</span>
                </span>
                <button
                  type="button"
                  onClick={removeFile}
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
                className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-6 text-center transition-all ${
                  dragActive
                    ? "scale-[1.01] border-green-500 bg-green-50"
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
          </div>

          {/* Prize for first N finishers */}
          <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Trophy size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Reward early finishers
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Give the first students to submit something extra
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={form.hasPrize}
                onClick={() =>
                  setForm((prev) => ({ ...prev, hasPrize: !prev.hasPrize }))
                }
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  form.hasPrize ? "bg-amber-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    form.hasPrize ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {form.hasPrize && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="prizeDescription"
                    className="text-xs font-semibold text-slate-600"
                  >
                    Reward
                  </label>
                  <div className="relative mt-1.5">
                    <Gift
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="prizeDescription"
                      type="text"
                      value={form.prizeDescription}
                      onChange={handleChange("prizeDescription")}
                      placeholder="e.g. Extra 5 points, no-homework pass"
                      className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        errors.prizeDescription
                          ? "border-rose-300 focus:ring-rose-100"
                          : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
                      }`}
                    />
                  </div>
                  {errors.prizeDescription && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">
                      {errors.prizeDescription}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="prizeWinners"
                    className="text-xs font-semibold text-slate-600"
                  >
                    First how many students?
                  </label>
                  <input
                    id="prizeWinners"
                    type="number"
                    min={1}
                    max={50}
                    value={form.prizeWinners}
                    onChange={handleChange("prizeWinners")}
                    className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 ${
                      errors.prizeWinners
                        ? "border-rose-300 focus:ring-rose-100"
                        : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
                    }`}
                  />
                  {errors.prizeWinners && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">
                      {errors.prizeWinners}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setErrors({});
              }}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Posting…" : "Post Assignment"}
            </button>
          </div>
        </form>

        {/* Live preview — exactly what students will see */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Sparkles size={13} />
              Participant preview
            </p>
            {!hasPreview ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
                <ClipboardList size={22} className="text-slate-300" />
                <p className="text-xs text-slate-400">
                  Start filling out the form to see how this will appear on
                  students' assignment lists.
                </p>
              </div>
            ) : (
              <div className={`mt-3 p-4 ${GLASS}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    {selectedCategory ? (
                      <selectedCategory.icon
                        size={18}
                        className="text-slate-600"
                      />
                    ) : (
                      <ClipboardList size={18} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {selectedCategory?.label || "Category"}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                      {form.title || "Untitled assignment"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {form.dueDate ? dueLabel(form.dueDate) : "No due date yet"}
                  </span>
                  {previewSection && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{sectionLabel(previewSection)}</span>
                    </>
                  )}
                </div>
                {form.attachment && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                    <Paperclip size={12} />
                    <span className="truncate">{form.attachment.name}</span>
                  </div>
                )}
                {form.hasPrize &&
                  (form.prizeDescription || form.prizeWinners) && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      <Trophy size={12} />
                      <span className="truncate">
                        First {form.prizeWinners || "?"} to submit get
                        {Number(form.prizeWinners) === 1 ? "s" : ""}:{" "}
                        {form.prizeDescription || "a reward"}
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Check Assignment                                                     */
/* ------------------------------------------------------------------ */

function CheckAssignment({
  assignments,
  loading,
  loadError,
  onDeleted,
  onUpdated,
  sectionOptions,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState("");
  const [reminded, setReminded] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const isAdmin = getCurrentUser()?.role === "admin";

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()),
  );

  function remindMissing(assignmentId) {
    setReminded((prev) => ({ ...prev, [assignmentId]: true }));
    setTimeout(
      () => setReminded((prev) => ({ ...prev, [assignmentId]: false })),
      2500,
    );
  }

  async function handleDelete(assignmentId) {
    setDeletingId(assignmentId);
    setDeleteError(null);
    try {
      await deleteAssignment(assignmentId, getCurrentUser()?.participantId);
      setConfirmingId(null);
      onDeleted?.(assignmentId);
    } catch (err) {
      setDeleteError({ id: assignmentId, message: err.message });
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(assignment) {
    const categoryValue =
      categories.find((c) => c.label === assignment.category)?.value || "";
    setEditForm({
      title: assignment.title,
      category: categoryValue,
      section: assignment.section || "",
      // API returns "YYYY-MM-DD HH:mm:ss" (or a bare date) — the <input
      // type="date"> below only ever wants the first 10 characters.
      dueDate: (assignment.dueDate || "").slice(0, 10),
      instructions: assignment.instructions || "",
      hasPrize: Boolean(assignment.prize?.enabled),
      prizeDescription: assignment.prize?.description || "",
      prizeWinners: assignment.prize?.winners || 3,
    });
    setEditingId(assignment.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  const handleEditFieldChange = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  async function saveEdit(assignmentId) {
    const categoryLabel = categories.find(
      (c) => c.value === editForm.category,
    )?.label;
    setEditSubmitting(true);
    try {
      await updateAssignment(assignmentId, {
        title: editForm.title.trim(),
        category: categoryLabel,
        participantId: getCurrentUser()?.participantId,
        // Only sent for admin — the backend ignores this for a teacher
        // and keeps the assignment pinned to their own section.
        ...(isAdmin ? { section: editForm.section } : {}),
        instructions: editForm.instructions,
        dueDate: editForm.dueDate,
        hasPrize: editForm.hasPrize,
        prizeDescription: editForm.prizeDescription,
        prizeWinners: editForm.prizeWinners,
      });
      showToast(editForm.title.trim(), {
        type: "success",
        title: "Assignment updated",
      });
      setEditingId(null);
      setEditForm(null);
      onUpdated?.();
    } catch (err) {
      showToast(err.message || "Failed to update assignment, try again.", {
        type: "error",
        title: "Something went wrong",
      });
    } finally {
      setEditSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={`py-14 text-center ${GLASS_SUBTLE}`}>
        <ClipboardList size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Loading assignments…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
        <AlertCircle size={16} />
        Couldn't load assignments: {loadError}
      </div>
    );
  }

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="relative mb-4 max-w-xs">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="text"
          placeholder="Search assignments..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((assignment) => {
          const isOpen = expandedId === assignment.id;
          const submittedCount = assignment.submissions.filter(
            (s) => s.status === "submitted" || s.status === "late",
          ).length;
          const missingCount = assignment.submissions.filter(
            (s) => s.status === "missing",
          ).length;
          const total = assignment.submissions.length;
          const pct = Math.round((submittedCount / total) * 100);
          const overdue = daysUntil(assignment.dueDate) < 0;

          const winnerMap = computeWinners(assignment);
          const winnersFilled = Object.keys(winnerMap).length;
          const prizeSpotsLeft = assignment.prize?.enabled
            ? Math.max(assignment.prize.winners - winnersFilled, 0)
            : 0;

          if (editingId === assignment.id && editForm) {
            return (
              <div key={assignment.id} className={`p-4 sm:p-5 ${GLASS}`}>
                <p className="text-sm font-semibold text-slate-800">
                  Edit assignment
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={handleEditFieldChange("title")}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={handleEditFieldChange("category")}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={handleEditFieldChange("dueDate")}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>

                  {/* Admin only — a teacher can't move an assignment out of
                      their own section, so no picker is shown to them. */}
                  {isAdmin && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Section
                      </label>
                      <select
                        value={editForm.section}
                        onChange={handleEditFieldChange("section")}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option
                          value={ALL_SECTIONS_VALUE}
                          className="font-semibold"
                        >
                          All Sections
                        </option>
                        {sectionOptions.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.instructions}
                    onChange={handleEditFieldChange("instructions")}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    id={`edit-hasPrize-${assignment.id}`}
                    type="checkbox"
                    checked={editForm.hasPrize}
                    onChange={handleEditFieldChange("hasPrize")}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  <label
                    htmlFor={`edit-hasPrize-${assignment.id}`}
                    className="text-xs font-semibold text-slate-600"
                  >
                    Offer a reward for the first submitters
                  </label>
                </div>
                {editForm.hasPrize && (
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editForm.prizeDescription}
                      onChange={handleEditFieldChange("prizeDescription")}
                      placeholder="Reward description"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      min={1}
                      value={editForm.prizeWinners}
                      onChange={handleEditFieldChange("prizeWinners")}
                      placeholder="Number of winners"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={editSubmitting}
                    className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(assignment.id)}
                    disabled={editSubmitting}
                    className="rounded-lg bg-green-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {editSubmitting ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={assignment.id}
              className={`overflow-hidden transition-shadow hover:shadow-xl ${GLASS}`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggle(assignment.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(assignment.id);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-3 p-4 text-left hover:bg-slate-50 sm:p-5"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <ClipboardList size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                    {assignment.title}
                    {assignment.prize?.enabled && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                        <Trophy size={10} />
                        Prize
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                    <span>{assignment.category}</span>
                    <span>·</span>
                    <span>{sectionLabel(assignment.section)}</span>
                    <span>·</span>
                    <span
                      className={overdue ? "font-medium text-rose-500" : ""}
                    >
                      {dueLabel(assignment.dueDate)}
                    </span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-32 max-w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-green-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      {pct}%
                    </span>
                  </div>
                </div>

                <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {submittedCount}/{total} submitted
                </span>

                {confirmingId === assignment.id ? (
                  <span
                    className="flex flex-shrink-0 flex-col items-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-rose-600">
                        Delete this?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(assignment.id)}
                        disabled={deletingId === assignment.id}
                        className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === assignment.id ? "Deleting…" : "Yes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={deletingId === assignment.id}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </span>
                    {deleteError?.id === assignment.id && (
                      <span className="text-[10px] font-medium text-rose-500">
                        {deleteError.message}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex flex-shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(assignment);
                      }}
                      aria-label={`Edit ${assignment.title}`}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-green-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingId(assignment.id);
                      }}
                      aria-label={`Delete ${assignment.title}`}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                )}

                <ChevronRight
                  size={18}
                  className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">
                  {assignment.prize?.enabled && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                        <Trophy size={14} />
                        First {assignment.prize.winners} to submit on time get:{" "}
                        <span className="font-semibold">
                          {assignment.prize.description}
                        </span>
                      </p>
                      <span className="flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                        {prizeSpotsLeft > 0
                          ? `${prizeSpotsLeft} spot${prizeSpotsLeft > 1 ? "s" : ""} left`
                          : "All spots claimed"}
                      </span>
                    </div>
                  )}

                  {missingCount > 0 && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2.5">
                      <p className="text-xs font-medium text-rose-700">
                        {missingCount} student
                        {missingCount > 1 ? "s haven't" : " hasn't"} submitted
                        yet
                      </p>
                      <button
                        type="button"
                        onClick={() => remindMissing(assignment.id)}
                        disabled={reminded[assignment.id]}
                        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200 transition-colors hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Bell size={13} />
                        {reminded[assignment.id]
                          ? "Reminder sent!"
                          : "Remind them"}
                      </button>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100">
                    {assignment.submissions.map((sub, i) => {
                      const status = statusStyles[sub.status];
                      const StatusIcon = status.icon;
                      const rank = winnerMap[sub.student];
                      const isWinner = rank !== undefined;
                      const rankStyle = rankStyles[rank] ?? {
                        className:
                          "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
                        label: `${rank + 1}th`,
                      };

                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 py-3 ${
                            isWinner
                              ? "-mx-2 rounded-lg bg-amber-50/60 px-2"
                              : ""
                          }`}
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                            {initials(sub.student)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium text-slate-700">
                              {sub.student}
                              {isWinner && (
                                <span
                                  className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${rankStyle.className}`}
                                >
                                  <Medal size={10} />
                                  {rankStyle.label}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {sub.submittedAt
                                ? `Submitted ${formatSubmittedAt(sub.submittedAt)}`
                                : "Not submitted"}
                            </p>
                          </div>

                          <span
                            className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                          >
                            <StatusIcon size={12} />
                            {status.label}
                          </span>

                          {sub.file ? (
                            <button
                              type="button"
                              onClick={() => console.log("Download", sub.file)}
                              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-green-400 hover:text-green-700"
                            >
                              <Download size={13} />
                              <span className="hidden sm:inline">
                                {sub.file}
                              </span>
                              <span className="sm:hidden">File</span>
                            </button>
                          ) : (
                            <span className="flex-shrink-0 px-3 py-1.5 text-xs text-slate-300">
                              —
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className={`py-14 text-center ${GLASS_SUBTLE}`}>
            <ClipboardList size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              No assignments found
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Try a different search
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manage Assignment (sub-nav)                                         */
/* ------------------------------------------------------------------ */

const tabs = [
  { key: "add", label: "Add Assignment", icon: FilePlus2 },
  { key: "check", label: "Check Assignment", icon: ClipboardList },
];

export default function ManageAssignment() {
  const { sections: sectionOptions } = useSections();
  const [activeTab, setActiveTab] = useState("add");
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // `silent` skips the loading flag — used for the post-delete background
  // refresh so an already-updated (optimistically trimmed) list doesn't
  // flash back to the loading placeholder.
  const loadOverview = useCallback((silent = false) => {
    const userId = getCurrentUser()?.id;
    if (!silent) setLoading(true);
    setLoadError(null);
    fetchTeacherOverview(userId)
      .then((data) => setOverviewData(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  function handleAssignmentDeleted(id) {
    setOverviewData((prev) =>
      prev
        ? { ...prev, assignments: prev.assignments.filter((a) => a.id !== id) }
        : prev,
    );
    loadOverview(true);
  }

  const assignments = overviewData?.assignments || [];
  const overview = {
    totalAssignments: overviewData?.activeAssignments ?? 0,
    rate: overviewData?.submissionRate ?? 0,
    missing: overviewData?.studentsYetToSubmit ?? 0,
  };

  return (
    <section className="relative ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <BibleMotif className="absolute -z-10 top-0 right-0 h-64 w-52 opacity-10 sm:h-96 sm:w-80 sm:opacity-[0.12] lg:h-[28rem] lg:w-[22rem]" />

      <div>
        <h3 className="text-lg font-bold text-slate-900">Manage Assignments</h3>
        <p className="text-sm text-slate-500">
          Post new assignments and review what your students have submitted
        </p>
      </div>

      {/* Overview stat strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ClipboardList size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.totalAssignments}
            </p>
            <p className="truncate text-xs text-slate-500">
              Active assignments
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <TrendingUp size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.rate}%
            </p>
            <p className="truncate text-xs text-slate-500">
              Overall submission rate
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <Users size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.missing}
            </p>
            <p className="truncate text-xs text-slate-500">
              Students yet to submit
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
        {activeTab === "add" ? (
          <AddAssignment
            onCreated={loadOverview}
            sectionOptions={sectionOptions}
          />
        ) : (
          <CheckAssignment
            assignments={assignments}
            loading={loading}
            loadError={loadError}
            sectionOptions={sectionOptions}
            onDeleted={handleAssignmentDeleted}
            onUpdated={() => loadOverview(true)}
          />
        )}
      </div>
    </section>
  );
}
