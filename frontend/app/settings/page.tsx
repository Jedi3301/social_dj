"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Bell, User, LogOut, Settings, Sun, Moon, Users, MessageCircle,
  Camera, Save, AlertCircle, CheckCircle, ChevronRight, Lock, Mail, AtSign, Palette
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import styles from "./settings.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserInfo {
  user_id: string; username: string; email: string;
  display_name: string | null; profile_picture: string | null;
  bio: string | null; profile_color: string | null;
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } });
}

const PALETTE_COLORS = [
  { label: "Lilac", value: "#c8b8f0" },
  { label: "Mint", value: "#b8f0d8" },
  { label: "Peach", value: "#f0d8b8" },
  { label: "Sky", value: "#b8d8f0" },
  { label: "Rose", value: "#f0b8c8" },
  { label: "Lime", value: "#d8f0b8" },
  { label: "Cream", value: "#f5f0e0" },
  { label: "Slate", value: "#1e293b" },
];

type Tab = "profile" | "account" | "appearance";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [dark, setDark] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const picRef = useRef<HTMLInputElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/notifications/unread-count`);
      if (r.ok) {
        const d = await r.json();
        setUnreadCount(d.count || 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 10000);
      return () => clearInterval(interval);
    }
  }, [user, fetchUnreadCount]);

  // Profile form
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [picFile, setPicFile] = useState<File | null>(null);

  // Account form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) { router.push("/login"); return; }
        setUser(u);
        setDisplayName(u.display_name || "");
        setBio(u.bio || "");
        setUsername(u.username || "");
        setEmail(u.email || "");
        setSelectedColor(u.profile_color || "");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const toggleDark = (v: boolean) => {
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", v ? "dark" : "light");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handlePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPicFile(file);
    setPicPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    setSaving(true); setStatus(null);
    const fd = new FormData();
    fd.append("display_name", displayName);
    fd.append("bio", bio);
    if (picFile) fd.append("profile_picture", picFile);
    try {
      const r = await authFetch(`${API}/api/users/settings/profile`, { method: "PATCH", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setUser(prev => prev ? { ...prev, ...d.profile } : d.profile);
      setPicPreview(null);
      setPicFile(null);
      setStatus({ type: "success", msg: "Profile updated successfully!" });
    } catch (err: unknown) {
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const saveProfileColor = async () => {
    setSavingColor(true); setStatus(null);
    const fd = new FormData();
    fd.append("profile_color", selectedColor);
    try {
      const r = await authFetch(`${API}/api/users/settings/profile`, { method: "PATCH", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setUser(prev => prev ? { ...prev, ...d.profile } : d.profile);
      setStatus({ type: "success", msg: "Accent color updated successfully!" });
    } catch (err: unknown) {
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Color update failed" });
    } finally {
      setSavingColor(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const saveAccount = async () => {
    setSaving(true); setStatus(null);
    try {
      const r = await authFetch(`${API}/api/users/settings/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setUser(prev => prev ? { ...prev, ...d.profile } : d.profile);
      setStatus({ type: "success", msg: "Account details updated!" });
    } catch (err: unknown) {
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const avatarSrc = picPreview || (user?.profile_picture
    ? (user.profile_picture.startsWith("http") || user.profile_picture.startsWith("data:") ? user.profile_picture : `${API}${user.profile_picture}`)
    : null);

  const initials = (u: UserInfo) =>
    ((u.display_name || u.username) || "").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  if (!user) {
    return (
      <div className={styles.splash}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {/* ── Left Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sideWordmark}>Social</div>
        <nav className={styles.sideNav}>
          <div className={styles.sideItem} onClick={() => router.push("/feed")}><Home size={20} /><span>Home</span></div>
          <div className={styles.sideItem} onClick={() => router.push("/notifications")}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  background: "#e74c3c", color: "white",
                  borderRadius: "100%", width: 15, height: 15,
                  fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", border: "1.5px solid var(--color-canvas)"
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span>Notifications</span>
          </div>
          <div className={styles.sideItem} onClick={() => router.push("/people")}><Users size={20} /><span>People</span></div>
          <div className={styles.sideItem} onClick={() => router.push(`/${user.username}`)}><User size={20} /><span>Profile</span></div>
          <div className={styles.sideItem} onClick={() => router.push("/messages")}><MessageCircle size={20} /><span>Messages</span></div>
          <div className={`${styles.sideItem} ${styles.sideActive}`} onClick={() => router.push("/settings")}><Settings size={20} /><span>Settings</span></div>
        </nav>
        <div className={styles.sideFooter}>
          <div className={styles.darkToggleRow}>
            {dark ? <Moon size={16} /> : <Sun size={16} />}
            <Toggle checked={dark} onCheckedChange={toggleDark} />
          </div>
          <div className={styles.sideUser}>
            <div className={styles.sideAvatarSmall} style={{ background: selectedColor || "var(--color-block-lilac)" }}>
              {avatarSrc ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials(user)}
            </div>
            <div className={styles.sideUserText}>
              <span className={styles.sideUserName}>{user.display_name || user.username}</span>
              <span className={styles.sideUserHandle}>@{user.username}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>Manage your account and preferences</p>
        </div>

        {/* Status Banner */}
        {status && (
          <div className={`${styles.statusBanner} ${styles[status.type]}`}>
            {status.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{status.msg}</span>
          </div>
        )}

        <div className={styles.content}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {([["profile", "Profile", <Palette size={16} key="p" />], ["account", "Account", <AtSign size={16} key="a" />], ["appearance", "Appearance", <Sun size={16} key="ap" />]] as const).map(([tab, label, icon]) => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab as Tab)}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* ── Profile Tab ── */}
          {activeTab === "profile" && (
            <div className={styles.tabContent}>
              {/* Avatar section */}
              <div className={styles.avatarSection}>
                <div
                  className={styles.avatarLarge}
                  style={{ background: selectedColor || "var(--color-block-lilac)" }}
                  onClick={() => picRef.current?.click()}
                >
                  {avatarSrc
                    ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    : <span className={styles.avatarInitials}>{initials(user)}</span>}
                  <div className={styles.avatarOverlay}><Camera size={20} /></div>
                </div>
                <input ref={picRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePicChange} />
                <div>
                  <p className={styles.avatarHint}>Click avatar to change photo</p>
                  <p className={styles.avatarHint2}>JPG, PNG or GIF · Max 10MB</p>
                </div>
              </div>

              {/* Fields */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Display Name</label>
                <input
                  className={styles.input}
                  placeholder="Your name..."
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Bio</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Tell people about yourself..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                />
                <span className={styles.charCount}>{bio.length}/160</span>
              </div>

              {/* Color Palette */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Profile Color</label>
                <p className={styles.hint}>Customize the accent color on your profile</p>
                <div className={styles.palette}>
                  {PALETTE_COLORS.map(c => (
                    <button
                      key={c.value}
                      className={`${styles.paletteChip} ${selectedColor === c.value ? styles.paletteChipActive : ""}`}
                      style={{ background: c.value }}
                      onClick={() => setSelectedColor(c.value)}
                      title={c.label}
                    />
                  ))}
                  <button
                    className={`${styles.paletteChip} ${!selectedColor ? styles.paletteChipActive : ""}`}
                    style={{ background: "linear-gradient(135deg, #c8b8f0, #b8f0d8, #f0d8b8)" }}
                    onClick={() => setSelectedColor("")}
                    title="Default"
                  />
                </div>
                <button className={styles.saveBtn} onClick={saveProfileColor} disabled={savingColor} style={{ marginTop: "8px", padding: "10px 20px", fontSize: "14px" }}>
                  {savingColor ? <span className="spinner" /> : <Save size={14} />}
                  {savingColor ? "Saving Color..." : "Save Color"}
                </button>
              </div>

              <button className={styles.saveBtn} onClick={saveProfile} disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={16} />}
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          )}

          {/* ── Account Tab ── */}
          {activeTab === "account" && (
            <div className={styles.tabContent}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                  <AtSign size={18} />
                  <h3>Username & Email</h3>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Username</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputPrefix}>@</span>
                    <input className={`${styles.input} ${styles.inputWithPrefix}`} value={username} onChange={e => setUsername(e.target.value)} />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Email Address</label>
                  <div className={styles.inputWrap}>
                    <Mail size={15} className={styles.inputIcon} />
                    <input className={`${styles.input} ${styles.inputWithPrefix}`} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
                <button className={styles.saveBtn} onClick={saveAccount} disabled={saving}>
                  {saving ? <span className="spinner" /> : <Save size={16} />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div className={styles.sectionCard} style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.03)" }}>
                <div className={styles.sectionCardHeader}>
                  <Lock size={18} style={{ color: "#ef4444" }} />
                  <h3 style={{ color: "#ef4444" }}>Danger Zone</h3>
                </div>
                <p className={styles.dangerText}>These actions are irreversible. Please be certain.</p>
                <div className={styles.dangerActions}>
                  <button className={styles.dangerBtn} onClick={handleLogout}>
                    <LogOut size={14} />Sign out of all devices
                    <ChevronRight size={14} className={styles.chevron} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Appearance Tab ── */}
          {activeTab === "appearance" && (
            <div className={styles.tabContent}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                  {dark ? <Moon size={18} /> : <Sun size={18} />}
                  <h3>Theme</h3>
                </div>
                <div className={styles.themeRow}>
                  <div className={`${styles.themeOption} ${!dark ? styles.themeActive : ""}`} onClick={() => toggleDark(false)}>
                    <div className={styles.themePreview} style={{ background: "#f5f5f5" }}>
                      <div style={{ background: "#fff", borderRadius: 8, padding: 8, display: "flex", gap: 6 }}>
                        <div style={{ background: "#e5e5e5", width: 32, height: 8, borderRadius: 4 }} />
                        <div style={{ background: "#d5d5d5", width: 20, height: 8, borderRadius: 4 }} />
                      </div>
                    </div>
                    <span className={styles.themeLabel}><Sun size={14} />Light</span>
                  </div>
                  <div className={`${styles.themeOption} ${dark ? styles.themeActive : ""}`} onClick={() => toggleDark(true)}>
                    <div className={styles.themePreview} style={{ background: "#0f172a" }}>
                      <div style={{ background: "#1e293b", borderRadius: 8, padding: 8, display: "flex", gap: 6 }}>
                        <div style={{ background: "#334155", width: 32, height: 8, borderRadius: 4 }} />
                        <div style={{ background: "#475569", width: 20, height: 8, borderRadius: 4 }} />
                      </div>
                    </div>
                    <span className={styles.themeLabel}><Moon size={14} />Dark</span>
                  </div>
                </div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                  <Bell size={18} />
                  <h3>Notifications</h3>
                </div>
                <div className={styles.toggleRow}>
                  <div>
                    <p className={styles.toggleLabel}>New followers</p>
                    <p className={styles.toggleSub}>When someone follows you</p>
                  </div>
                  <Toggle checked={true} onCheckedChange={() => {}} />
                </div>
                <div className={styles.toggleRow}>
                  <div>
                    <p className={styles.toggleLabel}>Likes on your posts</p>
                    <p className={styles.toggleSub}>When someone likes your content</p>
                  </div>
                  <Toggle checked={true} onCheckedChange={() => {}} />
                </div>
                <div className={styles.toggleRow}>
                  <div>
                    <p className={styles.toggleLabel}>Comments</p>
                    <p className={styles.toggleSub}>When someone comments on your posts</p>
                  </div>
                  <Toggle checked={true} onCheckedChange={() => {}} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
