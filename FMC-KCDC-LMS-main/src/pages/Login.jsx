import React, { useEffect, useState } from "react";
import {
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Lock,
  Loader2,
  Clock,
} from "lucide-react";
import { login } from "../api/auth";
import { parsePhDate } from "../utils/phDate";
import ThemeToggle from "../components/shared/ThemeToggle";

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Written against the shared theme tokens (bg-card, text-ink, border-line,
// bg-brand, ...) from index.css rather than a bespoke stylesheet — same
// pattern as student/MyAccount.jsx. In light mode these resolve to the
// exact same values the rest of the app's slate/green vocabulary does, so
// this reads as "on brand," not a one-off look.
const FIELD_BASE =
  "w-full rounded-xl border bg-card py-2.5 pl-10 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:ring-2";
const FIELD_OK = "border-line focus:border-brand focus:ring-brand/20";
const FIELD_ERR = "border-rose-300 focus:border-rose-400 focus:ring-rose-100";

export default function Login({ onLoginSuccess }) {
  const [participantId, setParticipantId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set only after a lockout response — a real Date instant (parsed from
  // the backend's PH-time string), ticked down client-side every second
  // rather than just showing the static minute count the server returned.
  const [lockedUntil, setLockedUntil] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const isLocked = lockedUntil != null && remainingSeconds > 0;

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const secondsLeft = Math.max(
        0,
        Math.round((lockedUntil.getTime() - Date.now()) / 1000),
      );
      setRemainingSeconds(secondsLeft);
      if (secondsLeft <= 0) setLockedUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  function validate() {
    const next = {};
    if (!participantId.trim())
      next.participantId = "Participant ID is required.";
    if (!password) next.password = "Password is required.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const user = await login(participantId.trim(), password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message);
      if (err.lockedUntil) setLockedUntil(parsePhDate(err.lockedUntil));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-page">
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggle variant="surface" />
      </div>

      <div className="grid min-h-screen md:grid-cols-2">
        <div className="relative flex min-h-[38vh] flex-col justify-between overflow-hidden bg-gradient-to-br from-orange-500 to-orange-400 px-7 py-7 text-white dark:from-orange-950 dark:to-orange-900 sm:px-10 sm:py-9 md:min-h-screen md:px-12 md:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full border-[36px] border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[-7rem] top-1/3 h-96 w-96 rounded-full border-[48px] border-orange-300/20"
          />
          <div className="relative">
            <img
              src="images/img-logo.png"
              alt=""
              className="h-14 w-14 drop-shadow-md sm:h-16 sm:w-16"
            />
            <h1 className="mt-8 max-w-lg text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl lg:text-6xl">
              PH626 Kaakbay Child Development Center
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/85 sm:text-base">
              A learning home where every child's growth is nurtured — sign in
              to manage assignments, track progress, and stay connected with
              your center.
            </p>
          </div>
          <p className="relative text-xs text-white/60">
            Kaakbay CDC Learning Management System
          </p>
        </div>

        <div className="relative flex items-center justify-center overflow-hidden bg-card px-5 py-16 sm:px-10 md:px-14">
          <img
            src="images/img-logo.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(75vw,34rem)] w-[min(75vw,34rem)] -translate-x-1/2 -translate-y-1/2 opacity-[0.12] grayscale"
          />
          <div className="relative w-full max-w-md animate-card-in rounded-2xl border border-line bg-card p-7 shadow-xl shadow-slate-900/10 sm:p-9">
            <img
              src="images/img-logo.png"
              alt="PH626 Kaakbay Child Development Center"
              className="absolute -right-4 -top-5 z-10 h-[clamp(4.5rem,6vw,5.5rem)] w-[clamp(4.5rem,6vw,5.5rem)] object-contain sm:-right-6 sm:-top-7"
            />
            <div className="mb-8 pr-20 md:block">
              <h2 className="text-xl font-bold text-ink">Welcome back</h2>
              <p className="mt-1 text-sm text-subtle">
                Sign in to your account to continue
              </p>
            </div>

            {/* Lockout and wrong-credentials are visually distinct on
                purpose — lockout is a temporary, expected wait (amber,
                with a live countdown), not the same "you made a mistake"
                red as bad credentials. Same bg/ring banner shape used for
                every other error banner in this app (ManageStudents,
                ManageTeachers, ...), so it doesn't read as a one-off. */}
            {isLocked ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                <Clock
                  size={16}
                  className="mt-0.5 flex-shrink-0 text-amber-600"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Too many failed attempts
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Try again in{" "}
                    <span className="font-mono font-semibold">
                      {formatCountdown(remainingSeconds)}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              error && (
                <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200">
                  <AlertCircle
                    size={16}
                    className="flex-shrink-0 text-rose-600"
                  />
                  <p className="text-sm font-medium text-rose-700">{error}</p>
                </div>
              )
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="participantId"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle"
                >
                  Participant ID
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
                  />
                  <input
                    id="participantId"
                    type="text"
                    autoComplete="username"
                    placeholder="PH626-00001"
                    value={participantId}
                    onChange={(e) => {
                      setParticipantId(e.target.value);
                      if (fieldErrors.participantId) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          participantId: undefined,
                        }));
                      }
                    }}
                    className={`${FIELD_BASE} ${fieldErrors.participantId ? FIELD_ERR : FIELD_OK}`}
                  />
                </div>
                {fieldErrors.participantId && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {fieldErrors.participantId}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: undefined,
                        }));
                      }
                    }}
                    className={`${FIELD_BASE} pr-10 ${fieldErrors.password ? FIELD_ERR : FIELD_OK}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-ink"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLocked}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-brand-strong hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-lg disabled:active:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in…
                  </>
                ) : isLocked ? (
                  <>
                    <Clock size={16} />
                    Locked — {formatCountdown(remainingSeconds)}
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Sign in
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
