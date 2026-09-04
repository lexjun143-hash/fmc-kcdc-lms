import React, { useState, useRef, useEffect } from "react";
import {
  fetchAssignments,
  submitAssignment as apiSubmitAssignment,
  unsubmitAssignment as apiUnsubmitAssignment,
} from "../../api/assignments";
import { getCurrentUser } from "../../api/auth";
import ToastStack, { useToast } from "../../components/shared/Toast";
import { parsePhDate, formatPhDate, formatPhTime } from "../../utils/phDate";
import GlassCard, { GLASS, GLASS_SOLID, GLASS_SUBTLE } from "../../components/shared/GlassCard";
import BibleMotif from "../../components/shared/BibleMotif";
import {
  BookOpen,
  Mail,
  Calculator,
  ClipboardList,
  Paperclip,
  Upload,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Send,
  Pencil,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Undo2,
  CalendarClock,
  Inbox,
  Trophy,
} from "lucide-react";

/* ---------------------------------------------------------
   Palette, intentionally restrained:
   - Category badges all share one neutral/brand tone — the
     icon shape tells subjects apart, not a rainbow of hues.
   - Status uses just three colors total: gray (in progress),
     green (done — matches the portal's brand green), and
     red (reserved only for the "needs attention" state).
   - Reward messaging gets its own single color, amber, used
     nowhere else on the page, so a prize always reads as a
     prize and never gets confused with a status.
--------------------------------------------------------- */
const CATEGORY_META = {
  "Christian Living Education": { icon: BookOpen },
  "Academic Support": { icon: Calculator },
  "My Letter Writing": { icon: Mail },
  "Center Requirements": { icon: ClipboardList },
};

const STATUS_META = {
  assigned: {
    label: "To do",
    color: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    icon: Clock,
    bar: "bg-slate-300",
  },
  submitted: {
    label: "Submitted",
    color: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
    icon: CheckCircle2,
    bar: "bg-green-600",
  },
  late: {
    label: "Missing",
    color: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-200",
    icon: AlertCircle,
    bar: "bg-red-500",
  },
};

const FILE_ICON = {
  pdf: FileText,
  doc: FileText,
  image: ImageIcon,
  default: FileIcon,
};

const NOW = new Date();

function initials(name) {
  return name
    .split(" ")
    .filter((w) => !["Ate", "Kuya", "Sir", "Ma'am"].includes(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatAbsolute(iso) {
  return `${formatPhDate(iso)} · ${formatPhTime(iso)}`;
}

function relativeDue(iso) {
  const due = parsePhDate(iso);
  const diffMs = due.getTime() - NOW.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const time = formatPhTime(iso);

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 0) return `Due today, ${time}`;
    return `${overdueDays} day${overdueDays > 1 ? "s" : ""} overdue`;
  }
  if (diffDays === 0) return `Due today, ${time}`;
  if (diffDays === 1) return `Due tomorrow, ${time}`;
  if (diffDays <= 6) return `Due in ${diffDays} days`;
  return `Due ${formatAbsolute(iso)}`;
}

function guessFileType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  return "default";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* --------------------------- Small building blocks --------------------------- */

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-600",
  };
  return (
    <GlassCard className="flex flex-1 items-center gap-3 px-4 py-3.5">
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-slate-800">
          {value}
        </p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </GlassCard>
  );
}

