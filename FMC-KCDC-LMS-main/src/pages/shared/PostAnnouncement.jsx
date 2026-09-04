import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pin,
  Megaphone,
  AlertTriangle,
  CalendarClock,
  PartyPopper,
  Info,
  ChevronDown,
  Search,
  Send,
  Trash2,
  Pencil,
  Sparkles,
  FilePlus2,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../../api/announcements";
import { getCurrentUser } from "../../api/auth";
import { formatPhDateTime } from "../../utils/phDate";
import {
  GLASS,
  GLASS_SOLID,
  GLASS_SUBTLE,
} from "../../components/shared/GlassCard";
import ToastStack, { useToast } from "../../components/shared/Toast";
import { useSections } from "../../hooks/useSections";

/* ------------------------------------------------------------------ */
/* Shared config — kept identical to the student-facing view so a post */
/* here renders exactly the way students will see it.                  */
/* ------------------------------------------------------------------ */

const categoryConfig = {
  Urgent: {
    icon: AlertTriangle,
    text: "text-orange-700",
    bg: "bg-orange-50",
    ring: "ring-orange-200",
  },
  Event: {
    icon: PartyPopper,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
  },
  Schedule: {
    icon: CalendarClock,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
  },
  General: {
    icon: Info,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
  },
};

const categoryOptions = Object.keys(categoryConfig);

function emptyForm() {
  return {
    category: "General",
    title: "",
    body: "",
    section: "",
    pinned: false,
  };
}

function formFromAnnouncement(a) {
  return {
    category: a.category,
    title: a.title,
    body: a.body,
    section: a.section || "",
    pinned: a.pinned,
  };
}

