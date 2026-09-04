import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "../../api/auth";
import { fetchMyAttendance, checkInForSession } from "../../api/attendance";
import {
  normalizeAttendanceStatus,
  pickBestAttendanceStatus,
} from "../../utils/attendanceStatus";
import { toPhCalendarDate } from "../../utils/phDate";
import {
  Flame,
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

/* ---------------------------------------------------------
   Palette note: attendance genuinely has four distinct states
   in real center life, so this page adds one extra color
   (amber, for "Late") to the portal's usual gray/green/red —
   still deliberately small, and each color is used nowhere
   else on the page except this one meaning.
   green  = Present        gray  = Excused (not a fault)
   amber  = Late            red   = Absent
--------------------------------------------------------- */
const STATUS_META = {
  present: {
    label: "Present",
    icon: CheckCircle2,
    text: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
    dot: "bg-green-500",
    cell: "bg-green-500",
  },
  late: {
    label: "Late",
    icon: Clock,
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    cell: "bg-amber-400",
  },
  excused: {
    label: "Excused",
    icon: ShieldCheck,
    text: "text-slate-600",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
    cell: "bg-slate-300",
  },
  absent: {
    label: "Absent",
    icon: XCircle,
    text: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-200",
    dot: "bg-red-500",
    cell: "bg-red-500",
  },
};

const SESSION_TYPE = "Tutorial Session";

const CHECK_IN_STORAGE_PREFIX = "fmc_lms_attendance_check_in";

// Parse datetime strings from backend as UTC
// Backend returns times like "2026-09-02 00:00:00" without timezone
function parseUTCDateTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  // Replace space with T to make it ISO-like, then append Z for UTC
  const isoStr = dateTimeStr.replace(" ", "T") + "Z";
  return new Date(isoStr);
}

function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isoOf(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function currentStreak(log) {
  const sorted = [...log].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const s of sorted) {
    const status = normalizeAttendanceStatus(s.status);
    if (status === "present" || status === "late") streak++;
    else break;
  }
  return streak;
}

function nowWithinWindow(session, now) {
  if (!session?.date || !session?.startTime || !session?.endTime) return false;
  const start = new Date(`${session.date}T${session.startTime}`);
  const end = new Date(`${session.date}T${session.endTime}`);
  return now >= start && now <= end;
}

function timeUntilClose(session, now) {
  if (!session?.date || !session?.endTime) return "—";
  const end = new Date(`${session.date}T${session.endTime}`);
  const diffMs = end - now;
  if (diffMs <= 0) return "Closed";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function fmtTime(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* --------------------------------- Calendar --------------------------------- */

function AttendanceCalendar({
  year,
  monthIndex,
  onMonthChange,
  attendanceByDate,
  today,
  now,
}) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const monthLabel = firstDay.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange(-1)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onMonthChange(1)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const iso = isoOf(year, monthIndex, day);
          const session = attendanceByDate[iso];
          const isToday = iso === today;
          const isFuture = new Date(`${iso}T00:00:00`) > now;
          const normalizedStatus = session
            ? normalizeAttendanceStatus(session.status)
            : null;
          const meta = normalizedStatus ? STATUS_META[normalizedStatus] : null;

          return (
            <div key={iso} className="group relative flex justify-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-transform ${
                  meta
                    ? `${meta.cell} text-white group-hover:scale-105`
                    : isFuture
                      ? "text-slate-300"
                      : "text-slate-400"
                } ${isToday ? "ring-2 ring-offset-1 ring-slate-800" : ""}`}
              >
                {day}
              </div>
              {session && meta && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {session.type} · {meta.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div
            key={key}
            className="flex items-center gap-1.5 text-xs text-slate-500"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${meta.cell}`} />
            {meta.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-100 ring-1 ring-slate-200" />
          No session
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Check-in card ------------------------------ */

function CheckInCard({ session, checkedInEntry, onCheckIn, now }) {
  const isOpen = nowWithinWindow(session, now);

  if (!session) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4">
        <CalendarDays size={20} className="flex-shrink-0 text-slate-300" />
        <div>
          <p className="text-sm font-semibold text-slate-600">
            No attendance session is open right now
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Your next scheduled session will appear here when the coordinator
            opens it.
          </p>
        </div>
      </div>
    );
  }

  if (checkedInEntry) {
    const normalizedStatus = normalizeAttendanceStatus(checkedInEntry.status);
    const meta = STATUS_META[normalizedStatus] || STATUS_META.absent;
    const Icon = meta.icon;
    return (
      <div
        className={`flex items-center gap-4 rounded-2xl border px-5 py-4 shadow-sm ${meta.bg} ${meta.ring} ring-1`}
      >
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${meta.text}`}
        >
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${meta.text}`}>
            You're marked {meta.label.toLowerCase()} for {session.type}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fmtDate(session.date)} · Checked in at {checkedInEntry.timeIn}
          </p>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4">
        <CalendarDays size={20} className="flex-shrink-0 text-slate-300" />
        <div>
          <p className="text-sm font-semibold text-slate-600">
            No session is open for check-in right now
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Your next scheduled session will open here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-green-200 bg-gradient-to-br from-green-700 to-green-800 px-5 py-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-green-200">
          Open now · set by your coordinator
        </p>
        <p className="mt-1 text-base font-bold">
          {session.type} — {fmtDate(session.date)}
        </p>
        <p className="mt-1 text-sm text-green-100">
          Closes {fmtTime(session.endTime)} · {timeUntilClose(session, now)}
        </p>
      </div>
      <button
        onClick={onCheckIn}
        className="flex-shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-green-800 shadow-sm transition-colors hover:bg-green-50"
      >
        Check In Now
      </button>
    </div>
  );
}

