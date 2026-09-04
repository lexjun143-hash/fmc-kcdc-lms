import React, { useEffect, useState } from "react";
import { X, Pencil, Trash2, AlertCircle } from "lucide-react";
import {
  fetchUserByParticipantId,
  updateUser,
  deleteUser,
} from "../../api/users";
import { computeAge } from "../../utils/age";

function emptyEditForm() {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
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
}

function editFormFromDetail(detail) {
  return {
    firstName: detail.firstName || "",
    middleName: detail.middleName || "",
    lastName: detail.lastName || "",
    age: detail.age ?? "",
    birthdate: detail.birthdate || "",
    school: detail.school || "",
    gradeLevel: detail.gradeLevel || "",
    homeAddress: detail.homeAddress || "",
    height: detail.height || "",
    weight: detail.weight || "",
    section: detail.section || "",
    sponsorName:
      detail.sponsorName ||
      detail.sponsor?.name ||
      [detail.sponsorFirstName, detail.sponsorLastName]
        .filter(Boolean)
        .join(" ") ||
      "",
    sponsorCountry: detail.sponsorCountry || detail.sponsor?.country || "",
    sponsorSince: detail.sponsorSince || detail.sponsor?.since || "",
    password: "",
  };
}

const FIELD =
  "mt-1.5 w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-body shadow-sm transition placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-subtle";

function formatMeasurement(field, value) {
  const numeric = value
    .replace(/cm|kg/gi, "")
    .replace(/[^0-9.]/g, "")
    .trim();
  return numeric ? `${numeric} ${field === "height" ? "cm" : "kg"}` : "";
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="mt-1.5 rounded-xl border border-line-soft bg-card-muted/70 px-3.5 py-3 text-sm font-medium text-ink-strong">
        {value || <span className="text-faint">—</span>}
      </p>
    </div>
  );
}

