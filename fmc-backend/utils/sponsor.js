export function normalizeSponsorPayload({
  sponsorId,
  sponsorName,
  sponsorCountry,
  sponsorSince,
} = {}) {
  const result = {};

  if (sponsorId !== undefined && sponsorId !== null && sponsorId !== "") {
    const parsed = Number(sponsorId);
    if (!Number.isNaN(parsed) && parsed > 0) {
      result.sponsorId = parsed;
    }
  }

  const name = String(sponsorName ?? "").trim();
  const country = String(sponsorCountry ?? "").trim();
  const since = String(sponsorSince ?? "").trim();

  if (name) result.name = name;
  if (country) result.country = country;
  if (since) result.since = since;

  return Object.keys(result).length ? result : null;
}
