"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, MessageCircle, Share2, Trash2, Home, Bell, User, LogOut, Sun, Moon, Search, MoreHorizontal, Send, Settings, Users, ArrowLeft
} from "lucide-react";
import { Toggle, GooeyFilter } from "@/components/ui/toggle";
import styles from "../../feed/feed.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserInfo { user_id: string; username: string; display_name: string | null; profile_picture: string | null; profile_color?: string | null; }
interface Post extends UserInfo { post_id: string; content: string | null; post_type: string; media_urls: string[]; created_at: string; like_count: number; comment_count: number; liked_by_me: boolean; }
interface Comment { comment_id: string; user_id: string; username: string; display_name: string | null; profile_picture?: string | null; profile_color?: string | null; content: string; created_at: string; like_count: number; liked_by_me: boolean; parent_comment_id: string | null; replies: Comment[]; }

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(d).toLocaleDateString();
}
function initials(dn: string | null, un: string) { return (dn || un).split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase(); }

function Avatar({ user, size = 40 }: { user: { display_name: string | null; username: string; profile_picture?: string | null; profile_color?: string | null } | null; size?: number }) {
  if (!user) {
    return (
      <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36 }} />
    );
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

function MediaGrid({ urls, type }: { urls: string[]; type: string }) {
  if (!urls.length) return null;
  const isVid = (u: string) => u.startsWith("data:video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(u);
  return (
    <div className={`${styles.mediaGrid} ${styles[`mg${Math.min(urls.length, 4)}`]}`}>
      {urls.slice(0, 4).map((u, i) => {
        const src = u.startsWith("data:") || u.startsWith("http") ? u : `${API}${u}`;
        return isVid(src) || type === "video"
          ? <video key={i} src={src} controls className={styles.mediaItem} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={i} src={src} alt="" className={styles.mediaItem} />
      })}
    </div>
  );
}

/* ── Comment Item with Collapsed replies ── */
function CommentItem({ comment, postId, currentUserId, depth = 0, onDelete, onUpdate }: {
  comment: Comment; postId: string; currentUserId: string; depth?: number;
  onDelete: (id: string, parentId: string | null) => void;
  onUpdate: (id: string, data: Partial<Comment>) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [repliesExpanded, setRepliesExpanded] = useState(false);

  const toggleLike = async () => {
    const r = await fetch(`${API}/api/feed/comments/${comment.comment_id}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    const d = await r.json();
    onUpdate(comment.comment_id, { liked_by_me: d.liked, like_count: d.like_count });
  };

  const submitReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    const r = await fetch(`${API}/api/feed/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ content: replyText.trim(), parent_comment_id: comment.comment_id }),
    });
    if (r.ok) {
      const c: Comment = await r.json();
      onUpdate(comment.comment_id, { replies: [...comment.replies, { ...c, replies: [] }] });
      setReplyText("");
      setReplyOpen(false);
      setRepliesExpanded(true); // Auto expand replies
    }
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

        {comment.replies.length > 0 && (
          <button
            onClick={() => setRepliesExpanded(!repliesExpanded)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 600, color: "var(--color-ink)",
              opacity: 0.6, display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 0", marginTop: "4px", fontFamily: "inherit"
            }}
          >
            <span style={{ width: "16px", height: "1.5px", background: "var(--color-hairline)", display: "inline-block" }} />
            {repliesExpanded ? "Hide replies" : `View replies (${comment.replies.length})`}
          </button>
        )}

        {repliesExpanded && comment.replies.map(r => (
          <CommentItem key={r.comment_id} comment={r} postId={postId} currentUserId={currentUserId}
            depth={depth + 1} onDelete={onDelete} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

/* ── Comments Panel (Primary threads open) ── */
function CommentsPanel({ post, currentUser }: { post: Post; currentUser: UserInfo | null }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/feed/posts/${post.post_id}/comments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (r.ok) {
        const d = await r.json();
        const fresh = d.comments || [];
        setComments(prev => {
          const prevMap = new Map(prev.map(c => [c.comment_id, c]));
          
          const mergeComments = (freshList: Comment[], parentMap: Map<string, Comment>): Comment[] => {
            return freshList.map(fc => {
              const pc = parentMap.get(fc.comment_id);
              const repliesMap = new Map((pc?.replies || []).map(r => [r.comment_id, r]));
              return {
                ...fc,
                replies: fc.replies ? mergeComments(fc.replies, repliesMap) : []
              };
            });
          };
          
          return mergeComments(fresh, prevMap);
        });
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    }
  }, [post.post_id]);

  useEffect(() => {
    setLoading(true);
    fetchComments().then(() => setLoading(false));
  }, [post.post_id, fetchComments]);

  useEffect(() => {
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const submit = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    const r = await fetch(`${API}/api/feed/posts/${post.post_id}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (r.ok) { const c: Comment = await r.json(); setComments(p => [{ ...c, replies: [] }, ...p]); setText(""); }
    setPosting(false);
  };

  const handleDelete = useCallback((id: string, parentId: string | null) => {
    fetch(`${API}/api/feed/comments/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
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
    <div className={styles.commentsPanel} style={{ display: "block" }}>
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
              currentUserId={currentUser ? String(currentUser.user_id) : ""}
              onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}</div>}
    </div>
  );
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;

  const [user, setUser] = useState<UserInfo | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (r.ok) {
        const d = await r.json();
        setUnreadCount(d.count || 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load theme settings
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

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem("token") || "";
    if (!t) { router.push("/login"); return; }
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (!u) router.push("/login"); else setUser(u); })
      .catch(() => router.push("/login"));
  }, [router]);

  const pollPost = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/feed/posts/${postId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (r.ok) {
        const d = await r.json();
        setPost(prev => prev ? {
          ...prev,
          like_count: d.post.like_count,
          comment_count: d.post.comment_count,
          liked_by_me: d.post.liked_by_me,
          content: d.post.content,
          display_name: d.post.display_name,
          profile_picture: d.post.profile_picture,
          profile_color: d.post.profile_color
        } : d.post);
      }
    } catch (err) {
      console.error("Failed to poll post details:", err);
    }
  }, [postId]);

  // Load post details initially
  useEffect(() => {
    if (!user || !postId) return;
    setLoading(true);
    fetch(`${API}/api/feed/posts/${postId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) {
          setPost(null);
        } else {
          setPost(d.post);
        }
        setLoading(false);
      })
      .catch(() => {
        setPost(null);
        setLoading(false);
      });
  }, [user, postId]);

  // Poll count and post updates every 10 seconds
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const countInterval = setInterval(fetchUnreadCount, 10000);
      const postInterval = setInterval(pollPost, 10000);
      return () => {
        clearInterval(countInterval);
        clearInterval(postInterval);
      };
    }
  }, [user, fetchUnreadCount, pollPost]);

  const toggleLike = async () => {
    if (liking || !post) return;
    setLiking(true);
    setPost(p => p ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.liked_by_me ? p.like_count - 1 : p.like_count + 1 } : null);
    const r = await fetch(`${API}/api/feed/posts/${postId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    const d = await r.json();
    setPost(p => p ? { ...p, liked_by_me: d.liked, like_count: d.like_count } : null);
    setLiking(false);
  };

  const doDelete = async () => {
    if (!post) return;
    await fetch(`${API}/api/feed/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    router.push("/feed");
  };

  const handleLogout = () => { localStorage.removeItem("token"); router.push("/login"); };

  if (!user) return (
    <div className={styles.splashLoad}>
      <span className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );

  const isOwn = post && String(post.user_id) === String(user.user_id);
  const name = post ? (post.display_name || post.username) : "";

  return (
    <div className={styles.shell}>
      <GooeyFilter />

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
          <div className={styles.sideItem} onClick={() => router.push("/settings")}><Settings size={20} /><span>Settings</span></div>
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

      {/* ── Main Details Column ── */}
      <main className={styles.feedMain}>
        <div className={styles.mobileBar}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink)" }}>
            <ArrowLeft size={20} />
          </button>
          <span className={styles.mobileWordmark}>Thread</span>
          <div className={styles.mobileRight}>
            <Toggle checked={dark} onCheckedChange={toggleDark} />
          </div>
        </div>

        {/* Back Link on Desktop */}
        <div style={{ padding: "16px 20px 8px", borderBottom: "1px solid var(--color-hairline)" }} className={styles.desktopOnly}>
          <button onClick={() => router.back()} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600, color: "var(--color-ink)", opacity: 0.7
          }}>
            <ArrowLeft size={16} />Back to feed
          </button>
        </div>

        {loading ? (
          <div className={styles.feedLoader}><span className="spinner" /></div>
        ) : !post ? (
          <div className={styles.emptyState}>
            <h2 className="type-headline">Post not found</h2>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <article className={styles.postCard} style={{ borderBottom: "none" }}>
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

              <div className={styles.postActions} style={{ borderBottom: "1px solid var(--color-hairline)", paddingBottom: "12px" }}>
                <button className={`${styles.actionBtn} ${post.liked_by_me ? styles.likedBtn : ""}`} onClick={toggleLike}>
                  <Heart size={18} fill={post.liked_by_me ? "currentColor" : "none"} strokeWidth={post.liked_by_me ? 0 : 2} />
                  {post.like_count > 0 && <span>{post.like_count}</span>}
                </button>
                <div className={styles.actionBtn} style={{ cursor: "default" }}>
                  <MessageCircle size={18} />
                  {post.comment_count > 0 && <span>{post.comment_count}</span>}
                </div>
                <button className={styles.actionBtn} onClick={() => navigator.clipboard?.writeText(window.location.href)}>
                  <Share2 size={18} />
                </button>
              </div>
            </article>

            {/* Comments Thread list (Primary threads open by default) */}
            <CommentsPanel post={post} currentUser={user} />
          </div>
        )}
      </main>

      {/* ── Right sidebar placeholder ── */}
      <aside className={styles.rightSidebar} />
    </div>
  );
}
