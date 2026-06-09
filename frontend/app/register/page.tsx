"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./register.module.css";

// ── Password rule definitions ────────────────────────────────────────────────
const PASSWORD_RULES = [
  { id: "len",     label: "At least 8 characters",       test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A–Z)",  test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "One lowercase letter (a–z)",  test: (p: string) => /[a-z]/.test(p) },
  { id: "number",  label: "One number (0–9)",            test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (!@#…)",test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// ── Email validation status type ─────────────────────────────────────────────
type EmailStatus = "idle" | "checking" | "valid" | "invalid";

// ── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [emailReason, setEmailReason] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedEmail = useDebounce(form.email, 700);

  useEffect(() => { setMounted(true); }, []);

  // ── Real-time email domain check ─────────────────────────────────────────
  useEffect(() => {
    const email = debouncedEmail.trim();
    // Only check once there's an @ and a domain part
    const hasAtAndDomain = /\S+@\S+\.\S+/.test(email);
    if (!hasAtAndDomain) {
      setEmailStatus("idle");
      setEmailReason("");
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setEmailStatus("checking");
    setEmailReason("");

    fetch(`${API}/api/auth/check-email?email=${encodeURIComponent(email)}`, {
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        setEmailStatus(data.valid ? "valid" : "invalid");
        setEmailReason(data.reason || "");
        if (!data.valid) {
          setErrors(prev => ({ ...prev, email: data.reason || "Invalid email" }));
        } else {
          setErrors(prev => ({ ...prev, email: "" }));
        }
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setEmailStatus("idle"); // network error — fail open
        }
      });
  }, [debouncedEmail]);

  // ── Password rule checks ─────────────────────────────────────────────────
  const passedRules = PASSWORD_RULES.map(r => r.test(form.password));
  const allRulesPassed = passedRules.every(Boolean);
  const strengthScore = passedRules.filter(Boolean).length;

  const strengthLabel = ["", "Very weak", "Weak", "Fair", "Good", "Strong"][strengthScore];
  const strengthColor = ["", "#e74c3c", "#e67e22", "#f1c40f", "#2980b9", "#27ae60"][strengthScore];

  // ── Client-side validation ───────────────────────────────────────────────
  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = "Username is required.";
    else if (form.username.length < 3) e.username = "At least 3 characters.";
    else if (/\s/.test(form.username)) e.username = "No spaces allowed.";

    if (!form.email.trim()) e.email = "Email is required.";
    else if (emailStatus === "invalid") e.email = emailReason || "Email domain is invalid.";

    if (!form.password) e.password = "Password is required.";
    else if (!allRulesPassed) e.password = "Password does not meet all requirements.";

    if (!form.confirm) e.confirm = "Please confirm your password.";
    else if (form.password !== form.confirm) e.confirm = "Passwords do not match.";
    return e;
  }, [form, emailStatus, emailReason, allRulesPassed]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name !== "email" && errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    if (serverError) setServerError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    if (emailStatus === "checking") return; // still verifying

    setLoading(true);
    setServerError("");
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      localStorage.setItem("token", data.token);
      router.push("/complete-profile");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Email status icon ────────────────────────────────────────────────────
  const EmailIcon = () => {
    if (emailStatus === "checking") return <span className={styles.emailSpinner} />;
    if (emailStatus === "valid")    return <span className={styles.emailValid}>✓</span>;
    if (emailStatus === "invalid")  return <span className={styles.emailInvalid}>✗</span>;
    return null;
  };

  return (
    <div className={styles.shell}>
      {/* ── Left branding column ── */}
      <div className={styles.leftPanel}>
        <div className={`${styles.leftInner} ${mounted ? "animate-slide-left" : ""}`}>
          <div className={styles.wordmark}>Social</div>

          {/* Lime color block */}
          <div className={`${styles.featureBlock} color-block color-block-lime`}>
            <p className="type-caption" style={{ marginBottom: "var(--spacing-md)" }}>Why join?</p>
            <h2 className="type-headline" style={{ marginBottom: "var(--spacing-lg)" }}>
              Built for real connections.
            </h2>
            <ul className={styles.featureList}>
              {[
                "Share moments that matter",
                "Discover communities you love",
                "Private by design, open by choice",
              ].map((item, i) => (
                <li key={i} className={styles.featureItem}>
                  <span className={styles.checkIcon}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Coral stats block */}
          <div className={`${styles.accentBlock} color-block color-block-coral`}>
            <p className="type-caption" style={{ marginBottom: "var(--spacing-xs)" }}>
              Today&apos;s activity
            </p>
            <div className={styles.statsRow}>
              {[["12k", "Posts"], ["3.4k", "Stories"], ["890", "New today"]].map(([n, l]) => (
                <div key={l} className={styles.statItem}>
                  <span className={styles.statNum}>{n}</span>
                  <span className={styles.statLabel}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form column ── */}
      <div className={styles.rightPanel}>
        <div className={`${styles.formWrap} ${mounted ? "animate-scale-in" : ""}`}>
          <div className={styles.formHeader}>
            <h1 className="type-headline">Create account</h1>
            <p className="type-body" style={{ marginTop: "var(--spacing-xs)", color: "var(--color-ink)", opacity: 0.6 }}>
              Free forever. No credit card needed.
            </p>
          </div>

          {serverError && (
            <div className={`alert-error animate-fade-in ${styles.alertBox}`}>{serverError}</div>
          )}

          <form onSubmit={handleSubmit} className={styles.form} noValidate>

            {/* ── Username ── */}
            <div className={styles.fieldGroup}>
              <label htmlFor="username" className={styles.label}>Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                className={`input-field ${errors.username ? "error" : ""}`}
                placeholder="yourhandle"
                value={form.username}
                onChange={handleChange}
                suppressHydrationWarning
              />
              {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
            </div>

            {/* ── Email with real-time MX check ── */}
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>Email address</label>
              <div className={styles.inputWrap}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`input-field ${styles.inputWithIcon} ${
                    emailStatus === "invalid" || errors.email ? "error" :
                    emailStatus === "valid" ? styles.inputValid : ""
                  }`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  suppressHydrationWarning
                />
                <span className={styles.inputIcon}><EmailIcon /></span>
              </div>
              {emailStatus === "checking" && (
                <span className={styles.fieldHint}>Verifying email domain…</span>
              )}
              {emailStatus === "valid" && (
                <span className={styles.fieldSuccess}>✓ Email domain verified</span>
              )}
              {(errors.email && emailStatus !== "checking") && (
                <span className={styles.fieldError}>{errors.email}</span>
              )}
            </div>

            {/* ── Password with rules checklist ── */}
            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`input-field ${styles.inputWithIcon} ${errors.password ? "error" : ""}`}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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

              {/* Strength bar */}
              {form.password && (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthBar}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <div
                        key={n}
                        className={styles.strengthSegment}
                        style={{ background: n <= strengthScore ? strengthColor : "var(--color-hairline)" }}
                      />
                    ))}
                  </div>
                  <span className={styles.strengthLabel} style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
              )}

              {/* Rules checklist — shown when focused or password has content */}
              {(passwordFocused || form.password) && (
                <ul className={`${styles.rulesList} animate-fade-in`}>
                  {PASSWORD_RULES.map((rule, i) => (
                    <li
                      key={rule.id}
                      className={`${styles.ruleItem} ${passedRules[i] ? styles.rulePassed : styles.ruleFailed}`}
                    >
                      <span className={styles.ruleIcon}>{passedRules[i] ? "✓" : "○"}</span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              )}

              {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
            </div>

            {/* ── Confirm password ── */}
            <div className={styles.fieldGroup}>
              <label htmlFor="confirm" className={styles.label}>Confirm password</label>
              <div className={styles.inputWrap}>
                <input
                  id="confirm"
                  name="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className={`input-field ${styles.inputWithIcon} ${
                    errors.confirm ? "error" :
                    form.confirm && form.confirm === form.password ? styles.inputValid : ""
                  }`}
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={handleChange}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowConfirm(v => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
              {form.confirm && form.confirm === form.password && (
                <span className={styles.fieldSuccess}>✓ Passwords match</span>
              )}
              {errors.confirm && <span className={styles.fieldError}>{errors.confirm}</span>}
            </div>

            <button
              id="register-submit"
              type="submit"
              className={`btn btn-primary btn-primary-full ${styles.submitBtn}`}
              disabled={loading || emailStatus === "checking"}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? "Creating account…" :
               emailStatus === "checking" ? "Verifying email…" :
               "Create account"}
            </button>
          </form>

          <p className={styles.terms}>
            By creating an account you agree to our{" "}
            <a href="#" className={styles.termsLink}>Terms of Service</a>{" "}
            and{" "}
            <a href="#" className={styles.termsLink}>Privacy Policy</a>.
          </p>

          <p className={styles.switchRow}>
            Already have an account?{" "}
            <Link href="/login" className={styles.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
