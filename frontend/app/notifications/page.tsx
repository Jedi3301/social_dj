"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Bell, User, LogOut, Sun, Moon, Search, Settings, Users, MessageCircle, Check, UserPlus, UserCheck
} from "lucide-react";
import { Toggle, GooeyFilter } from "@/components/ui/toggle";
import styles from "../feed/feed.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserInfo {
  user_id: string;
  username: string;
  display_name: string | null;
  profile_picture: string | null;
  profile_color?: string | null;
}

interface NotificationItemData {
  notification_id: string;
  notification_type: "like" | "comment" | "follow";
  is_read: boolean;
  created_at: string;
  updated_at: string;
  post_id: string | null;
  comment_id: string | null;
  sender_id: string;
  sender_username: string;
  sender_display_name: string | null;
  sender_profile_picture: string | null;
  sender_profile_color: string | null;
  post_content: string | null;
  comment_content: string | null;
  other_likes_count: number;
  is_following: boolean;
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(d).toLocaleDateString();
}

function initials(dn: string | null, un: string) {
  return (dn || un).split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function authFetch(url: string, opts: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } });
}

function Avatar({ user, size = 40 }: { user: { display_name: string | null; username: string; profile_picture?: string | null; profile_color?: string | null } | null; size?: number }) {
  if (!user) {
    return <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36 }} />;
  }
  const hasPic = !!user.profile_picture;
  const src = hasPic ? (user.profile_picture?.startsWith("http") || user.profile_picture?.startsWith("data:") ? user.profile_picture : `${API}${user.profile_picture}`) : "";
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36, overflow: "hidden", background: user.profile_color || "var(--color-block-lilac)" }}>
      {hasPic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials(user.display_name, user.username)
      )}
    </div>
  );
}

/* ── Notification Row Component ─────────────────────────── */
function NotificationRow({
  item,
  currentUserId,
  onNavigate,
  onFollowToggle
}: {
  item: NotificationItemData;
  currentUserId: string;
  onNavigate: (path: string) => void;
  onFollowToggle: (senderId: string, following: boolean) => void;
}) {
  const [followLoading, setFollowLoading] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowLoading(true);
    try {
      const r = await authFetch(`${API}/api/users/follow/${item.sender_id}`, { method: "POST" });
      const d = await r.json();
      onFollowToggle(item.sender_id, d.following);
    } catch { /* ignore */ }
    setFollowLoading(false);
  };

  const senderName = item.sender_display_name || item.sender_username;
  const senderUserObj = {
    username: item.sender_username,
    display_name: item.sender_display_name,
    profile_picture: item.sender_profile_picture,
    profile_color: item.sender_profile_color
  };

  // Build the text message dynamically based on notification type
  const renderText = () => {
    if (item.notification_type === "like") {
      if (item.other_likes_count > 0) {
        return (
          <>
            <span className={styles.notificationActorName}>{senderName}</span>
            {" and "}
            <span className={styles.notificationActorName}>
              {item.other_likes_count} other{item.other_likes_count > 1 ? "s" : ""}
            </span>
            {" liked your post."}
          </>
        );
      }
      return (
        <>
          <span className={styles.notificationActorName}>{senderName}</span>
          {" liked your post."}
        </>
      );
    } else if (item.notification_type === "comment") {
      return (
        <>
          <span className={styles.notificationActorName}>{senderName}</span>
          {" commented on your post."}
        </>
      );
    } else if (item.notification_type === "follow") {
      return (
        <>
          <span className={styles.notificationActorName}>{senderName}</span>
          {" followed you."}
        </>
      );
    }
    return null;
  };

  const handleClick = () => {
    if (item.post_id) {
      onNavigate(`/post/${item.post_id}`);
    } else {
      onNavigate(`/${item.sender_username}`);
    }
  };

  return (
    <div
      className={`${styles.notificationItem} ${!item.is_read ? styles.notificationUnread : ""}`}
      onClick={handleClick}
    >
      <div onClick={(e) => { e.stopPropagation(); onNavigate(`/${item.sender_username}`); }} style={{ cursor: "pointer" }}>
        <Avatar user={senderUserObj} size={42} />
      </div>

      <div className={styles.notificationContent}>
        <div className={styles.notificationText}>
          {renderText()}
        </div>
        <div className={styles.notificationMeta}>
          <span className={styles.notificationTime}>{timeAgo(item.created_at)}</span>
        </div>
        {item.notification_type === "like" && item.post_content && (
          <span className={styles.notificationSnippet}>
            &ldquo;{item.post_content}&rdquo;
          </span>
        )}
        {item.notification_type === "comment" && item.comment_content && (
          <span className={styles.notificationSnippet}>
            &ldquo;{item.comment_content}&rdquo;
          </span>
        )}
      </div>

      {item.notification_type === "follow" && String(item.sender_id) !== String(currentUserId) && (
        <div className={styles.notificationActionWrap}>
          <button
            className={`btn ${item.is_following ? "btn-secondary" : "btn-primary"} ${styles.notificationFollowBtn}`}
            onClick={handleFollow}
            disabled={followLoading}
          >
            {item.is_following ? <UserCheck size={13} /> : <UserPlus size={13} />}
            <span style={{ marginLeft: 4 }}>{item.is_following ? "Following" : "Follow"}</span>
          </button>
        </div>
      )}

      {!item.is_read && (
        <div className={styles.notificationDot} />
      )}
    </div>
  );
}

