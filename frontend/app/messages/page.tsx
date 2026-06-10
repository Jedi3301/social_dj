"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Bell, User, LogOut, Settings, Sun, Moon, Users, MessageCircle } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import styles from "../settings/settings.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Me { user_id: string; username: string; display_name: string | null; profile_picture: string | null; }

export default function MessagesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (!u) router.push("/login"); else setMe(u); })
      .catch(() => router.push("/login"));
  }, [router]);

  const toggleDark = (v: boolean) => {
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", v ? "dark" : "light");
  };

  const handleLogout = () => { localStorage.removeItem("token"); router.push("/login"); };

  if (!me) return <div className={styles.splash}><span className="spinner" /></div>;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sideWordmark}>Social</div>
        <nav className={styles.sideNav}>
          <div className={styles.sideItem} onClick={() => router.push("/feed")}><Home size={20} /><span>Home</span></div>
          <div className={styles.sideItem}><Bell size={20} /><span>Notifications</span></div>
          <div className={styles.sideItem} onClick={() => router.push("/people")}><Users size={20} /><span>People</span></div>
          <div className={styles.sideItem} onClick={() => router.push(`/${me.username}`)}><User size={20} /><span>Profile</span></div>
          <div className={`${styles.sideItem} ${styles.sideActive}`}><MessageCircle size={20} /><span>Messages</span></div>
          <div className={styles.sideItem} onClick={() => router.push("/settings")}><Settings size={20} /><span>Settings</span></div>
        </nav>
        <div className={styles.sideFooter}>
          <div className={styles.darkToggleRow}>
            {dark ? <Moon size={16} /> : <Sun size={16} />}
            <Toggle checked={dark} onCheckedChange={toggleDark} />
          </div>
          <div className={styles.sideUser}>
            <div className={styles.sideAvatarSmall} style={{ background: "var(--color-block-lilac)" }}>
              {me.display_name?.[0] || me.username[0]}
            </div>
            <div className={styles.sideUserText}>
              <span className={styles.sideUserName}>{me.display_name || me.username}</span>
              <span className={styles.sideUserHandle}>@{me.username}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Messages</h1>
          <p className={styles.pageSubtitle}>Chat with your connections</p>
        </div>

        {/* Coming Soon */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 32px", gap: 16, textAlign: "center"
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: "var(--color-block-mint)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 8
          }}>
            <MessageCircle size={36} color="var(--color-ink)" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-ink)", margin: 0 }}>Coming Soon</h2>
          <p style={{ fontSize: 15, color: "var(--color-ink)", opacity: 0.55, margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
            Direct messaging is under construction. Stay tuned — it&apos;ll be worth the wait.
          </p>
          <button
            onClick={() => router.push("/feed")}
            style={{
              marginTop: 16, padding: "10px 24px", borderRadius: 100,
              background: "var(--color-ink)", color: "var(--color-canvas)",
              border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            Back to Feed
          </button>
        </div>
      </main>
    </div>
  );
}
