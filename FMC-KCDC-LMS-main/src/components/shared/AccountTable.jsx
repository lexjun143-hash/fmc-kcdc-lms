import React from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { GLASS, GLASS_SUBTLE } from "./GlassCard";

// Shared by Manage Students and Manage Teachers — same columns, same
// inline edit (name, section, optional password reset), same delete-with-
// confirm. Which account this row is (student vs teacher) never matters
// here: the backend endpoints are keyed by participant_id and work the
// same way regardless of role.
export default function AccountTable({
  icon: Icon,
  title,
  rows,
  sections,
  loading,
  loadError,
  loadErrorLabel,
  emptyText,
  editingId,
  editForm,
  editSubmitting,
  editError,
  deletingId,
  onStartEdit,
  onCancelEdit,
  onEditFieldChange,
  onSaveEdit,
  onDelete,
  onRowClick,
  canPickSection = true,
  showSection = true,
  // Predicate, not a fixed id list — e.g. Manage Admins passes
  // `(row) => row.canCreateAdmin` to keep the primary admin's delete
  // button disabled without the caller having to track which row that is
  // itself. Purely a UX affordance (grayed-out button, explanatory
  // title); the backend's own deleteUser rejects it unconditionally
  // regardless of what this renders.
  isRowProtected = () => false,
  protectedReason = "This account can't be deleted",
  hasMissingDetails = () => false,
}) {
  return (
    <div className="mt-6">
      {title && (
        <h4 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Icon size={14} />
          {title}
        </h4>
      )}

      {loading ? (
        <div className={`mt-3 py-10 text-center ${GLASS_SUBTLE}`}>
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      ) : loadError ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          Couldn't load {loadErrorLabel}: {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className={`mt-3 py-10 text-center ${GLASS_SUBTLE}`}>
          <p className="text-sm text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className={`mt-3 overflow-hidden ${GLASS}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/40 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 sm:px-5">Participant ID</th>
                  <th className="px-4 py-2.5 sm:px-5">Name</th>
                  {showSection && (
                    <th className="px-4 py-2.5 sm:px-5">Section</th>
                  )}
                  <th className="px-4 py-2.5 sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {rows.map((s) =>
                  editingId === s.id ? (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600 sm:px-5">
                        {s.participantId}
                      </td>
                      <td className="px-4 py-2.5 sm:px-5">
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={onEditFieldChange("name")}
                            placeholder="Full name"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={onEditFieldChange("password")}
                            placeholder="New password (optional)"
                            autoComplete="new-password"
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                      </td>
                      {showSection && (
                        <td className="px-4 py-2.5 sm:px-5">
                          {canPickSection ? (
                            <select
                              value={editForm.section}
                              onChange={onEditFieldChange("section")}
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="">No section</option>
                              {sections.map((sec) => (
                                <option key={sec} value={sec}>
                                  {sec}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-500">
                              {s.section || "—"}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5 sm:px-5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveEdit(s.participantId)}
                            disabled={editSubmitting}
                            className="min-h-10 rounded-md bg-green-700 px-2.5 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-8"
                          >
                            {editSubmitting ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEdit}
                            disabled={editSubmitting}
                            className="min-h-10 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:min-h-8"
                          >
                            Cancel
                          </button>
                        </div>
                        {editError && (
                          <p className="mt-1 text-xs font-medium text-rose-600">
                            {editError}
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={s.id}
                      onClick={() => onRowClick?.(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick?.(s);
                        }
                      }}
                      tabIndex={onRowClick ? 0 : undefined}
                      className={
                        hasMissingDetails(s)
                          ? "bg-rose-50/50 hover:bg-rose-100/50"
                          : onRowClick
                            ? "cursor-pointer transition-colors hover:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 dark:hover:bg-slate-800/50"
                            : undefined
                      }
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600 sm:px-5">
                        {s.participantId}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 sm:px-5">
                        <div className="flex items-center gap-2">
                          {s.name}
                          {hasMissingDetails(s) && (
                            <AlertCircle
                              size={14}
                              className="flex-shrink-0 text-rose-600"
                              title="Missing profile details"
                            />
                          )}
                        </div>
                      </td>
                      {showSection && (
                        <td className="px-4 py-2.5 text-slate-500 sm:px-5">
                          {s.section || "—"}
                        </td>
                      )}
                      <td className="px-4 py-2.5 sm:px-5">
                        {/* h-10/w-10 (40px) meets a comfortable touch
                            target on phones/tablets; sm:h-8/w-8 tightens
                            back up once a mouse pointer is the more likely
                            input and row density starts to matter more. */}
                        <div
                          className="flex items-center gap-2 sm:gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onStartEdit(s)}
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-green-700 sm:h-8 sm:w-8"
                            aria-label={`Edit ${s.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(s)}
                            disabled={deletingId === s.id || isRowProtected(s)}
                            title={
                              isRowProtected(s) ? protectedReason : undefined
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
                            aria-label={
                              isRowProtected(s)
                                ? `${s.name} cannot be deleted`
                                : `Delete ${s.name}`
                            }
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
  );
}
