import React, { useCallback, useEffect, useState } from "react";
import {
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import {
  createUser,
  fetchUsers,
  updateUser,
  deleteUser,
  fetchUserByParticipantId,
} from "../../api/users";
import { getCurrentUser } from "../../api/auth";
import { GLASS_SOLID } from "../../components/shared/GlassCard";
import AccountTable from "../../components/shared/AccountTable";
import StudentDetailModal from "../../components/shared/StudentDetailModal";
import { useSections } from "../../hooks/useSections";
import { computeAge } from "../../utils/age";

const initialForm = {
  participantId: "",
  lastName: "",
  firstName: "",
  middleName: "",
  age: "",
  birthdate: "",
  school: "",
  gradeLevel: "",
  homeAddress: "",
  height: "",
  weight: "",
  section: "",
  sponsorName: "",
  sponsorCountry: "",
  sponsorSince: "",
  password: "",
};

const initialEditForm = { name: "", section: "", password: "" };

const FIELD =
  "mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2";
const FIELD_OK = "border-slate-200 focus:border-green-500 focus:ring-green-100";
const FIELD_ERR = "border-rose-300 focus:ring-rose-100";

// Reused by both teacherNav.js and adminNav.js — same page, same
// component instance, same as how ManageAssignment.jsx is already shared
// between the two roles. Students only — teacher accounts have their own
// dedicated page, Manage Teachers (src/pages/admin/ManageTeachers.jsx),
// since their create-flow and delete semantics (nulling out an
// assignment's teacher reference instead of deleting it) genuinely differ
// from a student's.
export default function ManageStudents() {
  const { sections } = useSections();
  const currentUser = getCurrentUser();
  const requesterId = currentUser?.id;
  // Teachers only ever act within their own section — the backend forces
  // it server-side (never trusts a section the client sends), so the
  // picker is hidden here too rather than showing a control that would
  // silently have no effect.
  const isAdmin = currentUser?.role === "admin";

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const [detailParticipantId, setDetailParticipantId] = useState(null);
  const [studentDetails, setStudentDetails] = useState({}); // Cache full details

  // Check if student has missing important details
  const hasMissingDetails = (student) => {
    const details = studentDetails[student.participantId];
    if (!details) return false; // Not loaded yet
    const requiredFields = [
      "gradeLevel",
      "school",
      "height",
      "weight",
      "homeAddress",
    ];
    return requiredFields.some(
      (field) => !details[field] || details[field].toString().trim() === "",
    );
  };

  const loadStudents = useCallback((search) => {
    setLoading(true);
    setLoadError(null);
    // Scoped server-side: a teacher only ever gets back their own
    // section's roster, an admin gets everyone — see getUsers. `search`
    // (name parts or participant ID) is applied server-side on top of
    // that same scope, not instead of it.
    fetchUsers("student", requesterId, search)
      .then((data) => setStudents(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search-as-you-type — re-queries the server rather than
  // filtering the already-fetched page, so it scales as students grow.
  useEffect(() => {
    const handle = setTimeout(() => loadStudents(query), 300);
    return () => clearTimeout(handle);
  }, [query, loadStudents]);

  // Fetch full details for each student to check for missing profile info
  useEffect(() => {
    if (!students.length || !requesterId) return;
    const fetchDetails = async () => {
      const details = {};
      for (const student of students) {
        try {
          const fullDetail = await fetchUserByParticipantId(
            student.participantId,
            requesterId,
          );
          details[student.participantId] = fullDetail;
        } catch (err) {
          // Silently fail for individual students
        }
      }
      setStudentDetails(details);
    };
    fetchDetails();
  }, [students, requesterId]);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleBirthdateChange = (e) => {
    const birthdate = e.target.value;
    setForm((prev) => ({
      ...prev,
      birthdate,
      age: birthdate ? String(computeAge(birthdate) ?? "") : "",
    }));
    if (errors.birthdate) {
      setErrors((prev) => ({ ...prev, birthdate: undefined }));
    }
  };

  const validate = () => {
    const next = {};
    if (!form.participantId.trim())
      next.participantId = "Participant ID is required.";
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 6)
      next.password = "Must be at least 6 characters.";
    if (!form.homeAddress.trim())
      next.homeAddress = "Home Address is required.";
    if (isAdmin && !form.section) next.section = "Please choose a section.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const formatMeasurement = (field, value) => {
    if (!value) return "";
    const numeric = value
      .replace(
        new RegExp(`${field === "height" ? "cm|kg" : "kg|cm"}`, "gi"),
        "",
      )
      .replace(/[^0-9.]/g, "")
      .trim();

    if (!numeric) return "";
    return `${numeric} ${field === "height" ? "cm" : "kg"}`;
  };

  const handleMeasurementChange = (field) => (e) => {
    const value = e.target.value;
    const formatted = formatMeasurement(field, value);

    setForm((prev) => ({ ...prev, [field]: formatted }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createUser({
        requesterId,
        participantId: form.participantId.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        age: form.age === "" ? null : Number(form.age),
        birthdate: form.birthdate || null,
        school: form.school.trim(),
        gradeLevel: form.gradeLevel.trim(),
        homeAddress: form.homeAddress.trim(),
        height: form.height.trim(),
        weight: form.weight.trim(),
        sponsorName: form.sponsorName.trim(),
        sponsorCountry: form.sponsorCountry.trim(),
        sponsorSince: form.sponsorSince || null,
        password: form.password,
        role: "student",
        // Teachers never send a section — the backend forces new students
        // into the teacher's own section regardless of what's sent.
        ...(isAdmin ? { section: form.section } : {}),
      });
      setSubmitted(true);
      setForm(initialForm);
      setTimeout(() => setSubmitted(false), 3000);
      loadStudents(query);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // The table's own inline edit stays a quick name/section/password
  // shortcut, unchanged — full editing of every field below lives in the
  // detail modal (click the student's name) since the table row is too
  // narrow for ten more fields.
  const startEdit = (student) => {
    setEditingId(student.id);
    setEditForm({
      name: student.name,
      section: student.section || "",
      password: "",
    });
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
        requesterId,
        name: editForm.name.trim(),
        section: editForm.section,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      setEditingId(null);
      loadStudents(query);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (student) => {
    const confirmed = window.confirm(
      `Delete ${student.name}'s account (${student.participantId})? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(student.id);
    setDeleteError(null);
    try {
      await deleteUser(student.participantId, requesterId);
      loadStudents(query);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Manage Participants
        </h3>
        <p className="text-sm text-slate-500">
          Create login accounts for participants and see who's already
          registered
        </p>
      </div>

      {submitted && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Participant account created.
        </div>
      )}
      {submitError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`mt-4 p-5 sm:p-6 ${GLASS_SOLID}`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="participantId"
              className="text-sm font-semibold text-slate-700"
            >
              Participant ID (username)
            </label>
            <input
              id="participantId"
              type="text"
              autoComplete="off"
              value={form.participantId}
              onChange={handleChange("participantId")}
              placeholder="e.g. PH626-00004"
              className={`${FIELD} ${errors.participantId ? FIELD_ERR : FIELD_OK}`}
            />
            {errors.participantId && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.participantId}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="text-sm font-semibold text-slate-700"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="off"
              value={form.lastName}
              onChange={handleChange("lastName")}
              placeholder="e.g. Santos"
              className={`${FIELD} ${errors.lastName ? FIELD_ERR : FIELD_OK}`}
            />
            {errors.lastName && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.lastName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="firstName"
              className="text-sm font-semibold text-slate-700"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="off"
              value={form.firstName}
              onChange={handleChange("firstName")}
              placeholder="e.g. Maria"
              className={`${FIELD} ${errors.firstName ? FIELD_ERR : FIELD_OK}`}
            />
            {errors.firstName && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.firstName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="middleName"
              className="text-sm font-semibold text-slate-700"
            >
              Middle Name
            </label>
            <input
              id="middleName"
              type="text"
              autoComplete="off"
              value={form.middleName}
              onChange={handleChange("middleName")}
              placeholder="e.g. Cruz"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="birthdate"
              className="text-sm font-semibold text-slate-700"
            >
              Birthdate
            </label>
            <input
              id="birthdate"
              type="date"
              value={form.birthdate}
              onChange={handleBirthdateChange}
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="age"
              className="text-sm font-semibold text-slate-700"
            >
              Age
            </label>
            <input
              id="age"
              type="number"
              min="0"
              value={form.age}
              onChange={handleChange("age")}
              placeholder="Automatically computed from birthdate"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          {isAdmin ? (
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
                    errors.section ? FIELD_ERR : FIELD_OK
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
              {errors.section && (
                <p className="mt-1.5 text-xs font-medium text-rose-600">
                  {errors.section}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Section
              </label>
              <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                {currentUser?.section || "—"} (your section)
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="gradeLevel"
              className="text-sm font-semibold text-slate-700"
            >
              Grade Level
            </label>
            <input
              id="gradeLevel"
              type="text"
              autoComplete="off"
              value={form.gradeLevel}
              onChange={handleChange("gradeLevel")}
              placeholder="e.g. Kinder 1"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="school"
              className="text-sm font-semibold text-slate-700"
            >
              School
            </label>
            <input
              id="school"
              type="text"
              autoComplete="off"
              value={form.school}
              onChange={handleChange("school")}
              placeholder="e.g. Bayugan National Comprehensive High School"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="height"
              className="text-sm font-semibold text-slate-700"
            >
              Height
            </label>
            <input
              id="height"
              type="text"
              autoComplete="off"
              value={form.height}
              onChange={handleMeasurementChange("height")}
              placeholder="e.g. 110 cm"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="weight"
              className="text-sm font-semibold text-slate-700"
            >
              Weight
            </label>
            <input
              id="weight"
              type="text"
              autoComplete="off"
              value={form.weight}
              onChange={handleMeasurementChange("weight")}
              placeholder="e.g. 18 kg"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-semibold text-slate-700"
            >
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
                  errors.password ? FIELD_ERR : FIELD_OK
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
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.password}
              </p>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label
              htmlFor="homeAddress"
              className="text-sm font-semibold text-slate-700"
            >
              Home Address
            </label>
            <input
              id="homeAddress"
              type="text"
              autoComplete="off"
              value={form.homeAddress}
              onChange={handleChange("homeAddress")}
              placeholder="e.g. Purok 1, Barangay San Isidro, Bayugan City, Agusan del Sur"
              className={`${FIELD} ${errors.homeAddress ? FIELD_ERR : FIELD_OK}`}
            />
            {errors.homeAddress && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.homeAddress}
              </p>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label
              htmlFor="sponsorName"
              className="text-sm font-semibold text-slate-700"
            >
              Sponsor Name
            </label>
            <input
              id="sponsorName"
              type="text"
              autoComplete="off"
              value={form.sponsorName}
              onChange={handleChange("sponsorName")}
              placeholder="e.g. Maria Santos"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="sponsorCountry"
              className="text-sm font-semibold text-slate-700"
            >
              Sponsor Country
            </label>
            <input
              id="sponsorCountry"
              type="text"
              autoComplete="off"
              value={form.sponsorCountry}
              onChange={handleChange("sponsorCountry")}
              placeholder="e.g. USA"
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>

          <div>
            <label
              htmlFor="sponsorSince"
              className="text-sm font-semibold text-slate-700"
            >
              Sponsor Since
            </label>
            <input
              id="sponsorSince"
              type="date"
              value={form.sponsorSince}
              onChange={handleChange("sponsorSince")}
              className={`${FIELD} ${FIELD_OK}`}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/40 pt-5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <UserPlus size={15} />
            {isSubmitting ? "Creating…" : "Create Participant Account"}
          </button>
        </div>
      </form>

      {deleteError && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} />
          Couldn't delete account: {deleteError}
        </div>
      )}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Users size={14} />
            Existing Participants
          </h4>
          <div className="relative w-full max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or Participant ID…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        <AccountTable
          icon={Users}
          title=""
          rows={students}
          sections={sections}
          loading={loading}
          loadError={loadError}
          loadErrorLabel="students"
          emptyText={
            query
              ? "No participants match that search"
              : "No participant accounts yet"
          }
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
          onRowClick={(student) =>
            setDetailParticipantId(student.participantId)
          }
          canPickSection={isAdmin}
          hasMissingDetails={hasMissingDetails}
        />
      </div>

      <StudentDetailModal
        participantId={detailParticipantId}
        requesterId={requesterId}
        sections={sections}
        canPickSection={isAdmin}
        onClose={() => setDetailParticipantId(null)}
        onChanged={() => loadStudents(query)}
      />
    </section>
  );
}
