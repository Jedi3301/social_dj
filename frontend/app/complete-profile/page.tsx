"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import styles from "./complete-profile.module.css";

const STEPS = ["Name", "Display", "Bio"] as const;

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    displayname: "",
    bio: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => firstRef.current?.focus(), 600);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: "" }));
    if (serverError) setServerError("");
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (currentStep === 0) {
      if (!form.firstname.trim()) e.firstname = "First name is required.";
      if (!form.lastname.trim()) e.lastname = "Last name is required.";
    }
    return e;
  };

  const next = () => {
    const v = validateStep();
    if (Object.keys(v).length) { setErrors(v); return; }
    setCurrentStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => setCurrentStep(s => Math.max(s - 1, 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerError("");
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    try {
      const res = await fetch(`${API}/api/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstname: form.firstname,
          lastname: form.lastname,
          displayname: form.displayname || undefined,
          bio: form.bio || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save profile");
      router.push("/dashboard");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className={styles.shell}>
      {/* Background decoration */}
      <div className={styles.bgDecor}>
        <div className={`${styles.bgBlob} ${styles.blob1}`} />
        <div className={`${styles.bgBlob} ${styles.blob2}`} />
        <div className={`${styles.bgBlob} ${styles.blob3}`} />
      </div>

      <div className={`${styles.card} ${mounted ? "animate-scale-in" : ""}`}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <span className={styles.wordmark}>Social</span>
          <div className={styles.stepBadge}>
            <span className="type-caption">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step tabs */}
        <div className={styles.stepTabs}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`${styles.stepTab} ${i === currentStep ? styles.stepTabActive : ""} ${i < currentStep ? styles.stepTabDone : ""}`}
            >
              <span className={styles.stepTabDot}>
                {i < currentStep ? "✓" : i + 1}
              </span>
              <span className={styles.stepTabLabel}>{s}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className={styles.cardBody}>
          {serverError && (
            <div className={`alert-error animate-fade-in ${styles.alertBox}`}>{serverError}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Step 0 — Name */}
            {currentStep === 0 && (
              <div className={`${styles.stepContent} animate-fade-up`}>
                <div className={`${styles.stepHero} color-block color-block-lilac`}>
                  <p className="type-caption" style={{ marginBottom: "var(--spacing-xs)" }}>First things first</p>
                  <h2 className="type-headline">What should we call you?</h2>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="firstname" className={styles.label}>First name</label>
                    <input
                      ref={firstRef}
                      id="firstname"
                      name="firstname"
                      type="text"
                      className={`input-field ${errors.firstname ? "error" : ""}`}
                      placeholder="Alex"
                      value={form.firstname}
                      onChange={handleChange}
                      suppressHydrationWarning
                    />
                    {errors.firstname && <span className={styles.fieldError}>{errors.firstname}</span>}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="lastname" className={styles.label}>Last name</label>
                    <input
                      id="lastname"
                      name="lastname"
                      type="text"
                      className={`input-field ${errors.lastname ? "error" : ""}`}
                      placeholder="Rivera"
                      value={form.lastname}
                      onChange={handleChange}
                      suppressHydrationWarning
                    />
                    {errors.lastname && <span className={styles.fieldError}>{errors.lastname}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1 — Display name */}
            {currentStep === 1 && (
              <div className={`${styles.stepContent} animate-fade-up`}>
                <div className={`${styles.stepHero} color-block color-block-mint`}>
                  <p className="type-caption" style={{ marginBottom: "var(--spacing-xs)" }}>Your public identity</p>
                  <h2 className="type-headline">Choose a display name</h2>
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="displayname" className={styles.label}>
                    Display name <span className={styles.optionalTag}>optional</span>
                  </label>
                  <input
                    id="displayname"
                    name="displayname"
                    type="text"
                    className="input-field"
                    placeholder={`${form.firstname} ${form.lastname}`.trim() || "Your name"}
                    value={form.displayname}
                    onChange={handleChange}
                    suppressHydrationWarning
                  />
                  <p className={styles.hint}>
                    If left empty, we&apos;ll use &quot;{form.firstname} {form.lastname}&quot;.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2 — Bio */}
            {currentStep === 2 && (
              <div className={`${styles.stepContent} animate-fade-up`}>
                <div className={`${styles.stepHero} color-block color-block-cream`}>
                  <p className="type-caption" style={{ marginBottom: "var(--spacing-xs)" }}>Tell your story</p>
                  <h2 className="type-headline">Write a short bio</h2>
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="bio" className={styles.label}>
                    Bio <span className={styles.optionalTag}>optional</span>
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    className={`input-field ${styles.textareaField}`}
                    placeholder="A few words about you…"
                    value={form.bio}
                    onChange={handleChange}
                    maxLength={160}
                    rows={4}
                    suppressHydrationWarning
                  />
                  <div className={styles.charCount}>
                    <span>{form.bio.length}/160</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {currentStep > 0 && (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.backBtn}`}
                  onClick={prev}
                  disabled={loading}
                >
                  Back
                </button>
              )}

              {currentStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  id={`profile-next-${currentStep}`}
                  className={`btn btn-primary ${currentStep === 0 ? "btn-primary-full" : styles.nextBtn}`}
                  onClick={next}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  id="profile-submit"
                  className={`btn btn-primary ${styles.nextBtn}`}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" style={{ borderColor: "#fff", borderTopColor: "transparent" }} /> : null}
                  {loading ? "Saving…" : "Finish setup"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
