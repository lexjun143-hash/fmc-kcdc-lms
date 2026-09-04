import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Gift,
  CheckCircle2,
  PackageCheck,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { getCurrentUser } from "../../api/auth";
import { fetchGifts, markGiftSeen, acknowledgeGift } from "../../api/gifts";

/* ---------------------------------------------------------
   Same restrained palette as My Assignment / My Letter Writing:
   - gray  = awaiting acknowledgement (no problem, just an
             action the participant hasn't taken yet)
   - green = acknowledged / done, matches the portal's accent
--------------------------------------------------------- */
const statusConfig = {
  Awaiting: {
    label: "Awaiting acknowledgement",
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
  },
  Acknowledged: {
    label: "Acknowledged",
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
    dot: "bg-green-500",
  },
};

function sponsorName(sponsor) {
  return typeof sponsor === "string" ? sponsor : sponsor?.name || "Sponsor";
}

export default function MyGift() {
  const currentUser = getCurrentUser();
  const [gifts, setGifts] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchGifts(currentUser.id)
      .then(setGifts)
      .catch(() => setGifts([]));
  }, [currentUser?.id]);

  const counts = useMemo(() => {
    const c = { All: gifts.length };
    for (const s of Object.keys(statusConfig)) {
      c[s] = gifts.filter((g) => g.status === s).length;
    }
    return c;
  }, [gifts]);

  const filtered = gifts.filter((g) => {
    const matchesFilter = filter === "All" || g.status === filter;
    const matchesQuery =
      query.trim() === "" ||
      g.item.toLowerCase().includes(query.toLowerCase()) ||
      sponsorName(g.sponsor).toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  function toggleExpand(id) {
    setConfirmChecked(false);
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleGiftClick(gift) {
    if (gift.status !== "Awaiting") return;
    markGiftSeen(gift.id, currentUser.id).catch(() => {});
    toggleExpand(gift.id);
  }

  async function acknowledge(id) {
    try {
      const updated = await acknowledgeGift(id, currentUser.id);
      setGifts((prev) => prev.map((gift) => (gift.id === id ? updated : gift)));
      setExpandedId(null);
      setConfirmChecked(false);
    } catch {
      // Keep the confirmation open when the server rejects the update.
    }
  }

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Gift Notifications
          </h3>
          <p className="text-sm text-slate-500">
            Gifts sent by your sponsors — let the center know you've received
            them
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Inbox size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {counts.Awaiting}
            </p>
            <p className="truncate text-xs text-slate-500">
              Awaiting acknowledgement
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <PackageCheck size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {counts.Acknowledged}
            </p>
            <p className="truncate text-xs text-slate-500">Acknowledged</p>
          </div>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search gifts..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {["All", ...Object.keys(statusConfig)].map((s) => {
            const active = filter === s;
            const label = s === "All" ? "All" : statusConfig[s].label;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-green-700 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {s === "Awaiting" ? "Awaiting" : label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gifts list */}
      <div className="mt-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
            <Gift size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              No gifts found
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Try a different search or filter
            </p>
          </div>
        ) : (
          filtered.map((gift) => {
            const cfg = statusConfig[gift.status];
            const isExpanded = expandedId === gift.id;
            return (
              <div
                key={gift.id}
                className="rounded-xl border border-slate-100 bg-white shadow-sm transition-all hover:border-slate-200 hover:shadow-md"
              >
                <button
                  onClick={() => handleGiftClick(gift)}
                  className={`group flex w-full items-center gap-4 p-4 text-left ${
                    gift.status === "Awaiting"
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  {/* Icon */}
                  <div className="relative flex-shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <Gift size={19} />
                    </div>
                    {gift.status === "Awaiting" && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {gift.item}
                      </p>
                      <span className="flex-shrink-0 text-xs text-slate-400">
                        Received {gift.dateReceived}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
                      {sponsorName(gift.sponsor)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {gift.note}
                    </p>
                  </div>

                  {/* Status pill */}
                  <div
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                  >
                    {gift.status === "Acknowledged" ? (
                      <CheckCircle2 size={13} />
                    ) : null}
                    {cfg.label}
                  </div>

                  {gift.status === "Awaiting" && (
                    <ChevronDown
                      size={16}
                      className={`hidden flex-shrink-0 text-slate-300 transition-transform group-hover:text-slate-400 sm:block ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {/* Acknowledgement panel */}
                {isExpanded && gift.status === "Awaiting" && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
                    <label className="flex items-start gap-2.5 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      I confirm I received "{gift.item}" from{" "}
                      {sponsorName(gift.sponsor)}.
                    </label>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleExpand(gift.id)}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => acknowledge(gift.id)}
                        disabled={!confirmChecked}
                        className="flex items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <CheckCircle2 size={14} />
                        Confirm receipt
                      </button>
                    </div>
                  </div>
                )}

                {/* Acknowledged footnote */}
                {gift.status === "Acknowledged" && (
                  <div className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
                    <p className="flex items-center gap-1.5 text-xs text-green-700">
                      <CheckCircle2 size={13} />
                      Acknowledged on {gift.acknowledgedAt}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
