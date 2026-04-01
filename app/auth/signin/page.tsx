"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { validateEmail } from "@/lib/email-validation";
import { Zap, Eye, EyeOff, AlertCircle, ShieldAlert, Lock, CheckCircle } from "lucide-react";

// ─── Brute-force protection constants ───────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_SEC = 60; // 1 minute lockout
const STORAGE_KEY = "signin_attempts";

interface AttemptData {
  count: number;
  lockedUntil: number | null; // timestamp
}

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

function getAttemptData(): AttemptData {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { count: 0, lockedUntil: null };
}

function setAttemptData(data: AttemptData) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearAttemptData() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function normalizeAuthError(error: unknown): AuthErrorLike {
  if (typeof error === "object" && error !== null) {
    return error as AuthErrorLike;
  }
  return {};
}

function isInvalidCredentialError(error: AuthErrorLike) {
  return error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401;
}

function isRateLimitError(error: AuthErrorLike) {
  return error.status === 429 || error.code === "TOO_MANY_REQUESTS";
}

// ─── Component ──────────────────────────────────────────────
export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerified = searchParams.get("verified") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  // Brute-force state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const isLockedOut = lockoutRemaining > 0;

  // Load attempt data on mount
  useEffect(() => {
    const data = getAttemptData();
    setFailedAttempts(data.count);

    if (data.lockedUntil && data.lockedUntil > Date.now()) {
      setLockoutRemaining(Math.ceil((data.lockedUntil - Date.now()) / 1000));
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          // Lockout expired → reset
          clearAttemptData();
          setFailedAttempts(0);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Record a failed attempt
  const recordFailedAttempt = useCallback(() => {
    const data = getAttemptData();
    const newCount = data.count + 1;

    if (newCount >= MAX_ATTEMPTS) {
      // Lock the user out
      const lockedUntil = Date.now() + LOCKOUT_DURATION_SEC * 1000;
      setAttemptData({ count: newCount, lockedUntil });
      setLockoutRemaining(LOCKOUT_DURATION_SEC);
      setFailedAttempts(newCount);
    } else {
      setAttemptData({ count: newCount, lockedUntil: null });
      setFailedAttempts(newCount);
    }
  }, []);

  // Clear attempts on success
  const clearAttempts = useCallback(() => {
    clearAttemptData();
    setFailedAttempts(0);
    setLockoutRemaining(0);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);

    if (newEmail) {
      const validation = validateEmail(newEmail);
      setEmailError(validation.error || "");
    } else {
      setEmailError("");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Block if locked out
    if (isLockedOut) return;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || "Invalid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await signIn.email({
        email,
        password,
        callbackURL: "/",
      });

      if (response.error) {
        const authError = normalizeAuthError(response.error);

        if (authError.code === "EMAIL_NOT_VERIFIED") {
          clearAttempts();
          router.push("/auth/verify-email");
          return;
        }

        if (isRateLimitError(authError)) {
          setError("Too many requests. Please wait a moment and try again.");
          return;
        }

        if (isInvalidCredentialError(authError)) {
          recordFailedAttempt();

          const remaining = MAX_ATTEMPTS - (failedAttempts + 1);

          if (remaining <= 0) {
            setError(
              `Too many failed attempts. Your account has been temporarily locked for ${LOCKOUT_DURATION_SEC} seconds.`
            );
          } else {
            setError(
              `Incorrect email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before temporary lockout.`
            );
          }
          return;
        }

        setError(authError.message || "Failed to sign in. Please try again.");
      } else {
        clearAttempts();
        router.push("/");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                <Zap className="size-6 text-primary-foreground" />
              </span>
            </div>
          </Link>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
          <div className="mb-8 flex flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
              <Zap className="size-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          {/* ── Email Verified Success Banner ── */}
          {isVerified && (
            <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/5 p-5 text-center animate-fade-in">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="size-6 text-green-500" />
              </div>
              <h3 className="font-semibold text-green-600 dark:text-green-400">
                Email Verified Successfully!
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Please sign in to continue to your account.
              </p>
            </div>
          )}

          {/* ── Lockout Banner ── */}
          {isLockedOut && (
            <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center animate-fade-in">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <Lock className="size-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-destructive">
                Account Temporarily Locked
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Too many failed sign-in attempts.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 font-mono text-lg font-bold text-destructive">
                <ShieldAlert className="size-5" />
                {formatTime(lockoutRemaining)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Please try again after the timer expires.
              </p>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  disabled={isLockedOut}
                  className={`w-full rounded-lg border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${emailError
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-input focus:border-primary focus:ring-primary/20"
                    }`}
                />
                {emailError && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-destructive" />
                )}
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="size-4" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLockedOut}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error / Warning Message */}
            {error && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${isLockedOut
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
                  }`}
              >
                <ShieldAlert className="size-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Attempt indicator (visible after first failure) */}
            {failedAttempts > 0 && !isLockedOut && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-5 rounded-full transition-colors ${i < failedAttempts
                        ? "bg-destructive"
                        : "bg-border"
                        }`}
                    />
                  ))}
                </div>
                <span>
                  {MAX_ATTEMPTS - failedAttempts} attempt
                  {MAX_ATTEMPTS - failedAttempts === 1 ? "" : "s"} left
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !!emailError || isLockedOut}
              className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLockedOut
                ? `Locked (${formatTime(lockoutRemaining)})`
                : loading
                  ? "Signing In..."
                  : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">Or continue with</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLockedOut}
            className="w-full rounded-lg border border-input bg-background px-4 py-2 font-medium text-foreground transition-colors hover:bg-accent flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="size-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign In with Google
          </button>

          <div className="mt-6 border-t border-border pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="font-medium text-primary hover:underline"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
