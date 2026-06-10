const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

const router = express.Router();

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|ogg|quicktime))$/.test(file.mimetype);
        ok ? cb(null, true) : cb(new Error("Only images and videos are allowed"));
    },
});

// ─── GET /api/feed ─────────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const userId = req.user.user_id;

        const { rows } = await pool.query(
            `SELECT
                p.post_id, p.content, p.post_type, p.media_urls, p.created_at,
                u.user_id, u.username,
                pr.display_name, pr.profile_picture, pr.profile_color,
                (SELECT COUNT(*)::int FROM post_likes WHERE post_id = p.post_id) AS like_count,
                (SELECT COUNT(*)::int FROM comments WHERE post_id = p.post_id AND parent_comment_id IS NULL) AS comment_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.post_id AND user_id = $3) AS liked_by_me
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN profiles pr ON u.user_id = pr.user_id
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2`,
            [limit, offset, userId]
        );

        res.json({ posts: rows, page: Number(page), hasMore: rows.length === Number(limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load feed" });
    }
});

// ─── POST /api/feed/posts ──────────────────────────────────────────────────
router.post("/posts", authMiddleware, upload.array("media", 4), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.user_id;
        const files = req.files || [];

        if (!content?.trim() && files.length === 0) {
            return res.status(400).json({ message: "Post cannot be empty" });
        }

        const mediaUrls = files.map(f => `/uploads/${f.filename}`);
        const hasVideo = files.some(f => f.mimetype.startsWith("video/"));
        const hasImage = files.some(f => f.mimetype.startsWith("image/"));
        let postType = "text";
        if (hasVideo && hasImage) postType = "mixed";
        else if (hasVideo) postType = "video";
        else if (hasImage) postType = "image";
        if ((hasImage || hasVideo) && content?.trim()) postType = postType === "text" ? "text" : "mixed";

        const { rows } = await pool.query(
            `INSERT INTO posts (user_id, content, post_type, media_urls)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, content?.trim() || null, postType, mediaUrls]
        );

        // Update hashtag metrics table
        const postContent = content?.trim();
        const hashtags = postContent ? [...new Set(postContent.match(/#[A-Za-z0-9_]+/g))] : [];
        if (hashtags.length > 0) {
            for (const tag of hashtags) {
                await pool.query(
                    `INSERT INTO hashtag_metrics (hashtag, post_count)
                     VALUES ($1, 1)
                     ON CONFLICT (hashtag) DO UPDATE SET post_count = hashtag_metrics.post_count + 1`,
                    [tag]
                );
            }
        }

        const { rows: userRows } = await pool.query(
            `SELECT u.username, pr.display_name, pr.profile_picture, pr.profile_color
             FROM users u LEFT JOIN profiles pr ON u.user_id = pr.user_id WHERE u.user_id = $1`,
            [userId]
        );

        res.status(201).json({
            ...rows[0],
            user_id: userId,
            ...userRows[0],
            like_count: 0,
            comment_count: 0,
            liked_by_me: false,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to create post" });
    }
});

// ─── DELETE /api/feed/posts/:postId ───────────────────────────────────────
router.delete("/posts/:postId", authMiddleware, async (req, res) => {
    try {
        // Retrieve the post content before deleting it to decrement hashtag counts
        const postResult = await pool.query(
            "SELECT content FROM posts WHERE post_id = $1 AND user_id = $2",
            [req.params.postId, req.user.user_id]
        );

        const { rows } = await pool.query(
            "DELETE FROM posts WHERE post_id = $1 AND user_id = $2 RETURNING post_id",
            [req.params.postId, req.user.user_id]
        );
        if (!rows.length) return res.status(404).json({ message: "Not found or unauthorized" });

        // Decrement hashtag metrics
        if (postResult.rows.length) {
            const content = postResult.rows[0].content;
            const hashtags = content ? [...new Set(content.match(/#[A-Za-z0-9_]+/g))] : [];
            if (hashtags.length > 0) {
                for (const tag of hashtags) {
                    await pool.query(
                        `UPDATE hashtag_metrics
                         SET post_count = GREATEST(0, post_count - 1)
                         WHERE hashtag = $1`,
                        [tag]
                    );
                }
                // Clean up unused hashtags
                await pool.query(`DELETE FROM hashtag_metrics WHERE post_count = 0`);
            }
        }

        res.json({ message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete post" });
    }
});

// ─── POST /api/feed/posts/:postId/like ────────────────────────────────────
router.post("/posts/:postId/like", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.user_id;
        const existing = await pool.query(
            "SELECT like_id FROM post_likes WHERE post_id=$1 AND user_id=$2",
            [postId, userId]
        );
        if (existing.rows.length) {
            await pool.query("DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2", [postId, userId]);
        } else {
            await pool.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)", [postId, userId]);
        }
        const { rows } = await pool.query("SELECT COUNT(*)::int FROM post_likes WHERE post_id=$1", [postId]);
        res.json({ liked: !existing.rows.length, like_count: rows[0].count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to toggle like" });
    }
});

// ─── GET /api/feed/posts/:postId/comments ─────────────────────────────────
router.get("/posts/:postId/comments", authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.user_id;

        const { rows } = await pool.query(
            `SELECT
                c.comment_id, c.content, c.parent_comment_id, c.created_at,
                u.user_id, u.username, pr.display_name, pr.profile_picture, pr.profile_color,
                (SELECT COUNT(*)::int FROM comment_likes WHERE comment_id = c.comment_id) AS like_count,
                EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.comment_id AND user_id = $2) AS liked_by_me
             FROM comments c
             JOIN users u ON c.user_id = u.user_id
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE c.post_id = $1
             ORDER BY c.created_at ASC`,
            [postId, userId]
        );

        // Build thread tree
        const map = {};
        const roots = [];
        for (const r of rows) { r.replies = []; map[r.comment_id] = r; }
        for (const r of rows) {
            if (r.parent_comment_id && map[r.parent_comment_id]) {
                map[r.parent_comment_id].replies.push(r);
            } else if (!r.parent_comment_id) {
                roots.push(r);
            }
        }
        res.json({ comments: roots });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load comments" });
    }
});

// ─── POST /api/feed/posts/:postId/comments ────────────────────────────────
router.post("/posts/:postId/comments", authMiddleware, async (req, res) => {
    try {
        const { content, parent_comment_id } = req.body;
        const { postId } = req.params;
        const userId = req.user.user_id;

        if (!content?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

        const { rows } = await pool.query(
            `INSERT INTO comments (post_id, user_id, content, parent_comment_id)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [postId, userId, content.trim(), parent_comment_id || null]
        );
        const { rows: u } = await pool.query(
            `SELECT u.username, pr.display_name, pr.profile_picture, pr.profile_color FROM users u LEFT JOIN profiles pr ON u.user_id=pr.user_id WHERE u.user_id=$1`,
            [userId]
        );
        res.status(201).json({ ...rows[0], ...u[0], like_count: 0, liked_by_me: false, replies: [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to post comment" });
    }
});

