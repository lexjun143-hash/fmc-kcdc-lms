import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { createUser, fetchUsers, fetchUserById, updateUser, deleteUser } from "../../api/users";
import { getCurrentUser } from "../../api/auth";
import { GLASS_SOLID, GLASS_SUBTLE } from "../../components/shared/GlassCard";
import AccountTable from "../../components/shared/AccountTable";

const initialForm = { name: "", participantId: "", password: "" };
const initialEditForm = { name: "", password: "" };

// Two-tier admin system: only a primary admin (users.can_create_admin =
// true, set only by a DB migration — see database/011_add_can_create_
// admin.sql — never by any endpoint) can reach this page's create form.
// Every admin this form creates is hardcoded server-side to
// can_create_admin = false (userController.createUser); they get every
// other admin capability (manage students/teachers/sections/assignments/
// letters/gifts/announcements, delete, etc. — same nav, same pages,
// nothing gated on tier anywhere else), just never this one form
// themselves. The backend enforces this regardless of what the client
// sends (see createUser's own check) — hiding the form here is a
// courtesy, not the actual security boundary.
export default function ManageAdmins() {
  const cachedUser = getCurrentUser();
  const [canCreateAdmin, setCanCreateAdmin] = useState(cachedUser?.canCreateAdmin ?? false);

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Seeded from the cached login response so there's no flash of the
  // create form before flipping to the "not permitted" notice (or vice
  // versa) — then replaced with the DB's current value, since tier is
  // never editable in the UI but could still differ from a stale cache.
  useEffect(() => {
    if (!cachedUser?.id) return;
    let cancelled = false;
    fetchUserById(cachedUser.id)
      .then((user) => {
        if (!cancelled) setCanCreateAdmin(!!user.canCreateAdmin);
      })
      .catch(() => {
        // Keep whatever the cached login response already had.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAdmins = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchUsers("admin")
      .then((data) => setAdmins(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.participantId.trim()) next.participantId = "Participant ID is required.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 6) next.password = "Must be at least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createUser({
        requesterId: getCurrentUser()?.id,
        participantId: form.participantId.trim(),
        name: form.name.trim(),
        password: form.password,
        role: "admin",
      });
      setSubmitted(true);
      setForm(initialForm);
      setTimeout(() => setSubmitted(false), 3000);
      loadAdmins();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (admin) => {
    setEditingId(admin.id);
    setEditForm({ name: admin.name, password: "" });
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEditFieldChange = (field) => (e) => {
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const saveEdit = async (participantId) => {
    setEditSubmitting(true);
    setEditError(null);
    try {
      // No `section` field at all — admins aren't section-scoped, so
      // there's nothing here for updateUser's admin-only section
      // reassignment to apply.
      await updateUser(participantId, {
        requesterId: getCurrentUser()?.id,
        name: editForm.name.trim(),
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      setEditingId(null);
      loadAdmins();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (admin) => {
    const confirmed = window.confirm(
      `Delete ${admin.name}'s account (${admin.participantId})? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(admin.id);
    setDeleteError(null);
    try {
      await deleteUser(admin.participantId, getCurrentUser()?.id);
      loadAdmins();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Manage Admins</h3>
        <p className="text-sm text-slate-500">Create and view admin accounts</p>
      </div>

      {submitted && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Admin account created.
        </div>
      )}
      {submitError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      {canCreateAdmin ? (
        <form onSubmit={handleSubmit} className={`mt-4 p-5 sm:p-6 ${GLASS_SOLID}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="text-sm font-semibold text-slate-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="off"
                value={form.name}
                onChange={handleChange("name")}
                placeholder="e.g. Maria Lopez"
                className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.name
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
              {errors.name && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="participantId" className="text-sm font-semibold text-slate-700">
                Participant ID (username)
              </label>
              <input
                id="participantId"
                type="text"
                autoComplete="off"
                value={form.participantId}
                onChange={handleChange("participantId")}
                placeholder="e.g. PH626-00006"
                className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.participantId
                    ? "border-rose-300 focus:ring-rose-100"
                    : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                }`}
              />
              {errors.participantId && (
                <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.participantId}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange("password")}
                  placeholder="Temporary password"
                  className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    errors.password
                      ? "border-rose-300 focus:ring-rose-100"
                      : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.password}</p>}
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
            <ShieldAlert size={13} className="mt-0.5 flex-shrink-0" />
            This new admin will get every admin feature except creating more admin accounts.
          </p>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/40 pt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <ShieldCheck size={15} />
              {isSubmitting ? "Creating…" : "Create Admin Account"}
            </button>
          </div>
        </form>
      ) : (
        <div className={`mt-4 flex items-start gap-3 p-5 sm:p-6 ${GLASS_SUBTLE}`}>
          <Lock size={18} className="mt-0.5 flex-shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-600">You can't create admin accounts</p>
            <p className="mt-1 text-xs text-slate-400">
              Only the primary admin can create new admin accounts. You still have every other
              admin feature — managing students, teachers, sections, assignments, letters, gifts,
              and announcements.
            </p>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          Couldn't delete account: {deleteError}
        </div>
      )}

      <AccountTable
        icon={ShieldCheck}
        title="Existing Admins"
        rows={admins}
        sections={[]}
        showSection={false}
        loading={loading}
        loadError={loadError}
        loadErrorLabel="admins"
        emptyText="No admin accounts yet"
        editingId={editingId}
        editForm={editForm}
        editSubmitting={editSubmitting}
        editError={editError}
        deletingId={deletingId}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onEditFieldChange={handleEditFieldChange}
        onSaveEdit={saveEdit}
        onDelete={handleDelete}
        isRowProtected={(row) => row.canCreateAdmin}
        protectedReason="The primary admin account can't be deleted"
      />
    </section>
  );
}
