import React, { useMemo, useState, useEffect } from "react";
import {
  Users,
  Calendar,
  Timer,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Bell,
  Search,
  TrendingUp,
  CalendarDays,
  ClipboardCheck,
  CalendarPlus,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "../../api/auth";
import {
  createAttendanceSession,
  fetchSectionAttendance,
} from "../../api/attendance";
import { normalizeAttendanceStatus } from "../../utils/attendanceStatus";

// Parse datetime strings from backend as UTC
// Backend returns times like "2026-09-02 00:00:00" without timezone
function parseUTCDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const isoStr = dateTimeStr.replace(" ", "T") + "Z";
  return new Date(isoStr);
}

/* ---------------------------------------------------------
   This isn't physical attendance — it's tracking whether a
   student used the system (checked in) before the deadline
   window the teacher sets (a start date/time and an end
   date/time). Three states only:
   green = checked in inside the window     amber = checked in after the window closed
   red   = no activity at all (never checked in)
--------------------------------------------------------- */
const STATUS_META = {
  present: {
    label: "On time",
    icon: CheckCircle2,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
    cell: "bg-green-500",
  },
  late: {
    label: "Late",
    icon: Clock,
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    cell: "bg-amber-400",
  },
  absent: {
    label: "No activity",
    icon: XCircle,
    text: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-200",
    cell: "bg-red-500",
  },
};

const NOW = new Date();

function fmtShortDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function fmtFullDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
function fmtTime(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Short label for a deadline window, used in table headers / tab strips.
// Same-day windows just show the one date; multi-day windows show a range.
function fmtWindowShort(entry) {
  if (!entry?.startDate && !entry?.endDate) return "No window";
  const startDate = entry.startDate || entry.endDate;
  const endDate = entry.endDate || entry.startDate;
  return startDate === endDate
    ? fmtShortDate(endDate)
    : `${fmtShortDate(startDate)}–${fmtShortDate(endDate)}`;
}

// Full description of a window's open/close moments, used in tooltips
// and the detail panel.
function fmtWindowFull(entry) {
  const startDate = entry?.startDate || "";
  const endDate = entry?.endDate || "";
  const opens = startDate
    ? `${fmtFullDate(startDate)} at ${fmtTime(entry?.startTime)}`
    : "Not set";
  const closes = startDate
    ? endDate === startDate
      ? `${fmtTime(entry?.endTime)} the same day`
      : `${fmtFullDate(endDate || startDate)} at ${fmtTime(entry?.endTime)}`
    : "Not set";
  return { opens, closes };
}

function quickDate(daysFromNow) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// Returns the Monday and Saturday (as ISO dates) of the week that is
// `weeksAhead` weeks from today. Monday=1 ... Saturday=6, Sunday=0.
function weekRange(weeksAhead) {
  const dow = NOW.getDay();
  const mondayOffset = dow === 0 ? 1 : 1 - dow; // days from today to this week's Monday
  const monday = new Date(NOW);
  monday.setDate(monday.getDate() + mondayOffset + weeksAhead * 7);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return {
    start: monday.toISOString().split("T")[0],
    end: saturday.toISOString().split("T")[0],
  };
}

const weekPresets = [
  { label: "This week (Mon–Sat)", ...weekRange(0) },
  { label: "Next week (Mon–Sat)", ...weekRange(1) },
];

/* ------------------------------------------------------------------ */
/* Set Deadline                                                        */
/* ------------------------------------------------------------------ */

const initialForm = {
  section: "",
  startDate: "",
  startTime: "08:00",
  endDate: "",
  endTime: "17:00",
};

function SetDeadline() {
  const assignedSection = getCurrentUser()?.section || "";
  const [form, setForm] = useState(() => ({
    ...initialForm,
    section: assignedSection,
  }));
  const [errors, setErrors] = useState({});
  const [posted, setPosted] = useState(false);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.section) next.section = "Please choose a section.";
    if (!form.startDate) next.startDate = "Please set a start date.";
    if (!form.endDate) next.endDate = "Please set an end date.";
    if (form.startDate && form.endDate) {
      const start = new Date(`${form.startDate}T${form.startTime || "00:00"}`);
      const end = new Date(`${form.endDate}T${form.endTime || "00:00"}`);
      if (end <= start) next.endDate = "End must be after the start.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const requesterId = getCurrentUser()?.id;
      await createAttendanceSession({
        requesterId,
        section: form.section,
        startDate: form.startDate,
        startTime: form.startTime,
        endDate: form.endDate,
        endTime: form.endTime,
      });
      setPosted(true);
      setForm({ ...initialForm, section: assignedSection });
      setTimeout(() => setPosted(false), 3000);
      window.location.reload();
    } catch (err) {
      setErrors({
        submit: err.message || "Could not create attendance window",
      });
    }
  };

  const today = NOW.toISOString().split("T")[0];
  const hasPreview = form.section || form.startDate || form.endDate;

  return (
    <div>
      {posted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700 ring-1 ring-green-200">
          <CheckCircle2 size={16} />
          Deadline window set — students who don't check in before it ends will
          show as no activity.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3"
        >
          {/* Assigned section */}
          <div>
            <p className="text-sm font-semibold text-slate-700">Section</p>
            <p className="mt-0.5 text-xs text-slate-400">
              This deadline will automatically apply to your assigned section.
            </p>
            <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-800">
              {form.section || "No section assigned"}
            </div>
            {errors.section && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.section}
              </p>
            )}
          </div>

          {/* Weekly presets */}
          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700">
              Quick set
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {weekPresets.map((p) => {
                const isActive =
                  form.startDate === p.start && form.endDate === p.end;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        startDate: p.start,
                        endDate: p.end,
                      }))
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start */}
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">Starts</p>
            <p className="mt-0.5 text-xs text-slate-400">
              When students can begin checking in.
            </p>
            <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative">
                <Calendar
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="date"
                  min={today}
                  value={form.startDate}
                  onChange={handleChange("startDate")}
                  className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 ${
                    errors.startDate
                      ? "border-rose-300 focus:ring-rose-100"
                      : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                  }`}
                />
              </div>
              <div className="relative">
                <Timer
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="time"
                  value={form.startTime}
                  onChange={handleChange("startTime")}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>
            {errors.startDate && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.startDate}
              </p>
            )}
          </div>

          {/* End */}
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700">Ends</p>
            <p className="mt-0.5 text-xs text-slate-400">
              The final moment students can still check in.
            </p>
            <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative">
                <Calendar
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="date"
                  min={form.startDate || today}
                  value={form.endDate}
                  onChange={handleChange("endDate")}
                  className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 ${
                    errors.endDate
                      ? "border-rose-300 focus:ring-rose-100"
                      : "border-slate-200 focus:border-green-500 focus:ring-green-100"
                  }`}
                />
              </div>
              <div className="relative">
                <Timer
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="time"
                  value={form.endTime}
                  onChange={handleChange("endTime")}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>
            {errors.endDate && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.endDate}
              </p>
            )}
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            <AlertCircle
              size={14}
              className="mt-0.5 flex-shrink-0 text-slate-400"
            />
            Checking in after the window ends is marked Late. Never checking in
            at all shows as No activity.
          </p>

          {errors.submit && (
            <p className="mt-3 text-xs font-medium text-rose-600">
              {errors.submit}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => {
                setForm({ ...initialForm, section: assignedSection });
                setErrors({});
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800"
            >
              Set Deadline
            </button>
          </div>
        </form>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Sparkles size={13} />
              Participant preview
            </p>
            {!hasPreview ? (
              <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
                <CalendarDays size={22} className="text-slate-300" />
                <p className="text-xs text-slate-400">
                  Fill out the form to preview this deadline.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-600">
                    <ClipboardCheck size={18} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {form.section || "Section"}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                      {form.startDate && form.endDate
                        ? form.startDate === form.endDate
                          ? fmtFullDate(form.startDate)
                          : `${fmtShortDate(form.startDate)} – ${fmtShortDate(form.endDate)}`
                        : "No dates yet"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p>
                    Opens{" "}
                    <span className="font-semibold text-slate-700">
                      {form.startDate ? fmtFullDate(form.startDate) : "—"}
                    </span>{" "}
                    at{" "}
                    <span className="font-semibold text-slate-700">
                      {fmtTime(form.startTime)}
                    </span>
                  </p>
                  <p>
                    Deadline{" "}
                    <span className="font-semibold text-slate-700">
                      {form.endDate ? fmtFullDate(form.endDate) : "—"}
                    </span>{" "}
                    at{" "}
                    <span className="font-semibold text-slate-700">
                      {fmtTime(form.endTime)}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monitor Attendance                                                   */
/* ------------------------------------------------------------------ */

function MonitorAttendance() {
  const currentUser = getCurrentUser();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [reminded, setReminded] = useState(false);
  const [attendance, setAttendance] = useState({ students: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const section = currentUser?.section;
    if (!section) {
      setAttendance({ students: [], sessions: [] });
      setLoading(false);
      setError("");
      return;
    }

    fetchSectionAttendance(section)
      .then((data) => {
        setAttendance(data || { students: [], sessions: [] });
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Could not load attendance records");
      })
      .finally(() => setLoading(false));
  }, [currentUser?.section]);

  const deadlineLog = (attendance.sessions || []).map((session) => ({
    ...session,
    roster: Object.fromEntries(
      Object.entries(session.roster || {}).map(([name, entry]) => [
        name,
        {
          ...entry,
          status: normalizeAttendanceStatus(entry?.status),
        },
      ]),
    ),
  }));
  const roster = attendance.students?.map((student) => student.name) || [];
  const filteredRoster = roster.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase()),
  );
  const activeDeadline = deadlineLog[activeIndex] || {
    roster: {},
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
  };

  const studentRate = (name) => {
    const entries = deadlineLog.map((s) =>
      normalizeAttendanceStatus(s.roster?.[name]?.status),
    );
    const good = entries.filter((s) => s === "present" || s === "late").length;
    return entries.length ? Math.round((good / entries.length) * 100) : 0;
  };

  const classStats = useMemo(() => {
    let good = 0;
    let total = 0;
    deadlineLog.forEach((s) => {
      Object.values(s.roster || {}).forEach((r) => {
        total++;
        if (r.status === "present" || r.status === "late") good++;
      });
    });
    const noActivityToday = Object.values(activeDeadline.roster || {}).filter(
      (r) => r.status === "absent",
    ).length;
    return {
      rate: total ? Math.round((good / total) * 100) : 0,
      count: deadlineLog.length,
      noActivityToday,
    };
  }, [activeDeadline, deadlineLog]);

  function remindInactive() {
    setReminded(true);
    setTimeout(() => setReminded(false), 2500);
  }

  if (loading) {
    return (
      <div className="mt-4 text-sm text-slate-500">Loading attendance…</div>
    );
  }

  if (!currentUser?.section) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 shadow-sm">
        No section is assigned to this teacher yet. Set your section in your
        account or create a deadline window once a section is assigned.
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!deadlineLog.length) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 shadow-sm">
        No attendance windows have been set for this section yet. Use the Set
        Deadline tab to create one.
      </div>
    );
  }

  const activeWindow = fmtWindowFull(activeDeadline);

  return (
    <div>
      {/* Stat strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <TrendingUp size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {classStats.rate}%
            </p>
            <p className="truncate text-xs text-slate-500">
              Class check-in rate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <CalendarDays size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {classStats.count}
            </p>
            <p className="truncate text-xs text-slate-500">
              Deadline windows set
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <Users size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {classStats.noActivityToday}
            </p>
            <p className="truncate text-xs text-slate-500">
              No activity this window
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Section A — check-in history
          </h2>
          <div className="relative w-full sm:max-w-[200px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white pb-2 text-left text-xs font-semibold text-slate-500">
                  Student
                </th>
                {deadlineLog.map((s, i) => {
                  const w = fmtWindowFull(s);
                  return (
                    <th
                      key={i}
                      className="pb-2 text-center text-[11px] font-semibold text-slate-400"
                    >
                      <button
                        onClick={() => setActiveIndex(i)}
                        title={`Opens ${w.opens} · Closes ${w.closes}`}
                        className={`rounded-md px-1.5 py-0.5 transition-colors ${activeIndex === i ? "bg-slate-800 text-white" : "hover:bg-slate-100"}`}
                      >
                        {fmtWindowShort(s)}
                      </button>
                    </th>
                  );
                })}
                <th className="pb-2 text-right text-xs font-semibold text-slate-500">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((name) => (
                <tr key={name} className="border-t border-slate-50">
                  <td className="sticky left-0 whitespace-nowrap bg-white py-2 pr-3 text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                        {initials(name)}
                      </span>
                      {name}
                    </div>
                  </td>
                  {deadlineLog.map((s, i) => {
                    const entry = s.roster?.[name] || {
                      status: "absent",
                      timeIn: "",
                    };
                    const normalizedEntry = {
                      ...entry,
                      status: normalizeAttendanceStatus(entry?.status),
                    };
                    const meta =
                      STATUS_META[normalizedEntry.status] || STATUS_META.absent;
                    return (
                      <td key={i} className="p-1 text-center">
                        <div className="group relative mx-auto flex h-7 w-7 items-center justify-center">
                          <div
                            className={`h-full w-full rounded-md ${meta.cell} transition-transform group-hover:scale-110`}
                          />
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            {meta.label}
                            {normalizedEntry.timeIn
                              ? ` · ${normalizedEntry.timeIn}`
                              : ""}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right text-xs font-semibold text-slate-500">
                    {studentRate(name)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs text-slate-500"
            >
              <span className={`h-2.5 w-2.5 rounded-md ${meta.cell}`} />
              {meta.label}
            </div>
          ))}
        </div>
      </div>

      {/* Selected deadline roster */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {activeDeadline.startDate === activeDeadline.endDate
                ? fmtFullDate(activeDeadline.endDate)
                : `${fmtShortDate(activeDeadline.startDate)} – ${fmtFullDate(activeDeadline.endDate)}`}
            </h2>
            <p className="text-xs text-slate-400">
              Opened {activeWindow.opens} · Closes {activeWindow.closes}
            </p>
          </div>
          {classStats.noActivityToday > 0 && (
            <button
              onClick={remindInactive}
              disabled={reminded}
              className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200 transition-colors hover:bg-rose-100 disabled:opacity-60"
            >
              <Bell size={13} />
              {reminded ? "Reminder sent!" : "Remind inactive students"}
            </button>
          )}
        </div>

        <div className="mt-3 divide-y divide-slate-100">
          {Object.entries(activeDeadline.roster).map(([name, entry]) => {
            const normalizedEntry = {
              ...entry,
              status: normalizeAttendanceStatus(entry?.status),
            };
            const meta =
              STATUS_META[normalizedEntry.status] || STATUS_META.absent;
            const Icon = meta.icon;
            return (
              <div key={name} className="flex items-center gap-3 py-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                  {initials(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {normalizedEntry.timeIn
                      ? `Checked in ${normalizedEntry.timeIn}`
                      : "No check-in recorded"}
                  </p>
                </div>
                <span
                  className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}
                >
                  <Icon size={12} />
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manage Attendance (sub-nav)                                         */
/* ------------------------------------------------------------------ */

const tabs = [
  { key: "set", label: "Set Deadline", icon: CalendarPlus },
  { key: "monitor", label: "Monitor Attendance", icon: ClipboardCheck },
];

export default function ManageAttendance() {
  const [activeTab, setActiveTab] = useState("set");

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Manage Attendance</h3>
        <p className="text-sm text-slate-500">
          Set a check-in deadline window and see who used the system in time
        </p>
      </div>

      <div className="mt-4 inline-flex rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-white text-green-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeTab === "set" ? <SetDeadline /> : <MonitorAttendance />}
      </div>
    </section>
  );
}