function FilterTabs({ active, onChange, counts }) {
  const tabs = [
    { key: "all", label: "All" },
    { key: "assigned", label: "To do" },
    { key: "submitted", label: "Turned in" },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-8">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative flex-shrink-0 px-4 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? "text-green-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[t.key]}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-green-700" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// One-line reward status used on both the card badge and the detail banner.
function rewardStatus(assignment) {
  const { reward, submission } = assignment;
  if (!reward) return null;
  const spotsLeft = Math.max(0, reward.limit - reward.claimedBy);
  if (submission?.wonReward) return { state: "won", spotsLeft };
  if (assignment.status === "submitted") return { state: "missed", spotsLeft };
  if (spotsLeft === 0) return { state: "full", spotsLeft };
  return { state: "open", spotsLeft };
}

function RewardBadge({ assignment }) {
  const rs = rewardStatus(assignment);
  if (!rs) return null;
  const { reward } = assignment;

  const copy =
    rs.state === "won"
      ? "Reward earned"
      : rs.state === "missed"
      ? "Reward claimed"
      : rs.state === "full"
      ? "Reward claimed"
      : `${rs.spotsLeft} spot${rs.spotsLeft !== 1 ? "s" : ""} left for a prize`;

  const dim = rs.state === "missed" || rs.state === "full";

  return (
    <span
      className={`flex items-center gap-1 text-[11px] font-semibold ${
        dim ? "text-slate-400" : "text-amber-600"
      }`}
    >
      <Trophy size={11} />
      {copy}
    </span>
  );
}

function AssignmentCard({ assignment, onOpen }) {
  const meta = STATUS_META[assignment.status];
  const cat = CATEGORY_META[assignment.category];
  const StatusIcon = meta.icon;
  const CatIcon = cat.icon;
  const overdueSoon =
    assignment.status === "assigned" &&
    parsePhDate(assignment.dueDate).getTime() - NOW.getTime() <
      1000 * 60 * 60 * 24 * 2;

  return (
    <button
      onClick={() => onOpen(assignment.id)}
      className={`group relative flex w-full items-start gap-4 overflow-hidden p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/80 sm:p-5 ${GLASS}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${meta.bar}`} />
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <CatIcon size={19} className="text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold uppercase tracking-wide text-slate-400">
              {assignment.category}
            </p>
            <h3 className="mt-0.5 truncate text-[15px] font-bold text-slate-800 group-hover:text-slate-900">
              {assignment.title}
            </h3>
          </div>
          <span
            className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}
          >
            <StatusIcon size={13} />
            {meta.label}
          </span>
        </div>
        {assignment.submission?.status === "late" && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-200">
            <AlertCircle size={10} />
            Late
          </span>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span
            className={`flex items-center gap-1 font-medium ${overdueSoon ? "text-slate-700" : ""}`}
          >
            <CalendarClock size={12} />
            {relativeDue(assignment.dueDate)}
          </span>

          <span className="text-slate-400">{assignment.teacher}</span>
        </div>
        <div className="mt-1.5">
          <RewardBadge assignment={assignment} />
        </div>
      </div>
    </button>
  );
}

function FileChip({ file, onRemove }) {
  const Icon = FILE_ICON[file.type] || FILE_ICON.default;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">
        <Icon size={15} className="text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-700">
          {file.name}
        </p>
        <p className="text-xs text-slate-400">{file.size}</p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          aria-label={`Remove ${file.name}`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// Full reward explanation shown on the assignment detail page.
function RewardCard({ assignment }) {
  const rs = rewardStatus(assignment);
  if (!rs) return null;
  const { reward } = assignment;

  return (
    <div className="mt-4 rounded-2xl border border-amber-200/60 bg-amber-50/70 p-5 shadow-lg shadow-amber-900/5 backdrop-blur-md sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Trophy size={19} />
        </div>
        <div className="min-w-0 flex-1">
          {rs.state === "won" && (
            <>
              <p className="text-sm font-bold text-amber-800">You earned the reward</p>
              <p className="mt-0.5 text-xs text-amber-700">
                {reward.label} — you were one of the first {reward.limit} to turn this in.
              </p>
            </>
          )}
          {rs.state === "missed" && (
            <>
              <p className="text-sm font-bold text-amber-800">Reward already claimed</p>
              <p className="mt-0.5 text-xs text-amber-700">
                The first {reward.limit} students to turn this in got "{reward.label}." This turn-in still counts for credit.
              </p>
            </>
          )}
          {rs.state === "full" && (
            <>
              <p className="text-sm font-bold text-amber-800">All reward spots are taken</p>
              <p className="mt-0.5 text-xs text-amber-700">
                The first {reward.limit} students to turn this in got "{reward.label}." You can still turn this in for credit.
              </p>
            </>
          )}
          {rs.state === "open" && (
            <>
              <p className="text-sm font-bold text-amber-800">
                First {reward.limit} to turn this in get a prize
              </p>
              <p className="mt-0.5 text-xs text-amber-700">{reward.label}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: reward.limit }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-5 rounded-full ${
                        i < reward.claimedBy ? "bg-amber-500" : "bg-amber-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-amber-700">
                  {rs.spotsLeft} spot{rs.spotsLeft !== 1 ? "s" : ""} left
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Detail view --------------------------------- */

function AssignmentDetail({ assignment, onBack, onSubmitWork, onUnsubmit }) {
  const meta = STATUS_META[assignment.status];
  const cat = CATEGORY_META[assignment.category];
  const StatusIcon = meta.icon;
  const CatIcon = cat.icon;

  const [draftFiles, setDraftFiles] = useState(
    assignment.submission?.files || [],
  );
  const [comment, setComment] = useState(assignment.submission?.comment || "");
  const [isEditing, setIsEditing] = useState(!assignment.submission);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const fileInputRef = useRef(null);

  const overdue =
    parsePhDate(assignment.dueDate).getTime() < NOW.getTime() &&
    assignment.status === "assigned";
  const canEdit = true;

  // Draft entries are one of two shapes: `{ id, name, size, type }` for a
  // file already saved on a previous submission, or `{ name, size, type,
  // file }` for one freshly picked in this browser session — only the
  // latter has real bytes we can upload.
  function addFiles(fileList) {
    const newFiles = Array.from(fileList).map((f) => ({
      name: f.name,
      size: formatBytes(f.size),
      type: guessFileType(f.name),
      file: f,
    }));
    setDraftFiles((prev) => [...prev, ...newFiles]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const keepFileIds = draftFiles.filter((f) => f.id).map((f) => f.id);
      const newFiles = draftFiles.filter((f) => f.file).map((f) => f.file);
      await onSubmitWork(assignment.id, { comment, keepFileIds, newFiles });
      setIsEditing(false);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back to assignments
      </button>

      {overdue && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle size={16} />
          This assignment is overdue. You can still turn it in, but it may be
          marked late.
        </div>
      )}

      {/* Header card */}
      <div className={`p-5 sm:p-6 ${GLASS_SOLID}`}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <CatIcon size={22} className="text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {assignment.category}
            </p>
            <h1 className="mt-0.5 text-lg font-bold text-slate-800 sm:text-xl">
              {assignment.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {initials(assignment.teacher)}
                </span>
                {assignment.teacher}
              </span>

            </div>
          </div>
          <span
            className={`flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}
          >
            <StatusIcon size={13} />
            {overdue ? "Missing" : meta.label}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <CalendarClock size={14} className="text-slate-400" />
          {relativeDue(assignment.dueDate)}
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">
            {formatAbsolute(assignment.dueDate)}
          </span>
        </div>

        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {assignment.instructions}
        </p>

        {assignment.teacherAttachments.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Materials
            </p>
            {assignment.teacherAttachments.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-slate-200">
                  <Paperclip size={14} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {f.name}
                  </p>
                  <p className="text-xs text-slate-400">{f.size}</p>
                </div>
                <button
                  className="flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label={`Download ${f.name}`}
                >
                  <Download size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <RewardCard assignment={assignment} />

      {/* Your work card */}
      <div className={`mt-4 p-5 sm:p-6 ${GLASS_SOLID}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Your work
          </h2>
          {!isEditing && canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="mt-3 space-y-3">
            {assignment.submission?.files?.length > 0 ? (
              <div className="space-y-2">
                {assignment.submission.files.map((f) => (
                  <FileChip key={f.name} file={f} />
                ))}
              </div>
            ) : (
              <div className={`flex flex-col items-center gap-2 py-8 text-center ${GLASS_SUBTLE}`}>
                <Inbox size={22} className="text-slate-300" />
                <p className="text-sm text-slate-400">Nothing turned in yet</p>
              </div>
            )}
            {assignment.submission?.comment && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {assignment.submission.comment}
              </p>
            )}
            {assignment.submission?.submittedAt && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-green-700">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} />
                  Turned in {formatAbsolute(assignment.submission.submittedAt)}
                </span>
                {assignment.submission.status === "late" && (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-200">
                    <AlertCircle size={11} />
                    Late
                  </span>
                )}
              </p>
            )}
            {canEdit && assignment.status === "submitted" && (
              <button
                onClick={() =>
                  onUnsubmit(assignment.id).catch((err) => setSubmitError(err.message))
                }
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                <Undo2 size={13} />
                Unsubmit
              </button>
            )}
            {submitError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                <AlertCircle size={13} />
                {submitError}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {draftFiles.length > 0 && (
              <div className="space-y-2">
                {draftFiles.map((f, i) => (
                  <FileChip
                    key={`${f.name}-${i}`}
                    file={f}
                    onRemove={() =>
                      setDraftFiles((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                  />
                ))}
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all ${
                dragActive
                  ? "scale-[1.01] border-green-500 bg-green-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Upload
                size={22}
                className={dragActive ? "text-green-600" : "text-slate-400"}
              />
              <p className="text-sm font-medium text-slate-600">
                Drag and drop a file, or click to browse
              </p>
              <p className="text-xs text-slate-400">
                PDF, DOCX, JPG, PNG up to 20MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                draftFiles.length > 0
                  ? "Add a private comment for your teacher (optional)"
                  : "Write your answer here, or attach a file above"
              }
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />

            {submitError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                <AlertCircle size={13} />
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {assignment.submission && (
                <button
                  onClick={() => {
                    setDraftFiles(assignment.submission.files);
                    setComment(assignment.submission.comment);
                    setIsEditing(false);
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                // A file is no longer required — a written answer alone is
                // enough, matching the backend's own validation (see
                // submitAssignment). Still needs *something*, though: not
                // both empty at once.
                disabled={(draftFiles.length === 0 && !comment.trim()) || isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send size={15} />
                {isSubmitting
                  ? "Submitting…"
                  : assignment.submission
                  ? "Resubmit"
                  : "Submit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------- Root ----------------------------------- */

export default function MyAssignment() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState("all");
  const currentUserId = getCurrentUser()?.id;
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchAssignments(currentUserId)
      .then((data) => {
        if (!cancelled) setAssignments(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  // Exclude categories that belong to other pages (letter writing, attendance)
  const filteredAssignments = assignments.filter(
    (a) =>
      a.category !== "My Letter Writing" &&
      a.category !== "Center Requirements",
  );
  const [openId, setOpenId] = useState(null);

  const counts = {
    all: filteredAssignments.length,
    assigned: filteredAssignments.filter(
      (a) => a.status === "assigned" || a.status === "late",
    ).length,
    submitted: filteredAssignments.filter((a) => a.status === "submitted")
      .length,
  };

  const visible = filteredAssignments
    .filter((a) => {
      if (filter === "all") return true;
      if (filter === "assigned")
        return a.status === "assigned" || a.status === "late";
      return a.status === filter;
    })
    .sort((a, b) => parsePhDate(a.dueDate) - parsePhDate(b.dueDate));

  // Reward-slot bookkeeping now happens on the server (inside the same
  // transaction as the submission insert) so it can't race with another
  // student's submission. The API response is the new source of truth —
  // just drop it into place.
  async function handleSubmitWork(id, work) {
    try {
      const updated = await apiSubmitAssignment(id, work, currentUserId);
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      // The id being submitted is real and correctly formed — this
      // specifically means the assignment existed when this list was
      // fetched but has since been deleted server-side (a teacher/admin
      // removed it while this page was still open). Dropping it from
      // `assignments` here makes `openAssignment` (below) go stale on the
      // very next render, which unmounts AssignmentDetail in the same
      // pass — so its own inline error state would never actually be
      // seen. A toast lives on this parent component instead, so it
      // survives that transition and still reaches the student, with a
      // message that says what actually happened rather than a bare
      // "not found" that reads like a bug.
      if (err.message === "Assignment not found") {
        setAssignments((prev) => prev.filter((a) => a.id !== id));
        showToast("This assignment was removed and can no longer be submitted to.", {
          type: "error",
          title: "Assignment removed",
        });
      }
      throw err;
    }
  }

  async function handleUnsubmit(id) {
    const updated = await apiUnsubmitAssignment(id, currentUserId);
    setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  const openAssignment = filteredAssignments.find((a) => a.id === openId);

  // ToastStack is duplicated across every return path below (rather than
  // wrapped once around a single trailing return) so it stays mounted
  // through the openAssignment -> list transition triggered by the
  // "removed while open" recovery above — toasts live on this component,
  // not AssignmentDetail, specifically so they survive that switch.
  if (openAssignment) {
    return (
      <>
        <AssignmentDetail
          assignment={openAssignment}
          onBack={() => setOpenId(null)}
          onSubmitWork={handleSubmitWork}
          onUnsubmit={handleUnsubmit}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Inbox size={28} className="text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            Loading assignments…
          </p>
        </div>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <div className="mx-4 mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:mx-8">
          <AlertCircle size={16} />
          Couldn't load assignments: {loadError}
        </div>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="relative">
      <BibleMotif className="absolute -z-10 top-0 right-0 h-64 w-52 opacity-10 sm:h-96 sm:w-80 sm:opacity-[0.12] lg:h-[28rem] lg:w-[22rem]" />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Stat strip */}
      <div className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:px-8">
        <StatCard
          icon={Clock}
          label="Assignments to do"
          value={counts.assigned}
          tone="neutral"
        />
        <StatCard
          icon={CheckCircle2}
          label="Turned in"
          value={counts.submitted}
          tone="green"
        />
        <StatCard
          icon={Inbox}
          label="Total assignments"
          value={counts.all}
          tone="neutral"
        />
      </div>

      <FilterTabs active={filter} onChange={setFilter} counts={counts} />

      <div className="space-y-3 px-4 py-5 sm:px-8">
        {visible.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 text-center ${GLASS_SUBTLE}`}>
            <Inbox size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Nothing here yet
            </p>
          </div>
        ) : (
          visible.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onOpen={setOpenId} />
          ))
        )}
      </div>
    </div>
  );
}