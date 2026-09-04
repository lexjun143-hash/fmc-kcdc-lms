import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSponsorPayload } from "../utils/sponsor.js";

test("normalizeSponsorPayload trims payload values and preserves sponsor id", () => {
  const payload = normalizeSponsorPayload({
    sponsorId: "12",
    sponsorName: "  Jane Smith  ",
    sponsorCountry: "  Philippines  ",
    sponsorSince: "2020-01-01",
  });

  assert.deepEqual(payload, {
    sponsorId: 12,
    name: "Jane Smith",
    country: "Philippines",
    since: "2020-01-01",
  });
});

test("normalizeSponsorPayload ignores empty sponsor fields", () => {
  const payload = normalizeSponsorPayload({
    sponsorName: "   ",
    sponsorCountry: "",
    sponsorSince: "",
  });

  assert.equal(payload, null);
});
