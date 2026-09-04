import React, { useCallback, useEffect, useState } from "react";
import { Plus, LayoutGrid, AlertCircle, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { fetchSections, createSection, renameSection, deleteSection } from "../../api/sections";
import { getCurrentUser } from "../../api/auth";
import { GLASS, GLASS_SOLID, GLASS_SUBTLE } from "../../components/shared/GlassCard";

// Admin-only. Every Section <select> in the app (Manage Students, Manage
// Teachers, the assignment Section picker, the announcement Section
// picker) reads from this same table via useSections() — add one here
// and it shows up everywhere else automatically, no code change needed.
export default function ManageSections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const loadSections = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchSections()
      .then((data) => setSections(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createSection(name.trim(), getCurrentUser()?.id);
      setName("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
      loadSections();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (section) => {
    setEditingId(section.id);
    setEditName(section.name);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await renameSection(id, editName.trim(), getCurrentUser()?.id);
      setEditingId(null);
      loadSections();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (section) => {
    const confirmed = window.confirm(`Delete "${section.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(section.id);
    setDeleteError(null);
    try {
      await deleteSection(section.id, getCurrentUser()?.id);
      loadSections();
    } catch (err) {
      // The backend blocks this (409) with a clear message when students
      // or teachers are still assigned — surfaced here as-is rather than
      // silently failing, so the admin knows to reassign them first.
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Manage Sections</h3>
        <p className="text-sm text-slate-500">
          These are the sections every Section dropdown in the app pulls from
        </p>
      </div>

      {submitted && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Section added.
        </div>
      )}
      {submitError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      <form onSubmit={handleCreate} className={`mt-4 flex items-end gap-3 p-5 sm:p-6 ${GLASS_SOLID}`}>
        <div className="flex-1">
          <label htmlFor="sectionName" className="text-sm font-semibold text-slate-700">
            New section name
          </label>
          <input
            id="sectionName"
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Section E"
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus size={15} />
          {isSubmitting ? "Adding…" : "Add Section"}
        </button>
      </form>

      {deleteError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          {deleteError}
        </div>
      )}

      <div className="mt-6">
        <h4 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
          <LayoutGrid size={14} />
          Existing Sections
        </h4>

        {loading ? (
          <div className={`mt-3 py-10 text-center ${GLASS_SUBTLE}`}>
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        ) : loadError ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            <AlertCircle size={16} />
            Couldn't load sections: {loadError}
          </div>
        ) : sections.length === 0 ? (
          <div className={`mt-3 py-10 text-center ${GLASS_SUBTLE}`}>
            <p className="text-sm text-slate-400">No sections yet</p>
          </div>
        ) : (
          <div className={`mt-3 overflow-hidden ${GLASS}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/40 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 sm:px-5">Name</th>
                    <th className="px-4 py-2.5 sm:px-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {sections.map((s) =>
                    editingId === s.id ? (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5 sm:px-5">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(s.id)}
                              disabled={editSubmitting}
                              className="rounded-md bg-green-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {editSubmitting ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={editSubmitting}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                          {editError && (
                            <p className="mt-1 text-xs font-medium text-rose-600">{editError}</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-800 sm:px-5">{s.name}</td>
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center gap-2 sm:gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(s)}
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-green-700 sm:h-8 sm:w-8"
                              aria-label={`Rename ${s.name}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              disabled={deletingId === s.id}
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
                              aria-label={`Delete ${s.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
