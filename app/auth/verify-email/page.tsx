"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import {
  Mail,
  RefreshCw,
  LogOut,
  CheckCircle,
  Inbox,
  ShieldCheck,
  Send,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────────── */
const POLL_INTERVAL_MS = 8_000;
const REDIRECT_DELAY_MS = 2_200;

/* ═════════════════════════════════════════════════════════════ */
export default function VerifyEmailPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  /* ── Auto-redirect when verified (from useSession) ───────── */
  useEffect(() => {
    if (!isPending && session?.user?.emailVerified) {
      setVerified(true);
      setTimeout(() => router.push("/"), REDIRECT_DELAY_MS);
    }
  }, [session, isPending, router]);

  /* ── Lock browser back button ────────────────────────────── */
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const h = () => window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  /* ── Poll server for verification status ─────────────────── */
  useEffect(() => {
    if (verified) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/auth/get-session", { credentials: "include" });
        const d = await r.json();
        if (d?.user?.emailVerified) {
          setVerified(true);
          clearInterval(id);
          setTimeout(() => router.push("/"), REDIRECT_DELAY_MS);
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router, verified]);

  /* ── Resend handler ──────────────────────────────────────── */
  const handleResend = async () => {
    setResending(true);
    setError("");
    setResent(false);
    try {
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session?.user?.email,
          callbackURL: "/",
        }),
      });
      if (res.ok) setResent(true);
      else {
        const d = await res.json().catch(() => null);
        setError(d?.message || "Failed to send. Please try again later.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setResending(false);
    }
  };

  /* ── Sign-out handler ────────────────────────────────────── */
  const handleSignOut = async () => {
    await signOut({ fetchOptions: { onSuccess: () => router.push("/") } });
  };

  /* ─────────────────────────────── Loading ──────────────────── */
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="size-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────── Verified ✓ ───────────────────── */
  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background overflow-hidden">
        {/* Glow */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div className="size-[480px] rounded-full bg-green-500/6 blur-[140px]" />
        </div>

        <div className="relative z-10 w-full max-w-sm px-6 text-center animate-scale-in">
          {/* Icon */}
          <div className="mx-auto mb-8 flex size-24 items-center justify-center rounded-3xl bg-green-500/10 ring-1 ring-green-500/20">
            <ShieldCheck className="size-11 text-green-500" strokeWidth={1.5} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            You&apos;re verified!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is ready. Redirecting you now…
          </p>

          {/* Progress */}
          <div className="mt-10 mx-auto w-56 h-1.5 rounded-full bg-border/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
              style={{
                animation: `progressFill ${REDIRECT_DELAY_MS}ms linear forwards`,
              }}
            />
          </div>

          <style jsx>{`
            @keyframes progressFill {
              from { width: 0%; }
              to   { width: 100%; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  /* ──────────────────── Main Verify Email UI ────────────────── */
  const userEmail = session?.user?.email ?? "your email";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">J</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── Decorative ── */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/3">
        <div className="size-[600px] rounded-full bg-primary/5 blur-[160px]" />
      </div>

      {/* ── Content ── */}
      <main className="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-[26rem]">

          {/* ▌ Icon ▌ */}
          <div className="flex justify-center animate-fade-in">
            <div className="relative">
              <div className="flex size-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15 shadow-lg shadow-primary/5">
                <Mail className="size-8 text-primary" strokeWidth={1.5} />
              </div>
              <div className="absolute inset-0 rounded-2xl animate-pulse-ring" />
            </div>
          </div>

          {/* ▌ Heading ▌ */}
          <div className="mt-8 text-center animate-slide-up">
            <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight sm:text-3xl">
              Check your inbox
            </h1>
            <p className="mt-2.5 text-[0.9rem] text-muted-foreground">
              We sent a verification link to
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1 text-sm font-medium shadow-sm">
              <Mail className="size-3.5 text-muted-foreground" />
              {userEmail}
            </div>
          </div>

          {/* ▌ Card ▌ */}
          <div className="mt-9 overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-slide-up">
            {/* Steps */}
            <div className="divide-y divide-border/60">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 px-5 py-4">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-bold text-primary">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">Open the email</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Look for a message from <span className="font-medium text-foreground">Jeng App</span>
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 px-5 py-4">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-bold text-primary">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Click &ldquo;Verify My Email&rdquo;
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    We&apos;ll detect it automatically — no need to come back here
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 px-5 py-4">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[0.65rem] font-bold text-green-600 dark:text-green-400">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-medium">All done!</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    You&apos;ll be redirected to your account instantly
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border bg-accent/30 px-5 py-4">
              {/* Help text */}
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Inbox className="mt-px size-3.5 shrink-0" />
                <p>
                  Can&apos;t find it? Check{" "}
                  <span className="font-medium text-foreground">spam / junk</span>{" "}
                  or resend below.
                </p>
              </div>

              {/* Button */}
              <button
                onClick={handleResend}
                disabled={resending || resent}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/15 transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {resending ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : resent ? (
                  <>
                    <CheckCircle className="size-4" />
                    Sent!
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Resend Verification Email
                  </>
                )}
              </button>

              {/* Feedback */}
              {error && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive animate-fade-in">
                  {error}
                </div>
              )}
              {resent && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2.5 text-xs text-green-600 dark:text-green-400 animate-fade-in">
                  <CheckCircle className="size-3.5 shrink-0" />
                  Verification email sent! Please check your inbox.
                </div>
              )}
            </div>
          </div>

          {/* ▌ Polling indicator ▌ */}
          <p className="mt-7 flex items-center justify-center gap-2 text-[0.7rem] text-muted-foreground/50 animate-fade-in select-none">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary/50" />
            </span>
            Listening for verification…
          </p>
        </div>
      </main>
    </div>
  );
}