/* ── Suggestion Item (Right Sidebar) ─────────────────────── */
function SuggestionItem({ user, onNavigate }: { user: UserInfo; onNavigate: () => void }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/users/follow/${user.user_id}`, { method: "POST" });
      const d = await r.json();
      setFollowing(d.following);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className={styles.followItem} onClick={onNavigate} style={{ cursor: "pointer" }}>
      <Avatar user={user} size={32} />
      <div className={styles.followInfo}>
        <span className={styles.followName}>{user.display_name || user.username}</span>
        <span className={styles.followHandle}>@{user.username}</span>
      </div>
      <button
        className={`btn btn-secondary ${styles.followBtn}`}
        onClick={handleFollow}
        disabled={loading}
        style={following ? { opacity: 0.6 } : {}}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [trends, setTrends] = useState<{ id: number; category: string; name: string; count: string }[]>([]);
  const [suggestions, setSuggestions] = useState<UserInfo[]>([]);

  // Persist dark mode
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  const toggleDark = (v: boolean) => {
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", v ? "dark" : "light");
  };

  // Auth check & unread count
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
    const t = localStorage.getItem("token") || "";
    if (!t) { router.push("/login"); return; }
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (!u) router.push("/login"); else setUser(u); })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const r = await authFetch(`${API}/api/notifications`);
      if (r.ok) {
        const d = await r.json();
        setNotifications(d.notifications || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSidebarData = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        authFetch(`${API}/api/trends`),
        authFetch(`${API}/api/users/who-to-follow`)
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      if (tData.trends) setTrends(tData.trends);
      if (sData.users) setSuggestions(sData.users);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
      fetchUnreadCount();
      loadSidebarData();

      // Poll count and updates
      const interval = setInterval(fetchUnreadCount, 15000);
      return () => clearInterval(interval);
    }
  }, [user, loadNotifications, fetchUnreadCount, loadSidebarData]);

  const handleMarkAllRead = async () => {
    try {
      const r = await authFetch(`${API}/api/notifications/mark-read`, { method: "POST" });
      if (r.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFollowToggle = (senderId: string, following: boolean) => {
    setNotifications(prev =>
      prev.map(n => {
        if (String(n.sender_id) === String(senderId)) {
          return { ...n, is_following: following };
        }
        return n;
      })
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  if (!user) {
    return (
      <div className={styles.splashLoad}>
        <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <GooeyFilter />

      {/* ── Left Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sideWordmark}>Social</div>
        <nav className={styles.sideNav}>
          <div className={styles.sideItem} onClick={() => router.push("/feed")}>
            <Home size={20} /><span>Home</span>
          </div>
          <div className={`${styles.sideItem} ${styles.sideActive}`} onClick={() => router.push("/notifications")}>
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
          <div className={styles.sideItem} onClick={() => router.push("/people")}>
            <Users size={20} /><span>People</span>
          </div>
          <div className={styles.sideItem} onClick={() => router.push(`/${user.username}`)}>
            <User size={20} /><span>Profile</span>
          </div>
          <div className={styles.sideItem} onClick={() => router.push("/messages")}>
            <MessageCircle size={20} /><span>Messages</span>
          </div>
          <div className={styles.sideItem} onClick={() => router.push("/settings")}>
            <Settings size={20} /><span>Settings</span>
          </div>
        </nav>

        <div className={styles.sideFooter}>
          <div className={styles.darkToggleRow}>
            {dark ? <Moon size={16} /> : <Sun size={16} />}
            <Toggle checked={dark} onCheckedChange={toggleDark} />
          </div>
          <div className={styles.sideUser}>
            <Avatar user={user} size={36} />
            <div className={styles.sideUserText}>
              <span className={styles.sideUserName}>{user.display_name || user.username}</span>
              <span className={styles.sideUserHandle}>@{user.username}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* ── Main Notifications Column ── */}
      <main className={styles.feedMain}>
        <div className={styles.mobileBar}>
          <span className={styles.mobileWordmark}>Notifications</span>
          <div className={styles.mobileRight}>
            <Toggle checked={dark} onCheckedChange={toggleDark} />
          </div>
        </div>

        <div className={styles.notificationsHeader}>
          <h1 className={styles.notificationsTitle}>Notifications</h1>
          {unreadCount > 0 && (
            <button className={styles.markReadBtn} onClick={handleMarkAllRead}>
              <Check size={14} />Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.feedLoader}><span className="spinner" /></div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={`color-block color-block-lime ${styles.emptyBlock}`} style={{ textAlign: "center" }}>
              <Bell size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
              <h2 className="type-headline">No notifications yet</h2>
              <p className="type-caption" style={{ opacity: 0.6 }}>When people like, comment on, or follow you, it will show up here.</p>
            </div>
          </div>
        ) : (
          <div className={styles.notificationsList}>
            {notifications.map(n => (
              <NotificationRow
                key={n.notification_id}
                item={n}
                currentUserId={user.user_id}
                onNavigate={(path) => router.push(path)}
                onFollowToggle={handleFollowToggle}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Right sidebar ── */}
      <aside className={styles.rightSidebar}>
        {/* Search */}
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search Social..." className={styles.searchInput} suppressHydrationWarning />
        </div>

        {/* Trending */}
        <div className={styles.trendsCard}>
          <h3 className={styles.trendsTitle}>What&apos;s happening</h3>
          {trends.length === 0 ? (
            <div className={styles.trendItem}><span className={styles.trendName} style={{ color: "var(--color-ink)", opacity: 0.5, fontWeight: 400 }}>No trends right now</span></div>
          ) : trends.map(t => (
            <div key={t.id} className={styles.trendItem}>
              <span className={styles.trendCategory}>{t.category}</span>
              <span className={styles.trendName}>{t.name}</span>
              <span className={styles.trendCount}>{t.count} posts</span>
            </div>
          ))}
        </div>

        {/* Who to follow */}
        <div className={styles.followCard}>
          <h3 className={styles.followTitle}>Who to follow</h3>
          {suggestions.length === 0 ? (
             <div className={styles.followItem}><span className={styles.followName} style={{ color: "var(--color-ink)", opacity: 0.5, fontWeight: 400 }}>No suggestions</span></div>
          ) : suggestions.map(u => (
            <SuggestionItem key={u.user_id} user={u} onNavigate={() => router.push(`/${u.username}`)} />
          ))}
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className={styles.bottomNav}>
        <button className={styles.bottomBtn} onClick={() => router.push("/feed")}><Home size={22} /></button>
        <button className={`${styles.bottomBtn} ${styles.bottomActive}`} onClick={() => router.push("/notifications")}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Bell size={22} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -3, right: -3,
                background: "#e74c3c", color: "white",
                borderRadius: "100%", width: 14, height: 14,
                fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center",
                justifyContent: "center", border: "1.5px solid var(--color-canvas)"
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        </button>
        <button className={styles.bottomBtn} onClick={() => router.push(`/${user.username}`)}><User size={22} /></button>
        <button className={styles.bottomBtn} onClick={handleLogout}><LogOut size={22} /></button>
      </nav>
    </div>
  );
}
