"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Home, Bell, User, LogOut, Settings, Sun, Moon, Users, MessageCircle,
  Search, UserPlus, UserCheck, MapPin, Sparkles
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import styles from "./people.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserInfo {
  user_id: string; username: string;
  display_name: string | null; profile_picture: string | null;
  bio: string | null; followers_count?: number;
  is_following?: boolean; profile_color?: string | null;
}

interface Me {
  user_id: string; username: string;
  display_name: string | null; profile_picture: string | null;
  profile_color?: string | null;
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } });
}

function Avatar({ user, size = 40 }: { user: { display_name: string | null; username: string; profile_picture?: string | null; profile_color?: string | null } | null; size?: number }) {
  if (!user) return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--color-surface-soft)" }} />;
  const hasPic = !!user.profile_picture;
  const src = hasPic ? (user.profile_picture!.startsWith("http") ? user.profile_picture! : `${API}${user.profile_picture}`) : "";
  const inits = ((user.display_name || user.username) || "").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36, background: user.profile_color || "var(--color-block-lilac)" }}>
      {hasPic
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : inits}
    </div>
  );
}

function UserCard({ user, onFollow, onNavigate }: {
  user: UserInfo;
  onFollow: (id: string) => void;
  onNavigate: (username: string) => void;
}) {
  const [following, setFollowing] = useState(!!user.is_following);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/users/follow/${user.user_id}`, { method: "POST" });
      const d = await r.json();
      setFollowing(d.following);
      onFollow(user.user_id);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className={styles.userCard} onClick={() => onNavigate(user.username)}>
      <Avatar user={user} size={52} />
      <div className={styles.userCardInfo}>
        <div className={styles.userCardName}>{user.display_name || user.username}</div>
        <div className={styles.userCardHandle}>@{user.username}</div>
        {user.bio && <p className={styles.userCardBio}>{user.bio}</p>}
        {user.followers_count !== undefined && (
          <div className={styles.userCardStats}>
            <span><strong>{user.followers_count}</strong> followers</span>
          </div>
        )}
      </div>
      <button
        className={`${styles.followBtn} ${following ? styles.followingBtn : ""}`}
        onClick={handleFollow}
        disabled={loading}
      >
        {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserInfo[]>([]);
  const [suggested, setSuggested] = useState<UserInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);

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
        setMe(u);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadSuggested = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/users/who-to-follow`);
      const d = await r.json();
      setSuggested(d.users || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (me) loadSuggested();
  }, [me, loadSuggested]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setSearchMode(false); setResults([]); return; }
    setSearchMode(true);
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await authFetch(`${API}/api/users/search?q=${encodeURIComponent(trimmed)}`);
        const d = await r.json();
        setResults(d.users || []);
      } catch { /* ignore */ }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleDark = (v: boolean) => {
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", v ? "dark" : "light");
  };

  const handleLogout = () => { localStorage.removeItem("token"); router.push("/login"); };

  const handleFollow = () => {
    // Refresh suggestions after follow
    loadSuggested();
  };

  if (!me) {
    return <div className={styles.splash}><span className="spinner" /></div>;
  }

  const displayList = searchMode ? results : suggested;

  return (
    <div className={styles.shell}>
      {/* ── Left Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sideWordmark}>Social</div>
        <nav className={styles.sideNav}>
          <div className={styles.sideItem} onClick={() => router.push("/feed")}><Home size={20} /><span>Home</span></div>
          <div className={styles.sideItem}><Bell size={20} /><span>Notifications</span></div>
          <div className={`${styles.sideItem} ${styles.sideActive}`} onClick={() => router.push("/people")}><Users size={20} /><span>People</span></div>
          <div className={styles.sideItem} onClick={() => me && router.push(`/${me.username}`)}><User size={20} /><span>Profile</span></div>
          <div className={styles.sideItem}><MessageCircle size={20} /><span>Messages</span></div>
          <div className={styles.sideItem} onClick={() => router.push("/settings")}><Settings size={20} /><span>Settings</span></div>
        </nav>
        <div className={styles.sideFooter}>
          <div className={styles.darkToggleRow}>
            {dark ? <Moon size={16} /> : <Sun size={16} />}
            <Toggle checked={dark} onCheckedChange={toggleDark} />
          </div>
          {me && (
            <div className={styles.sideUser}>
              <Avatar user={me} size={36} />
              <div className={styles.sideUserText}>
                <span className={styles.sideUserName}>{me.display_name || me.username}</span>
                <span className={styles.sideUserHandle}>@{me.username}</span>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout}><LogOut size={16} /></button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {/* Hero Header */}
        <div className={styles.heroHeader}>
          <div className={styles.heroIcon}><Users size={28} /></div>
          <div>
            <h1 className={styles.pageTitle}>People</h1>
            <p className={styles.pageSubtitle}>Discover and connect with people on Social</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className={styles.searchWrap}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search by name or username..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              suppressHydrationWarning
            />
            {query && (
              <button className={styles.clearBtn} onClick={() => setQuery("")}>✕</button>
            )}
          </div>
        </div>

        {/* Section Label */}
        <div className={styles.sectionLabel}>
          {searchMode
            ? <><Search size={14} />{searching ? "Searching..." : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}</>
            : <><Sparkles size={14} />Suggested for you</>
          }
        </div>

        {/* Users List */}
        <div className={styles.userList}>
          {searching && (
            <div className={styles.loadingState}><span className="spinner" /></div>
          )}
          {!searching && displayList.length === 0 && (
            <div className={styles.emptyState}>
              {searchMode
                ? <>
                    <div className={styles.emptyIcon}><Search size={28} /></div>
                    <p className={styles.emptyTitle}>No users found</p>
                    <p className={styles.emptyHint}>Try a different name or username</p>
                  </>
                : <>
                    <div className={styles.emptyIcon}><Users size={28} /></div>
                    <p className={styles.emptyTitle}>You know everyone!</p>
                    <p className={styles.emptyHint}>Search to find more people to follow</p>
                  </>
              }
            </div>
          )}
          {!searching && displayList.map(u => (
            <UserCard
              key={u.user_id}
              user={u}
              onFollow={handleFollow}
              onNavigate={username => router.push(`/${username}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
