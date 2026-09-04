import React, { useEffect, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { getCurrentUser, updateCurrentUser } from "../../api/auth";
import { fetchUserById, updateUser } from "../../api/users";

export default function MyAccount() {
  const cachedUser = getCurrentUser();
  const [name, setName] = useState(cachedUser?.name ?? "");
  // Seeded from the cached login response so there's no flash of blank
  // while the fresh fetch below is in flight — the cache can go stale the
  // moment an admin reassigns this teacher's section elsewhere.
  const [section, setSection] = useState(cachedUser?.section ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!cachedUser?.id) return;
    let cancelled = false;
    fetchUserById(cachedUser.id)
      .then((user) => {
        if (!cancelled) {
          setName(user.name);
          setSection(user.section);
        }
      })
      .catch(() => {
        // Keep whatever the cached login response already had.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startEdit = () => {
    setDraftName(name);
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!draftName.trim()) {
      setSaveError("Name is required.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      // participant_id is never sent here — it's read-only, shown below
      // as plain text, never part of this editable form. section is also
      // intentionally omitted: it's admin-assigned (which section this
      // teacher publishes assignments to) and must not be touched by a
      // self-edit.
      const updated = await updateUser(cachedUser?.participantId, {
        requesterId: cachedUser?.id,
        name: draftName.trim(),
      });
      setName(updated.name);
      updateCurrentUser({ ...cachedUser, ...updated });
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 px-4 sm:px-6">
      <br />
      <section className="rounded-lg bg-white p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <div className="h-4 w-1 rounded bg-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Personal Information
            </h3>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-green-200 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Save changes"
              >
                <Check size={14} />
              </button>
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-green-700"
              aria-label="Edit personal information"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {saveError && (
          <p className="mb-2 text-xs font-medium text-rose-600">{saveError}</p>
        )}

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs text-slate-500">Full Name:</p>
              {isEditing ? (
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              ) : (
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {name}
                </p>
              )}
            </div>
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs text-slate-500">Birth Date:</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                09-23-2003
              </p>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs text-slate-500">Home Address:</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                Purok 8, Maygatasan, Bayugan City
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs text-slate-500">Employee ID:</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {cachedUser?.participantId}
              </p>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs text-slate-500">Department:</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                OJT Training
              </p>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <p className="text-xs text-slate-500">Section Handled:</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {section || "Not yet assigned"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
