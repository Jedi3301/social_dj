"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, MessageCircle, Share2, Trash2, Home, Bell, User, LogOut, Sun, Moon, Search, MapPin, Link as LinkIcon, MoreHorizontal, Send
} from "lucide-react";
import { Toggle, GooeyFilter } from "@/components/ui/toggle";
import styles from "../feed/feed.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserInfo { user_id: string; username: string; display_name: string | null; profile_picture: string | null; bio?: string; location?: string; website?: string; }
interface Post extends UserInfo { post_id: string; content: string | null; post_type: string; media_urls: string[]; created_at: string; like_count: number; comment_count: number; liked_by_me: boolean; }
interface Comment { comment_id: string; user_id: string; username: string; display_name: string | null; content: string; created_at: string; like_count: number; liked_by_me: boolean; parent_comment_id: string | null; replies: Comment[]; }

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(d).toLocaleDateString();
}
function initials(dn: string | null, un: string) { return (dn || un).split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase(); }
function authFetch(url: string, opts: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } });
}

function Avatar({ user, size = 40 }: { user: Pick<UserInfo, "display_name" | "username" | "profile_picture">; size?: number }) {
  const hasPic = !!user.profile_picture;
  const src = hasPic ? (user.profile_picture?.startsWith("http") ? user.profile_picture : `${API}${user.profile_picture}`) : "";
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36, overflow: "hidden" }}>
      {hasPic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials(user.display_name, user.username)
      )}
    </div>
  );
}

function MediaGrid({ urls, type }: { urls: string[]; type: string }) {
  if (!urls.length) return null;
  const isVid = (u: string) => /\.(mp4|webm|ogg|mov)$/i.test(u);
  return (
    <div className={`${styles.mediaGrid} ${styles[`mg${Math.min(urls.length, 4)}`]}`}>
      {urls.slice(0, 4).map((u, i) =>
        isVid(u) || type === "video"
          ? <video key={i} src={`${API}${u}`} controls className={styles.mediaItem} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={i} src={`${API}${u}`} alt="" className={styles.mediaItem} />
      )}
    </div>
  );
}