const initials = (name) =>
  (name || "?")
    .replace(/^(Mr\.|Ms\.|Mrs\.)\s*/, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/* ------------------------------------------------------------------ */
/* Post / Edit form                                                     */
/* ------------------------------------------------------------------ */

function AnnouncementForm({ editing, onDone, isAdmin, sectionOptions }) {
  const [form, setForm] = useState(() =>
    editing ? formFromAnnouncement(editing) : emptyForm(),
  );
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    setForm(editing ? formFromAnnouncement(editing) : emptyForm());
    setErrors({});
  }, [editing]);

  const handleChange = (field) => (e) => {
    const value = field === "pinned" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.category) next.category = "Please choose a category.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.body.trim()) next.body = "Write something for your students.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const payload = {
      requesterId: getCurrentUser()?.id,
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      pinned: form.pinned,
      // Only sent for admin — the backend ignores this entirely for a
      // teacher and forces their own section instead.
      ...(isAdmin ? { section: form.section } : {}),
    };
    try {
      if (editing) {
        await updateAnnouncement(editing.id, payload);
        showToast(form.title.trim(), {
          type: "success",
          title: "Announcement updated",
        });
      } else {
        await createAnnouncement(payload);
        showToast(form.title.trim(), {
          type: "success",
          title: "Posted successfully",
        });
        setForm(emptyForm());
      }
      onDone?.();
    } catch (err) {
      showToast(err.message || "Failed to post announcement, try again.", {
        type: "error",
        title: "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categoryConfig[form.category];
  const hasPreview = form.title || form.body;
  const previewSection = isAdmin
    ? form.section || "All Sections"
    : getCurrentUser()?.section;
  const authorName = getCurrentUser()?.name;

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={`p-5 sm:p-6 lg:col-span-3 ${GLASS_SOLID}`}
        >
          {editing && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              Editing an existing post
              <button
                type="button"
                onClick={() => onDone?.()}
                className="font-semibold text-slate-600 hover:text-rose-600"
              >
                Cancel edit
              </button>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Category
            </label>
            <p className="mt-0.5 text-xs text-slate-400">
              This determines the badge color and icon students will see
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {categoryOptions.map((cat) => {
                const cfg = categoryConfig[cat];
                const CatIcon = cfg.icon;
                const isSelected = form.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, category: cat }))
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                      isSelected
                        ? `border-current ${cfg.bg} ${cfg.text} ring-1 ring-current`
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <CatIcon size={17} />
                    <span className="text-xs font-semibold">{cat}</span>
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
              Title
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={handleChange("title")}
              placeholder="e.g. Weekly Report Submission Moved to Fridays"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.title
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.title && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.title}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="mt-5">
            <label
              htmlFor="body"
              className="text-sm font-semibold text-slate-700"
            >
              Message
            </label>
            <textarea
              id="body"
              rows={4}
              value={form.body}
              onChange={handleChange("body")}
              placeholder="Write the announcement students will read..."
              className={`mt-1.5 w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.body
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.body && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.body}
              </p>
            )}
          </div>

          {/* Section — admin only. A teacher never sees this at all; the
              backend forces their own users.section regardless. */}
          {isAdmin && (
            <div className="mt-5">
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
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                >
                  <option value="">All Sections</option>
                  {sectionOptions.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Pin toggle */}
          <div className="mt-5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Pin size={15} className="text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Pin to top of feed
                </p>
                <p className="text-xs text-slate-400">
                  Pinned posts always show first
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.pinned}
              onClick={() =>
                setForm((prev) => ({ ...prev, pinned: !prev.pinned }))
              }
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${form.pinned ? "bg-green-700" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 left-0.5 rounded-full bg-white shadow transition-transform ${
                  form.pinned ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => {
                setForm(editing ? formFromAnnouncement(editing) : emptyForm());
                setErrors({});
                if (editing) onDone?.();
              }}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editing ? "Cancel" : "Clear"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send size={14} />
              {isSubmitting
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Post Announcement"}
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
                <Megaphone size={22} className="text-slate-300" />
                <p className="text-xs text-slate-400">
                  Start filling out the form to see how this post will appear in
                  students' feed.
                </p>
              </div>
            ) : (
              <div className={`mt-3 overflow-hidden ${GLASS}`}>
                <div className="flex items-start gap-3 p-4 pb-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
                    {initials(authorName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900">
                        {authorName}
                      </span>
                      {form.pinned && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                          <Pin size={11} />
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{previewSection}</p>
                  </div>
                  {selectedCategory && (
                    <span
                      className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${selectedCategory.bg} ${selectedCategory.text} ${selectedCategory.ring}`}
                    >
                      {form.category}
                    </span>
                  )}
                </div>
                <div className="px-4 pb-4 pt-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    {form.title || "Untitled announcement"}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {form.body || "Your message will appear here."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manage Announcements                                                 */
/* ------------------------------------------------------------------ */

function ManageAnnouncements({
  announcements,
  loading,
  loadError,
  isAdmin,
  onEdit,
  onChanged,
}) {
  const [query, setQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const { toasts, showToast, dismissToast } = useToast();

  const filtered = announcements.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()),
  );

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await deleteAnnouncement(id, getCurrentUser()?.id);
      setConfirmDeleteId(null);
      onChanged?.();
    } catch (err) {
      showToast(err.message || "Failed to delete announcement.", {
        type: "error",
        title: "Something went wrong",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePin(a) {
    setPinningId(a.id);
    try {
      await updateAnnouncement(a.id, {
        requesterId: getCurrentUser()?.id,
        title: a.title,
        body: a.body,
        category: a.category,
        pinned: !a.pinned,
        ...(isAdmin ? { section: a.section || "" } : {}),
      });
      onChanged?.();
    } catch (err) {
      showToast(err.message || "Failed to update pin.", {
        type: "error",
        title: "Something went wrong",
      });
    } finally {
      setPinningId(null);
    }
  }

  if (loading) {
    return (
      <div className={`py-14 text-center ${GLASS_SUBTLE}`}>
        <ClipboardList size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Loading announcements…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
        <AlertCircle size={16} />
        Couldn't load announcements: {loadError}
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
          placeholder="Search announcements..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((a) => {
          const cfg = categoryConfig[a.category];
          const CatIcon = cfg.icon;
          return (
            <div
              key={a.id}
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 ${GLASS}`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.text}`}
              >
                <CatIcon size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                  {a.title}
                  {a.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700 ring-1 ring-green-200">
                      <Pin size={9} />
                      Pinned
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                  <span>{a.category}</span>
                  <span>·</span>
                  <span>{formatPhDateTime(a.createdAt)}</span>
                  <span>·</span>
                  <span>{a.section || "All Sections"}</span>
                </p>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTogglePin(a)}
                  disabled={pinningId === a.id}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    a.pinned
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : "border-slate-200 text-slate-500 hover:border-green-400 hover:text-green-700"
                  }`}
                >
                  <Pin size={12} />
                  {a.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(a)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
                >
                  <Pencil size={12} />
                  Edit
                </button>

                {confirmDeleteId === a.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-rose-600">Delete?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === a.id ? "Deleting…" : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deletingId === a.id}
                      className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-rose-300 hover:text-rose-600"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className={`py-14 text-center ${GLASS_SUBTLE}`}>
            <Megaphone size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              No announcements found
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
/* Root — shared by adminNav.js and teacherNav.js. Which role is        */
/* logged in decides everything: whether the Section picker shows up,   */
/* and (server-side) which announcements this account can even see.     */
/* ------------------------------------------------------------------ */

const tabs = [
  { key: "post", label: "Post Announcement", icon: FilePlus2 },
  { key: "manage", label: "Manage Announcements", icon: ClipboardList },
];

export default function PostAnnouncement() {
  const { sections: sectionOptions } = useSections();
  const [activeTab, setActiveTab] = useState("post");
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);

  const isAdmin = getCurrentUser()?.role === "admin";

  const loadAnnouncements = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchAnnouncements(getCurrentUser()?.id)
      .then((data) => setAnnouncements(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const overview = useMemo(() => {
    const total = announcements.length;
    const pinnedCount = announcements.filter((a) => a.pinned).length;
    return { total, pinnedCount };
  }, [announcements]);

  function handleEdit(announcement) {
    setEditing(announcement);
    setActiveTab("post");
  }

  function handleFormDone() {
    setEditing(null);
    setActiveTab("manage");
    loadAnnouncements();
  }

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Announcements</h3>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "Post updates for any section (or everyone) and manage what's currently live"
            : "Post updates for your section and manage what's currently live"}
        </p>
      </div>

      {/* Overview stat strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Megaphone size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.total}
            </p>
            <p className="truncate text-xs text-slate-500">
              Live announcements
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-3 px-4 py-3.5 ${GLASS}`}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Pin size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {overview.pinnedCount}
            </p>
            <p className="truncate text-xs text-slate-500">Pinned to top</p>
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
        {activeTab === "post" ? (
          <AnnouncementForm
            editing={editing}
            onDone={handleFormDone}
            isAdmin={isAdmin}
            sectionOptions={sectionOptions}
          />
        ) : (
          <ManageAnnouncements
            announcements={announcements}
            loading={loading}
            loadError={loadError}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onChanged={loadAnnouncements}
          />
        )}
      </div>
    </section>
  );
}
