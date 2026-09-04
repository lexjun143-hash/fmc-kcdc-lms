import React, { useEffect, useState } from "react";
import { getCurrentUser } from "../../api/auth";
import { fetchUserByParticipantId } from "../../api/users";
import { computeAge } from "../../utils/age";

// Written directly against the theme tokens from index.css (bg-card,
// text-ink*, border-line-soft, ...) rather than literal slate-* classes —
// see index.css's `@theme inline` block for how those resolve to
// `var(--color-*)`, which is what actually repaints when ThemeProvider
// toggles `.dark` on <html>. Most of the app instead relies on the global
// `.dark` remap of the plain Tailwind palette in index.css; this page is
// the one written the "direct" way, as the intended pattern going forward.
function InfoRow({ label, value }) {
  return (
    <div className="border-b border-line-soft pb-2">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink-strong">{value || "—"}</p>
    </div>
  );
}

// Students are view-only, full stop — no pencil/edit affordance anywhere
// on this page, unlike teacher/admin MyAccount. That's not just a UI
// choice: the backend's updateUser rejects any profile-update request
// from a role="student" account outright, so there's nothing here for an
// edit form to successfully call even if one were added later.
export default function MyAccount() {
  const cachedUser = getCurrentUser();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const sponsorName =
    detail?.sponsorName ||
    detail?.sponsor?.name ||
    [detail?.sponsorFirstName, detail?.sponsorLastName]
      .filter(Boolean)
      .join(" ") ||
    "—";
  const sponsorSince =
    detail?.sponsorSince ||
    detail?.sponsorSinceDate ||
    detail?.sponsor?.since ||
    "—";
  const sponsorCountry =
    detail?.sponsorCountry || detail?.sponsor?.country || "";

  useEffect(() => {
    if (!cachedUser?.participantId || !cachedUser?.id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    // Self-view of the full-detail row — allowed server-side because the
    // requester is asking about their own participantId (see
    // getUserByParticipantId's isSelf check). This is a read; it has no
    // bearing on whether the account can ever be edited.
    fetchUserByParticipantId(cachedUser.participantId, cachedUser.id)
      .then((data) => {
        if (!cancelled) setDetail(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 px-4 sm:px-6">
      {/* Personal Information */}
      <br />
      <section className="rounded-lg border border-line bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 pb-3">
          <div className="h-4 w-1 rounded bg-brand" />
          <h3 className="text-sm font-semibold text-ink">
            Personal Information
          </h3>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-faint">
            Loading your information…
          </p>
        ) : loadError ? (
          <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">
            Couldn't load your information: {loadError}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <InfoRow label="Participant ID" value={detail.participantId} />
              <InfoRow label="Last Name" value={detail.lastName} />
              <InfoRow label="First Name" value={detail.firstName} />
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
            </div>

            <div className="space-y-3">
              <InfoRow label="Section" value={detail.section} />
              <InfoRow label="Grade Level" value={detail.gradeLevel} />
              <InfoRow label="School" value={detail.school} />
              <InfoRow label="Height" value={detail.height} />
              <InfoRow label="Weight" value={detail.weight} />
              <InfoRow label="Home Address" value={detail.homeAddress} />
            </div>
          </div>
        )}
      </section>

      {/* Sponsor Information */}
      <section className="rounded-lg border border-line bg-card p-4 pt-6 shadow-sm">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <div className="h-4 w-1 rounded bg-brand" />
            <h3 className="text-sm font-semibold text-ink">
              Sponsor Information
            </h3>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border-b border-line-soft pb-2">
            <p className="text-xs text-subtle">Sponsor Name:</p>
            <p className="mt-1 text-sm font-medium text-ink-strong">
              {sponsorName}
            </p>
          </div>
          <div className="border-b border-line-soft pb-2">
            <p className="text-xs text-subtle">Sponsor Since:</p>
            <p className="mt-1 text-sm font-medium text-ink-strong">
              {sponsorSince}
            </p>
          </div>
          {sponsorCountry && (
            <div className="border-b border-line-soft pb-2 md:col-span-2">
              <p className="text-xs text-subtle">Sponsor Country:</p>
              <p className="mt-1 text-sm font-medium text-ink-strong">
                {sponsorCountry}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