/* ── Comment Item ─────────────────────────────────────────── */
function CommentItem({ comment, postId, currentUserId, depth = 0, onDelete, onUpdate }: {
  comment: Comment; postId: string; currentUserId: string; depth?: number;
  onDelete: (id: string, parentId: string | null) => void;
  onUpdate: (id: string, data: Partial<Comment>) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);

  const toggleLike = async () => {
    const r = await authFetch(`${API}/api/feed/comments/${comment.comment_id}/like`, { method: "POST" });
    const d = await r.json();
    onUpdate(comment.comment_id, { liked_by_me: d.liked, like_count: d.like_count });
  };

  const submitReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    const r = await authFetch(`${API}/api/feed/posts/${postId}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: replyText.trim(), parent_comment_id: comment.comment_id }),
    });
    if (r.ok) { const c: Comment = await r.json(); onUpdate(comment.comment_id, { replies: [...comment.replies, { ...c, replies: [] }] }); setReplyText(""); setReplyOpen(false); }
    setPosting(false);
  };

  const name = comment.display_name || comment.username;
  return (
    <div className={`${styles.commentItem} ${depth > 0 ? styles.commentNested : ""}`}>
      <Avatar user={comment} size={depth > 0 ? 26 : 32} />
      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>{name}</span>
          <span className={styles.commentTime}>· {timeAgo(comment.created_at)}</span>
          {comment.user_id === currentUserId && (
            <button className={styles.commentDelete} onClick={() => onDelete(comment.comment_id, comment.parent_comment_id)}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
        <p className={styles.commentText}>{comment.content}</p>
        <div className={styles.commentFooter}>
          <button className={`${styles.commentAction} ${comment.liked_by_me ? styles.cLiked : ""}`} onClick={toggleLike}>
            <Heart size={13} fill={comment.liked_by_me ? "currentColor" : "none"} />
            {comment.like_count > 0 && <span>{comment.like_count}</span>}
          </button>
          {depth < 2 && (
            <button className={styles.commentAction} onClick={() => setReplyOpen(o => !o)}>Reply</button>
          )}
        </div>
        {replyOpen && (
          <div className={styles.replyRow}>
            <input className={styles.replyInput} placeholder={`Reply to ${name}…`} value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(); } }} />
            <button className={styles.replyBtn} onClick={submitReply} disabled={posting || !replyText.trim()}>
              <Send size={14} />
            </button>
          </div>
        )}
        {comment.replies.map(r => (
          <CommentItem key={r.comment_id} comment={r} postId={postId} currentUserId={currentUserId}
            depth={depth + 1} onDelete={onDelete} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

/* ── Comments Panel ───────────────────────────────────────── */
function CommentsPanel({ post, currentUser }: { post: Post; currentUser: UserInfo }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    authFetch(`${API}/api/feed/posts/${post.post_id}/comments`)
      .then(r => r.json()).then(d => { setComments(d.comments || []); setLoading(false); });
  }, [post.post_id]);

  const submit = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const r = await authFetch(`${API}/api/feed/posts/${post.post_id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (r.ok) { const c: Comment = await r.json(); setComments(p => [{ ...c, replies: [] }, ...p]); setText(""); }
    setPosting(false);
  };

  const handleDelete = useCallback((id: string, parentId: string | null) => {
    authFetch(`${API}/api/feed/comments/${id}`, { method: "DELETE" });
    if (!parentId) setComments(p => p.filter(c => c.comment_id !== id));
    else setComments(p => p.map(c => ({ ...c, replies: c.replies.filter(r => r.comment_id !== id) })));
  }, []);

  const handleUpdate = useCallback((id: string, data: Partial<Comment>) => {
    setComments(prev => prev.map(c => {
      if (c.comment_id === id) return { ...c, ...data };
      return { ...c, replies: c.replies.map(r => r.comment_id === id ? { ...r, ...data } : r) };
    }));
  }, []);

  return (
    <div className={styles.commentsPanel}>
      <div className={styles.commentInputRow}>
        <Avatar user={currentUser} size={30} />
        <div className={styles.commentInputBox}>
          <input className={styles.commentInput} placeholder="Add a comment…" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <button className={styles.commentSend} onClick={submit} disabled={posting || !text.trim()}>
            <Send size={15} />
          </button>
        </div>
      </div>
      {loading ? <div className={styles.cLoading}><span className="spinner" /></div>
        : comments.length === 0 ? <p className={styles.noComments}>No comments yet. Be first!</p>
          : <div className={styles.commentList}>{comments.map(c => (
            <CommentItem key={c.comment_id} comment={c} postId={post.post_id}
              currentUserId={String(currentUser.user_id)}
              onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}</div>}
    </div>
  );
}

// Full PostCard matching feed/page.tsx
function PostCard({ post: init, currentUser, onDelete }: { post: Post; currentUser: UserInfo; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [post, setPost] = useState(init);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liking, setLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleLike = async () => {
    if (liking) return; setLiking(true);
    setPost(p => ({ ...p, liked_by_me: !p.liked_by_me, like_count: p.liked_by_me ? p.like_count - 1 : p.like_count + 1 }));
    const r = await authFetch(`${API}/api/feed/posts/${post.post_id}/like`, { method: "POST" });
    const d = await r.json();
    setPost(p => ({ ...p, liked_by_me: d.liked, like_count: d.like_count }));
    setLiking(false);
  };

  const doDelete = async () => {
    await authFetch(`${API}/api/feed/posts/${post.post_id}`, { method: "DELETE" });
    onDelete(post.post_id);
  };

  const isOwn = String(post.user_id) === String(currentUser.user_id);
  const name = post.display_name || post.username;

  return (
    <article className={styles.postCard}>
      <div className={styles.postTop}>
        <div onClick={() => router.push(`/${post.username}`)} style={{ cursor: "pointer" }}>
          <Avatar user={post} size={44} />
        </div>
        <div className={styles.postMeta} onClick={() => router.push(`/${post.username}`)} style={{ cursor: "pointer" }}>
          <span className={styles.postName}>{name}</span>
          <span className={styles.postHandle}>@{post.username} · {timeAgo(post.created_at)}</span>
        </div>
        {isOwn && (
          <div className={styles.menuWrap}>
            <button className={styles.menuTrigger} onClick={() => setMenuOpen(o => !o)}><MoreHorizontal size={18} /></button>
            {menuOpen && (
              <div className={styles.menuDrop}>
                <button className={styles.menuDeleteItem} onClick={() => { setMenuOpen(false); doDelete(); }}>
                  <Trash2 size={14} /> Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.content && <p className={styles.postContent}>{post.content}</p>}
      {post.media_urls?.length > 0 && <MediaGrid urls={post.media_urls} type={post.post_type} />}

      <div className={styles.postActions}>
        <button className={`${styles.actionBtn} ${post.liked_by_me ? styles.likedBtn : ""}`} onClick={toggleLike}>
          <Heart size={18} fill={post.liked_by_me ? "currentColor" : "none"} strokeWidth={post.liked_by_me ? 0 : 2} />
          {post.like_count > 0 && <span>{post.like_count}</span>}
        </button>
        <button className={`${styles.actionBtn} ${commentsOpen ? styles.activeBtn : ""}`} onClick={() => setCommentsOpen(o => !o)}>
          <MessageCircle size={18} />
          {post.comment_count > 0 && <span>{post.comment_count}</span>}
        </button>
        <button className={styles.actionBtn} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/post/${post.post_id}`)}>
          <Share2 size={18} />
        </button>
      </div>

      {commentsOpen && <CommentsPanel post={post} currentUser={currentUser} />}
    </article>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const targetUsername = params.username as string;

  const [user, setUser] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<UserInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [dark, setDark] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const [trends, setTrends] = useState<{ id: number; category: string; name: string; count: string }[]>([]);
  const [suggestions, setSuggestions] = useState<UserInfo[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
  }, []);

  const toggleDark = (v: boolean) => {
    setDark(v);
    localStorage.setItem("theme", v ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", v ? "dark" : "light");
  };

  useEffect(() => {
    const t = localStorage.getItem("token") || "";
    if (!t) { router.push("/login"); return; }
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (!u) router.push("/login"); else setUser(u); })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadProfile = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/users/profile/${targetUsername}`);
      if (r.ok) {
        const d = await r.json();
        setProfile(d.profile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error(err);
    }
  }, [targetUsername]);

  const loadPosts = useCallback(async (p: number) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    const r = await authFetch(`${API}/api/users/profile/${targetUsername}/posts?page=${p}&limit=15`);
    const d = await r.json();
    setPosts(prev => p === 1 ? (d.posts || []) : [...prev, ...(d.posts || [])]);
    setHasMore(d.hasMore); setPage(p);
    if (p === 1) setLoading(false); else setLoadingMore(false);
  }, [targetUsername]);

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
    if (user && targetUsername) {
      loadProfile();
      loadPosts(1); 
      loadSidebarData();
    }
  }, [user, targetUsername, loadProfile, loadPosts, loadSidebarData]);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && profile) loadPosts(page + 1);
    }, { threshold: 0.5 });
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, page, loadPosts, profile]);

  const handleLogout = () => { localStorage.removeItem("token"); router.push("/login"); };

  if (!user) return (
    <div className={styles.splashLoad}>
      <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );

  return (
    <div className={styles.shell}>
      <GooeyFilter />

      {/* ── Left sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sideWordmark}>Social</div>
        <nav className={styles.sideNav}>
          <div className={styles.sideItem} onClick={() => router.push("/feed")}>
            <Home size={20} /><span>Home</span>
          </div>
          <div className={styles.sideItem}>
            <Bell size={20} /><span>Notifications</span>
          </div>
          <div className={`${styles.sideItem} ${user.username === targetUsername ? styles.sideActive : ""}`} onClick={() => router.push(`/${user.username}`)}>
            <User size={20} /><span>Profile</span>
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
            <button className={styles.logoutBtn} onClick={handleLogout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {/* ── Main Feed (Profile) ── */}
      <main className={styles.feedMain}>
        <div className={styles.mobileBar}>
          <span className={styles.mobileWordmark}>Social</span>
          <div className={styles.mobileRight}>
            <Toggle checked={dark} onCheckedChange={toggleDark} />
            <button className={styles.mobileLogout} onClick={handleLogout}><LogOut size={18} /></button>
          </div>
        </div>

        {profile && (
            <div style={{ padding: "32px 24px", borderBottom: "1px solid var(--color-hairline)" }}>
                <div style={{
                    background: "var(--color-block-lilac)",
                    borderRadius: "24px",
                    padding: "48px 32px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    color: "var(--color-ink)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                        <Avatar user={profile} size={86} />
                        <div>
                            <h1 className="type-display-lg" style={{ margin: 0 }}>{profile.display_name || profile.username}</h1>
                            <p className="type-body-lg" style={{ margin: 0, opacity: 0.7 }}>@{profile.username}</p>
                        </div>
                    </div>
                    {profile.bio && <p className="type-subhead" style={{ marginTop: "16px", marginBottom: "8px" }}>{profile.bio}</p>}
                </div>
            </div>
        )}

        {!profile && !loading ? (
            <div className={styles.emptyState}>
                <h2 className="type-headline">User not found</h2>
            </div>
        ) : loading ? (
          <div className={styles.feedLoader}><span className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={`color-block color-block-lime ${styles.emptyBlock}`}>
              <h2 className="type-headline">No posts yet</h2>
            </div>
          </div>
        ) : (
          <>
            {posts.map(p => (
              <PostCard key={p.post_id} post={p} currentUser={user}
                onDelete={id => setPosts(prev => prev.filter(p => p.post_id !== id))} />
            ))}
            <div ref={loaderRef} className={styles.loadMore}>
              {loadingMore && <span className="spinner" />}
              {!hasMore && posts.length > 0 && <p className={styles.endMsg}>You&apos;re all caught up ✓</p>}
            </div>
          </>
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
            <div key={u.user_id} className={styles.followItem} onClick={() => router.push(`/${u.username}`)} style={{ cursor: 'pointer' }}>
              <Avatar user={u} size={32} />
              <div className={styles.followInfo}>
                <span className={styles.followName}>{u.display_name || u.username}</span>
                <span className={styles.followHandle}>@{u.username}</span>
              </div>
              <button className={`btn btn-secondary ${styles.followBtn}`} onClick={(e) => { e.stopPropagation(); /* TODO: Follow action */ }}>Follow</button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className={styles.bottomNav}>
        <button className={styles.bottomBtn} onClick={() => router.push("/feed")}><Home size={22} /></button>
        <button className={styles.bottomBtn}><Bell size={22} /></button>
        <button className={`${styles.bottomBtn} ${user.username === targetUsername ? styles.bottomActive : ""}`} onClick={() => router.push(`/${user.username}`)}><User size={22} /></button>
        <button className={styles.bottomBtn} onClick={handleLogout}><LogOut size={22} /></button>
      </nav>
    </div>
  );
}
