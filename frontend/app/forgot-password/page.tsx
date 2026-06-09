"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import styles from "./forgot-password.module.css";

type Stage = "form" | "sent";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) { setError("Please enter your email address."); return; }
    if (!/\S+@\S+\.\S+/.test(trimmed)) { setError("Enter a valid email address."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Request failed");
      }
      setStage("sent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      {/* Pastel background blobs */}
      <div className={styles.bgDecor}>
        <div className={`${styles.bgBlob} ${styles.blob1}`} />
        <div className={`${styles.bgBlob} ${styles.blob2}`} />
      </div>

      <div className={`${styles.card} ${mounted ? "animate-scale-in" : ""}`}>

        {stage === "form" ? (
          <>
            {/* ── Lime header block ── */}
            <div className={`${styles.cardHero} color-block color-block-lime`}>
              <p className="type-caption" style={{ marginBottom: "var(--spacing-sm)" }}>
                Account recovery
              </p>
              <h1 className="type-headline">Forgot your password?</h1>
              <p style={{ marginTop: "var(--spacing-md)", fontSize: 16, fontWeight: 320, lineHeight: 1.55 }}>
                No worries. Enter your email and we&apos;ll send you a link to get back in.
              </p>
            </div>

            <div className={styles.cardBody}>
              {error && (
                <div className={`alert-error animate-fade-in ${styles.alertBox}`}>{error}</div>
              )}

              <form onSubmit={handleSubmit} className={styles.form} noValidate>
                <div className={styles.fieldGroup}>
                  <label htmlFor="reset-email" className={styles.label}>
                    Email address
                  </label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    className={`input-field ${error ? "error" : ""}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(""); }}
                    suppressHydrationWarning
                  />
                </div>

                <button
                  id="forgot-submit"
                  type="submit"
                  className={`btn btn-primary btn-primary-full ${styles.submitBtn}`}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : null}
                  {loading ? "Sending reset link…" : "Send reset link"}
                </button>
              </form>

              <div className={styles.backRow}>
                <Link href="/login" className={styles.backLink}>
                  <span className={styles.backArrow}>←</span>
                  Back to sign in
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── Success state ── */}
            <div className={`${styles.cardHero} color-block color-block-mint`}>
              <p className="type-caption" style={{ marginBottom: "var(--spacing-sm)" }}>
                Check your inbox
              </p>
              <h1 className="type-headline">Reset link sent!</h1>
            </div>

            <div className={styles.cardBody}>
              <div className={`${styles.successBlock} animate-fade-up`}>
                <div className={styles.successIcon}>✉</div>
                <p className={styles.successText}>
                  If an account exists for{" "}
                  <strong>{email}</strong>, you&apos;ll receive a password reset link within a few minutes.
                </p>
                <p className={styles.successHint}>
                  Don&apos;t see it? Check your spam folder or try again.
                </p>
              </div>

              <div className={styles.successActions}>
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.retryBtn}`}
                  onClick={() => { setStage("form"); setEmail(""); setError(""); }}
                >
                  Try a different email
                </button>
                <Link href="/login" className={`btn btn-primary ${styles.loginBtn}`}>
                  Back to sign in
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
