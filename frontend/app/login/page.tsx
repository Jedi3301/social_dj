"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import styles from "./login.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Both fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      {/* ── Left panel ── */}
      <div className={styles.leftPanel}>
        <div className={`${styles.leftInner} ${mounted ? "animate-slide-left" : ""}`}>
          <div className={styles.wordmark}>Social</div>
          <div className={styles.heroBlock}>
            <p className="type-caption" style={{ color: "var(--color-inverse-ink)", marginBottom: "var(--spacing-lg)", opacity: 0.7 }}>
              Welcome back
            </p>
            <h1 className={styles.heroHeadline}>
              The feed that&nbsp;
              <span className={styles.accentWord}>feels</span>
              &nbsp;right.
            </h1>
            <p className={styles.heroBody}>
              Pick up where you left off — your connections, your conversations, your moments.
            </p>
          </div>
          {/* Floating pastel cards */}
          <div className={styles.floatingCards}>
            <div className={`${styles.floatCard} ${styles.fc1}`}>
              <div className={styles.fcDot} />
              <span>3 new followers</span>
            </div>
            <div className={`${styles.floatCard} ${styles.fc2}`}>
              <div className={styles.fcDot} style={{ background: "var(--color-block-lime)" }} />
              <span>12 liked your post</span>
            </div>
            <div className={`${styles.floatCard} ${styles.fc3}`}>
              <div className={styles.fcDot} style={{ background: "var(--color-block-mint)" }} />
              <span>New story from Alex</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.rightPanel}>
        <div className={`${styles.formWrap} ${mounted ? "animate-scale-in" : ""}`}>
          <div className={styles.formHeader}>
            <h2 className="type-headline">Sign in</h2>
            <p className="type-body" style={{ marginTop: "var(--spacing-xs)", color: "var(--color-ink)", opacity: 0.6 }}>
              Good to see you again.
            </p>
          </div>

          {error && (
            <div className={`alert-error animate-fade-in ${styles.alertBox}`}>{error}</div>
          )}

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={`input-field ${error && !form.email ? "error" : ""}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                suppressHydrationWarning
              />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <Link href="/forgot-password" className={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>
              <div className={styles.inputWrap}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`input-field ${styles.inputWithIcon} ${error && !form.password ? "error" : ""}`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className={`btn btn-primary btn-primary-full ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className={styles.switchRow}>
            New here?{" "}
            <Link href="/register" className={styles.switchLink}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