// Opened by clicking a student's name in Existing Students. Fetches the
// full row (fetchUserByParticipantId — everything getUsers' summary shape
// leaves out) and, in edit mode, doubles as the full-detail editor;
// delete lives here too so this one view covers "see everything" and
// "manage everything" for a single student.
export default function StudentDetailModal({
  participantId,
  requesterId,
  sections,
  canPickSection = true,
  onClose,
  onChanged,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (!participantId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchUserByParticipantId(participantId, requesterId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setEditForm(editFormFromDetail(data));
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
  }, [participantId, requesterId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!participantId) return null;

  const handleEditFieldChange = (field) => (e) => {
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleMeasurementChange = (field) => (e) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: formatMeasurement(field, e.target.value),
    }));
  };

  const startEdit = () => {
    setEditForm(editFormFromDetail(detail));
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setSaveError("First and last name are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateUser(participantId, {
        requesterId,
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim(),
        lastName: editForm.lastName.trim(),
        age: editForm.age === "" ? null : Number(editForm.age),
        birthdate: editForm.birthdate || null,
        school: editForm.school.trim(),
        gradeLevel: editForm.gradeLevel.trim(),
        homeAddress: editForm.homeAddress.trim(),
        height: editForm.height.trim(),
        weight: editForm.weight.trim(),
        section: editForm.section,
        sponsorName: editForm.sponsorName.trim(),
        sponsorCountry: editForm.sponsorCountry.trim(),
        sponsorSince: editForm.sponsorSince || null,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      const fresh = await fetchUserByParticipantId(participantId, requesterId);
      setDetail(fresh);
      setEditForm(editFormFromDetail(fresh));
      setIsEditing(false);
      onChanged?.();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete ${detail?.name}'s account (${participantId})? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUser(participantId, requesterId);
      onChanged?.();
      onClose();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const hasMissingDetails = () => {
    if (!detail) return false;
    const requiredFields = [
      "gradeLevel",
      "school",
      "height",
      "weight",
      "homeAddress",
    ];
    return requiredFields.some(
      (field) => !detail[field] || detail[field].toString().trim() === "",
    );
  };

  // Check if a field should be highlighted as needing attention (empty + important)
  const isImportantField = (field) => {
    const importantFields = [
      "gradeLevel",
      "school",
      "height",
      "weight",
      "homeAddress",
    ];
    return importantFields.includes(field);
  };

  const isFieldEmpty = (field) =>
    !editForm[field] || editForm[field].toString().trim() === "";

  const getFieldClass = (field) => {
    if (isImportantField(field) && isFieldEmpty(field)) {
      return "border-rose-300 focus:ring-rose-100";
    }
    return "border-line focus:border-brand focus:ring-brand/15";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-slate-950/20">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand">
            {loading
              ? "..."
              : detail?.name
                  ?.split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
              Participant profile
            </p>
            <h3 className="truncate text-base font-bold text-ink sm:text-lg">
              {loading ? "Loading..." : detail?.name || "Participant"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-subtle transition hover:bg-card-strong hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <p className="py-16 text-center text-sm text-subtle">
              Loading participant details...
            </p>
          ) : loadError ? (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/50">
              <AlertCircle size={16} />
              Couldn't load details: {loadError}
            </div>
          ) : isEditing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Participant ID</label>
                  <p className="mt-1.5 rounded-lg bg-card-muted px-3 py-2.5 font-mono text-sm text-subtle">
                    {participantId}
                  </p>
                </div>
                <div>
                  <label className={LABEL}>Section</label>
                  {canPickSection ? (
                    <select
                      value={editForm.section}
                      onChange={handleEditFieldChange("section")}
                      className={FIELD}
                    >
                      <option value="">No section</option>
                      {sections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1.5 rounded-lg bg-card-muted px-3 py-2.5 text-sm text-subtle">
                      {detail.section || "—"}
                    </p>
                  )}
                </div>

                <div>
                  <label className={LABEL}>First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={handleEditFieldChange("firstName")}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={handleEditFieldChange("lastName")}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Middle Name</label>
                  <input
                    type="text"
                    value={editForm.middleName}
                    onChange={handleEditFieldChange("middleName")}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Birthdate</label>
                  <input
                    type="date"
                    value={editForm.birthdate}
                    onChange={handleEditFieldChange("birthdate")}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Age (as entered)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.age}
                    onChange={handleEditFieldChange("age")}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Grade Level</label>
                  <input
                    type="text"
                    value={editForm.gradeLevel}
                    onChange={handleEditFieldChange("gradeLevel")}
                    className={`${FIELD} ${getFieldClass("gradeLevel")}`}
                  />
                </div>
                <div>
                  <label className={LABEL}>School</label>
                  <input
                    type="text"
                    value={editForm.school}
                    onChange={handleEditFieldChange("school")}
                    className={`${FIELD} ${getFieldClass("school")}`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Height</label>
                  <input
                    type="text"
                    placeholder="e.g. 110 cm"
                    value={editForm.height}
                    onChange={handleMeasurementChange("height")}
                    className={`${FIELD} ${getFieldClass("height")}`}
                  />
                </div>
                <div>
                  <label className={LABEL}>Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 18 kg"
                    value={editForm.weight}
                    onChange={handleMeasurementChange("weight")}
                    className={`${FIELD} ${getFieldClass("weight")}`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Home Address</label>
                  <input
                    type="text"
                    value={editForm.homeAddress}
                    onChange={handleEditFieldChange("homeAddress")}
                    className={`${FIELD} ${getFieldClass("homeAddress")}`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Sponsor Name</label>
                  <input
                    type="text"
                    value={editForm.sponsorName}
                    onChange={handleEditFieldChange("sponsorName")}
                    className={FIELD}
                    placeholder="e.g. Maria Santos"
                  />
                </div>
                <div>
                  <label className={LABEL}>Sponsor Country</label>
                  <input
                    type="text"
                    value={editForm.sponsorCountry}
                    onChange={handleEditFieldChange("sponsorCountry")}
                    className={FIELD}
                    placeholder="e.g. USA"
                  />
                </div>
                <div>
                  <label className={LABEL}>Sponsor Since</label>
                  <input
                    type="date"
                    value={editForm.sponsorSince}
                    onChange={handleEditFieldChange("sponsorSince")}
                    className={FIELD}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>New Password (optional)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current password"
                    value={editForm.password}
                    onChange={handleEditFieldChange("password")}
                    className={FIELD}
                  />
                </div>
              </div>

              {saveError && (
                <p className="text-xs font-medium text-rose-600">{saveError}</p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-line pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setSaveError(null);
                  }}
                  disabled={saving}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:bg-card-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              {hasMissingDetails() && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/50">
                  <AlertCircle size={16} />
                  Profile incomplete — some details are missing.
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoRow label="Participant ID" value={detail.participantId} />
                <InfoRow label="Section" value={detail.section} />
                <InfoRow label="First Name" value={detail.firstName} />
                <InfoRow label="Last Name" value={detail.lastName} />
                <InfoRow label="Middle Name" value={detail.middleName} />
                <InfoRow label="Birthdate" value={detail.birthdate} />
                <InfoRow
                  label="Age"
                  value={
                    detail.birthdate
                      ? `${computeAge(detail.birthdate)} years old`
                      : detail.age
                        ? `${detail.age} (as entered — no birthdate on file)`
                        : null
                  }
                />
                <InfoRow label="Grade Level" value={detail.gradeLevel} />
                <InfoRow label="School" value={detail.school} />
                <InfoRow label="Height" value={detail.height} />
                <InfoRow label="Weight" value={detail.weight} />
                <div className="sm:col-span-2">
                  <InfoRow label="Home Address" value={detail.homeAddress} />
                </div>
                <div className="sm:col-span-2 border-t border-line pt-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                    Sponsor Information
                  </p>
                </div>
                <InfoRow
                  label="Sponsor Name"
                  value={
                    detail.sponsorName ||
                    detail.sponsor?.name ||
                    [detail.sponsorFirstName, detail.sponsorLastName]
                      .filter(Boolean)
                      .join(" ") ||
                    "—"
                  }
                />
                <InfoRow
                  label="Sponsor Country"
                  value={
                    detail.sponsorCountry || detail.sponsor?.country || "—"
                  }
                />
                <InfoRow
                  label="Sponsor Since"
                  value={detail.sponsorSince || detail.sponsor?.since || "—"}
                />
              </div>

              {deleteError && (
                <div className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/50">
                  <AlertCircle size={16} />
                  {deleteError}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-5">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-rose-950/30"
                >
                  <Trash2 size={14} />
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong"
                >
                  <Pencil size={14} />
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
