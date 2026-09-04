import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, GraduationCap, CheckCircle2, AlertCircle, ChevronDown, Eye, EyeOff } from "lucide-react";
import { createUser, fetchUsers, updateUser, deleteUser } from "../../api/users";
import { getCurrentUser } from "../../api/auth";
import { GLASS_SOLID } from "../../components/shared/GlassCard";
import AccountTable from "../../components/shared/AccountTable";
import { useSections } from "../../hooks/useSections";

const initialForm = {
  name: "",
  participantId: "",
  password: "",
  section: "",
};

const initialEditForm = { name: "", section: "", password: "" };

// Admin-only. Teacher accounts get their own create/edit/delete flow
// (rather than reusing Manage Students) because a teacher's Section isn't
// just a label — createAssignment looks it up server-side and stamps
// every assignment that teacher publishes with it, so they never pick a
// section themselves when posting. Delete semantics also genuinely
// differ: deleting a teacher nulls out the teacher reference on their
// assignments instead of deleting the assignments, so no student's
// submission/work is ever lost just because staff turnover happened.
export default function ManageTeachers() {
  const { sections } = useSections();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const loadTeachers = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchUsers("teacher")
      .then((data) => setTeachers(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

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
    if (!form.section) next.section = "Please choose a section.";
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
        role: "teacher",
        section: form.section,
      });
      setSubmitted(true);
      setForm(initialForm);
      setTimeout(() => setSubmitted(false), 3000);
      loadTeachers();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (teacher) => {
    setEditingId(teacher.id);
    setEditForm({ name: teacher.name, section: teacher.section || "", password: "" });
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
      await updateUser(participantId, {
        requesterId: getCurrentUser()?.id,
        name: editForm.name.trim(),
        section: editForm.section,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      setEditingId(null);
      loadTeachers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (teacher) => {
    const confirmed = window.confirm(
      `Delete ${teacher.name}'s account (${teacher.participantId})? Their past assignments and ` +
        `students' submissions will be kept, just no longer attributed to them. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(teacher.id);
    setDeleteError(null);
    try {
      await deleteUser(teacher.participantId, getCurrentUser()?.id);
      loadTeachers();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Manage Teachers</h3>
        <p className="text-sm text-slate-500">Create and view teacher accounts</p>
      </div>

      {submitted && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Teacher account created.
        </div>
      )}
      {submitError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

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
              placeholder="e.g. Grace Villareal"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.name
                  ? "border-rose-300 focus:ring-rose-100"
                  : "border-slate-200 focus:border-green-500 focus:ring-green-100"
              }`}
            />
            {errors.name && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="section" className="text-sm font-semibold text-slate-700">
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
                {sections.map((sec) => (
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
            <p className="mt-1.5 text-xs text-slate-400">
              The one section this teacher handles — their assignments auto-use it, they never
              pick a section when posting.
            </p>
            {errors.section && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.section}</p>
            )}
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
              placeholder="e.g. PH626-00005"
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

          <div>
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
            {errors.password && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.password}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/40 pt-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <UserPlus size={15} />
            {isSubmitting ? "Creating…" : "Create Teacher Account"}
          </button>
        </div>
      </form>

      {deleteError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          Couldn't delete account: {deleteError}
        </div>
      )}

      <AccountTable
        icon={GraduationCap}
        title="Existing Teachers"
        rows={teachers}
        sections={sections}
        loading={loading}
        loadError={loadError}
        loadErrorLabel="teachers"
        emptyText="No teacher accounts yet"
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
      />
    </section>
  );
}