// ─── POST /api/feed/comments/:commentId/like ──────────────────────────────
router.post("/comments/:commentId/like", authMiddleware, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.user_id;
        const existing = await pool.query(
            "SELECT like_id FROM comment_likes WHERE comment_id=$1 AND user_id=$2",
            [commentId, userId]
        );
        if (existing.rows.length) {
            await pool.query("DELETE FROM comment_likes WHERE comment_id=$1 AND user_id=$2", [commentId, userId]);
        } else {
            await pool.query("INSERT INTO comment_likes (comment_id, user_id) VALUES ($1,$2)", [commentId, userId]);
        }
        const { rows } = await pool.query("SELECT COUNT(*)::int FROM comment_likes WHERE comment_id=$1", [commentId]);
        res.json({ liked: !existing.rows.length, like_count: rows[0].count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to toggle like" });
    }
});

// ─── DELETE /api/feed/comments/:commentId ─────────────────────────────────
router.delete("/comments/:commentId", authMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(
            "DELETE FROM comments WHERE comment_id=$1 AND user_id=$2 RETURNING comment_id",
            [req.params.commentId, req.user.user_id]
        );
        if (!rows.length) return res.status(404).json({ message: "Not found or unauthorized" });
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete comment" });
    }
});

module.exports = router;