/* ---------------------------------- Root ---------------------------------- */

export default function MyAttendance() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [attendance, setAttendance] = useState({
    sessions: [],
    stats: { total: 0, rate: 0, streak: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentUser = getCurrentUser();
  const storageKey = `${CHECK_IN_STORAGE_PREFIX}:${currentUser?.id || currentUser?.participantId || "guest"}`;

  const today = toPhCalendarDate(now);
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const viewMonth = (((baseMonth + monthOffset) % 12) + 12) % 12;
  const viewYear = baseYear + Math.floor((baseMonth + monthOffset) / 12);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setAttendance({ sessions: [], stats: { total: 0, rate: 0, streak: 0 } });
      setLoading(false);
      setError("");
      return;
    }

    fetchMyAttendance(currentUser.id)
      .then((data) => {
        setAttendance(
          data || { sessions: [], stats: { total: 0, rate: 0, streak: 0 } },
        );
        setError("");
      })
      .catch((err) => {
        setError(err.message || "Could not load attendance");
      })
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  const sortedSessions = useMemo(
    () =>
      [...(attendance.sessions || [])].sort(
        (a, b) => new Date(b.startAt) - new Date(a.startAt),
      ),
    [attendance.sessions],
  );

  const openSession = useMemo(() => {
    const live = sortedSessions.find((session) => {
      const start = parseUTCDateTime(session.startAt);
      const end = parseUTCDateTime(session.endAt);
      return start && end && now >= start && now <= end;
    });

    if (!live) {
      return null;
    }

    return {
      type: SESSION_TYPE,
      date: live.startAt.slice(0, 10),
      startTime: parseUTCDateTime(live.startAt).toTimeString().slice(0, 5),
      endTime: parseUTCDateTime(live.endAt).toTimeString().slice(0, 5),
      id: live.id,
    };
  }, [now, sortedSessions]);

  const checkedInEntry = useMemo(() => {
    const sessionForToday = sortedSessions.find((session) => {
      const startDate = parseUTCDateTime(session.startAt);
      const date = startDate ? startDate.toISOString().slice(0, 10) : null;
      const status = normalizeAttendanceStatus(session.status);
      return date === today && (status === "present" || status === "late");
    });

    if (!sessionForToday) return null;

    return {
      date: today,
      type: SESSION_TYPE,
      timeIn: sessionForToday.checkedInAt
        ? new Date(sessionForToday.checkedInAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "—",
      status: normalizeAttendanceStatus(sessionForToday.status),
    };
  }, [sortedSessions, today]);

  const log = useMemo(() => {
    const byDate = new Map();

    for (const session of sortedSessions) {
      const date = session.startAt?.slice(0, 10) || session.date;
      const nextEntry = {
        date,
        type: SESSION_TYPE,
        timeIn: session.checkedInAt
          ? new Date(session.checkedInAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "—",
        status: normalizeAttendanceStatus(session.status),
      };

      const existing = byDate.get(date);
      if (!existing) {
        byDate.set(date, nextEntry);
        continue;
      }

      const mergedStatus = pickBestAttendanceStatus([
        existing.status,
        nextEntry.status,
      ]);

      byDate.set(date, {
        ...existing,
        status: mergedStatus,
        timeIn:
          mergedStatus === nextEntry.status
            ? nextEntry.timeIn
            : existing.timeIn,
      });
    }

    return [...byDate.values()].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  }, [sortedSessions]);

  const attendanceByDate = useMemo(
    () => Object.fromEntries(log.map((s) => [s.date, s])),
    [log],
  );

  const stats = useMemo(() => {
    const total = attendance.stats?.total ?? log.length;
    const rate = attendance.stats?.rate ?? 0;
    const streak = attendance.stats?.streak ?? currentStreak(log);
    return { total, rate, streak };
  }, [attendance.stats, log]);

  async function handleCheckIn() {
    if (!currentUser?.id || !openSession) return;

    try {
      const result = await checkInForSession(currentUser.id);
      const refreshed = await fetchMyAttendance(currentUser.id);
      setAttendance(
        refreshed || { sessions: [], stats: { total: 0, rate: 0, streak: 0 } },
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          date: openSession.date,
          status: result.status,
          timeIn: new Date(result.checkedInAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
        }),
      );
      setError("");
    } catch (err) {
      setError(err.message || "Could not check in");
    }
  }

  if (loading) {
    return (
      <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
        <div className="mt-4 text-sm text-slate-500">Loading attendance…</div>
      </section>
    );
  }

  if (!currentUser?.id) {
    return (
      <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 shadow-sm">
          Please sign in to view your attendance records.
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      </section>
    );
  }

  if (!log.length) {
    return (
      <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 shadow-sm">
          No attendance records yet. Your attendance will appear here once a
          session is created.
        </div>
      </section>
    );
  }

  return (
    <section className="ml-4 mr-4 mt-6 sm:ml-6 sm:mr-6">
      {/* Check-in confirmation for the session date the teacher has set */}
      <div className="mt-5">
        <CheckInCard
          session={openSession}
          checkedInEntry={checkedInEntry}
          onCheckIn={handleCheckIn}
          now={now}
        />
      </div>

      {/* Stat strip */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <TrendingUp size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {stats.rate}%
            </p>
            <p className="truncate text-xs text-slate-500">
              Attendance rate this quarter
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <Flame size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {stats.streak} session{stats.streak !== 1 ? "s" : ""}
            </p>
            <p className="truncate text-xs text-slate-500">Current streak</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <CalendarDays size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-800">
              {stats.total}
            </p>
            <p className="truncate text-xs text-slate-500">Sessions logged</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <AttendanceCalendar
            year={viewYear}
            monthIndex={viewMonth}
            onMonthChange={(delta) => setMonthOffset((prev) => prev + delta)}
            attendanceByDate={attendanceByDate}
            today={today}
            now={now}
          />
        </div>

        {/* Recent activity timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Recent sessions
            </h2>
            <div className="mt-4 space-y-0">
              {log.slice(0, 6).map((s, i, arr) => {
                const normalizedStatus = normalizeAttendanceStatus(s.status);
                const meta =
                  STATUS_META[normalizedStatus] || STATUS_META.absent;
                const Icon = meta.icon;
                const isLast = i === arr.length - 1;
                return (
                  <div
                    key={s.date}
                    className="relative flex gap-3 pb-5 last:pb-0"
                  >
                    {!isLast && (
                      <span className="absolute left-[15px] top-8 h-full w-px bg-slate-100" />
                    )}
                    <div
                      className={`z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.text} ring-4 ring-white`}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {s.type}
                        </p>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {fmtDate(s.date)}
                        {s.timeIn !== "—" && <> · Time in {s.timeIn}</>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            <Info size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
            Missed a session for a valid reason? Let your center coordinator
            know so it can be marked Excused instead of Absent.
          </div>
        </div>
      </div>
    </section>
  );
}
