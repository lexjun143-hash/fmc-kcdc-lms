import React, { useEffect, useState } from "react";
import {
  Pin,
  Megaphone,
  AlertTriangle,
  CalendarClock,
  PartyPopper,
  Info,
  ChevronDown,
  Search,
  AlertCircle,
} from "lucide-react";
import { fetchAnnouncements } from "../../api/announcements";
import { getCurrentUser } from "../../api/auth";
import { formatPhDateTime } from "../../utils/phDate";
import { GLASS_SUBTLE } from "../../components/shared/GlassCard";

// Single consistent accent (green, matching the app's brand) — orange is
// reserved only for Urgent, echoing the header bar. No extra colors.
const categoryConfig = {
  Urgent: { icon: AlertTriangle, text: "text-orange-700", bg: "bg-orange-50", ring: "ring-orange-200" },
  Event: { icon: PartyPopper, text: "text-green-700", bg: "bg-green-50", ring: "ring-green-200" },
  Schedule: { icon: CalendarClock, text: "text-green-700", bg: "bg-green-50", ring: "ring-green-200" },
  General: { icon: Info, text: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-200" },
};

const filters = ["All", ...Object.keys(categoryConfig)];

const initials = (name) =>
  (name || "?")
    .replace(/^(Mr\.|Ms\.|Mrs\.)\s*/, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export default function MyAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const userId = getCurrentUser()?.id;
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchAnnouncements(userId)
      .then((data) => {
        if (!cancelled) setAnnouncements(data);
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
  }, []);

  // Scoped server-side already (own section + every all-sections post) —
  // this is just category/search narrowing on top of that.
  const filtered = announcements.filter((a) => {
    const matchesFilter = activeFilter === "All" || a.category === activeFilter;
    const matchesQuery =
      query.trim() === "" ||
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.body.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Announcements</h3>
          <p className="text-sm text-slate-500">Updates and notices from your coordinators</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search announcements..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {filters.map((f) => {
          const active = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-green-700 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Announcement list — Facebook-style feed */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className={`py-14 text-center ${GLASS_SUBTLE}`}>
            <Megaphone size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Loading announcements…</p>
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            <AlertCircle size={16} />
            Couldn't load announcements: {loadError}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
            <Megaphone size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">No announcements found</p>
            <p className="mt-1 text-xs text-slate-400">Try a different search or filter</p>
          </div>
        ) : (
          filtered.map((a) => {
            const cfg = categoryConfig[a.category];
            const CatIcon = cfg.icon;
            const isExpanded = expandedId === a.id;
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all hover:border-slate-200 hover:shadow-md"
              >
                {/* Post header */}
                <div className="flex items-start gap-3 p-4 pb-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {initials(a.author)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900">{a.author}</p>
                      {a.pinned && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                          <Pin size={11} />
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{formatPhDateTime(a.createdAt)}</p>
                  </div>
                  <span
                    className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                  >
                    <CatIcon size={11} />
                    {a.category}
                  </span>
                </div>

                {/* Post body */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="block w-full px-4 pb-4 pt-2 text-left"
                >
                  <h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
                  <p className={`mt-1 text-sm leading-relaxed text-slate-600 ${isExpanded ? "" : "line-clamp-2"}`}>
                    {a.body}
                  </p>
                  {!isExpanded && a.body.length > 90 && (
                    <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-green-700">
                      Read more
                      <ChevronDown size={12} />
                    </span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
