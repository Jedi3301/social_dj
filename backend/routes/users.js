const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const pool = require("../db");

const router = express.Router();

// ─── Upload config (memory storage — works on Vercel serverless) ────────────
// Vercel functions run on a read-only filesystem, so we store images as
// base64 data URIs directly in the database instead of writing files to disk.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const ok = /^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype);
        ok ? cb(null, true) : cb(new Error("Only images are allowed"));
    },
});

// ─── Ensure follows table exists ───────────────────────────────────────────
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS follows (
                follower_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                following_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (follower_id, following_id)
            )
        `);
    } catch (err) {
        console.error("Error creating follows table:", err);
    }
})();

// ─── GET /api/users/who-to-follow ─────────────────────────────────────────
router.get("/who-to-follow", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, pr.display_name, pr.profile_picture, pr.profile_color, pr.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=u.user_id) AS is_following
             FROM users u
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE u.user_id != $1
               AND NOT EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=u.user_id)
             ORDER BY RANDOM()
             LIMIT 4`,
            [userId]
        );
        res.json({ users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load suggestions" });
    }
});

// ─── GET /api/users/search ─────────────────────────────────────────────────
router.get("/search", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { q = "" } = req.query;
        const term = `%${q.trim().toLowerCase()}%`;
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, pr.display_name, pr.profile_picture, pr.profile_color, pr.bio,
                (SELECT COUNT(*)::int FROM follows WHERE following_id=u.user_id) AS followers_count,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=u.user_id) AS is_following
             FROM users u
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE u.user_id != $1
               AND (LOWER(u.username) LIKE $2 OR LOWER(pr.display_name) LIKE $2)
             ORDER BY followers_count DESC
             LIMIT 20`,
            [userId, term]
        );
        res.json({ users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Search failed" });
    }
});

// ─── GET /api/users/profile/:username ─────────────────────────────────────
router.get("/profile/:username", authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.user_id;
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, pr.display_name, pr.profile_picture, pr.bio,
                pr.profile_color,
                (SELECT COUNT(*)::int FROM follows WHERE following_id=u.user_id) AS followers_count,
                (SELECT COUNT(*)::int FROM follows WHERE follower_id=u.user_id) AS following_count,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=u.user_id) AS is_following
             FROM users u
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE LOWER(u.username) = LOWER($1)`,
            [username, currentUserId]
        );
        if (!rows.length) return res.status(404).json({ message: "User not found" });
        res.json({ profile: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load profile" });
    }
});

// ─── GET /api/users/profile/:username/posts ───────────────────────────────
router.get("/profile/:username/posts", authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.user_id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const { rows } = await pool.query(
            `SELECT
                p.post_id, p.content, p.post_type, p.media_urls, p.created_at,
                u.user_id, u.username,
                pr.display_name, pr.profile_picture, pr.profile_color,
                (SELECT COUNT(*)::int FROM post_likes WHERE post_id = p.post_id) AS like_count,
                (SELECT COUNT(*)::int FROM comments WHERE post_id = p.post_id AND parent_comment_id IS NULL) AS comment_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.post_id AND user_id = $4) AS liked_by_me
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN profiles pr ON u.user_id = pr.user_id
            WHERE LOWER(u.username) = LOWER($1)
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3`,
            [username, limit, offset, currentUserId]
        );
        res.json({ posts: rows, page: Number(page), hasMore: rows.length === Number(limit) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load user posts" });
    }
});

// ─── POST /api/users/follow/:userId ───────────────────────────────────────
router.post("/follow/:userId", authMiddleware, async (req, res) => {
    try {
        const followerId = req.user.user_id;
        const followingId = req.params.userId;
        if (String(followerId) === String(followingId)) {
            return res.status(400).json({ message: "Cannot follow yourself" });
        }
        const existing = await pool.query(
            "SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2",
            [followerId, followingId]
        );
        if (existing.rows.length) {
            await pool.query("DELETE FROM follows WHERE follower_id=$1 AND following_id=$2", [followerId, followingId]);
            const { rows } = await pool.query("SELECT COUNT(*)::int FROM follows WHERE following_id=$1", [followingId]);
            return res.json({ following: false, followers_count: rows[0].count });
        } else {
            await pool.query("INSERT INTO follows (follower_id, following_id) VALUES ($1,$2)", [followerId, followingId]);
            const { rows } = await pool.query("SELECT COUNT(*)::int FROM follows WHERE following_id=$1", [followingId]);
            return res.json({ following: true, followers_count: rows[0].count });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Follow action failed" });
    }
});

// ─── GET /api/users/:userId/followers ─────────────────────────────────────
router.get("/:userId/followers", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.user_id;
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, pr.display_name, pr.profile_picture, pr.profile_color, pr.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=u.user_id) AS is_following
             FROM follows f
             JOIN users u ON f.follower_id = u.user_id
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE f.following_id=$1
             ORDER BY f.created_at DESC`,
            [userId, currentUserId]
        );
        res.json({ users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load followers" });
    }
});

// ─── GET /api/users/:userId/following ─────────────────────────────────────
router.get("/:userId/following", authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.user_id;
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, pr.display_name, pr.profile_picture, pr.profile_color, pr.bio,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=u.user_id) AS is_following
             FROM follows f
             JOIN users u ON f.following_id = u.user_id
             LEFT JOIN profiles pr ON u.user_id = pr.user_id
             WHERE f.follower_id=$1
             ORDER BY f.created_at DESC`,
            [userId, currentUserId]
        );
        res.json({ users: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load following" });
    }
});

// ─── PATCH /api/users/settings/profile ────────────────────────────────────
router.patch("/settings/profile", authMiddleware, upload.single("profile_picture"), async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { display_name, bio, profile_color } = req.body;
        let picturePath = undefined;
        if (req.file) {
            // Convert buffer to base64 data URI — no filesystem needed
            const b64 = req.file.buffer.toString("base64");
            picturePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        // Ensure profile_color column exists (safeguard)
        await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_color VARCHAR(20)`);

        const fields = [];
        const vals = [];
        let idx = 1;
        if (display_name !== undefined) { fields.push(`display_name=$${idx++}`); vals.push(display_name); }
        if (bio !== undefined) { fields.push(`bio=$${idx++}`); vals.push(bio); }
        if (profile_color !== undefined) { fields.push(`profile_color=$${idx++}`); vals.push(profile_color); }
        if (picturePath !== undefined) { fields.push(`profile_picture=$${idx++}`); vals.push(picturePath); }

        // Check if profile exists first
        const existsRes = await pool.query("SELECT 1 FROM profiles WHERE user_id = $1", [userId]);
        
        if (existsRes.rows.length === 0) {
            // Insert initial profile if not exists
            await pool.query(
                `INSERT INTO profiles (user_id, first_name, last_name, display_name, bio, profile_color, profile_picture)
                 VALUES ($1, '', '', $2, $3, $4, $5)`,
                [
                    userId,
                    display_name !== undefined ? display_name : null,
                    bio !== undefined ? bio : null,
                    profile_color !== undefined ? profile_color : null,
                    picturePath !== undefined ? picturePath : null
                ]
            );
        } else if (fields.length > 0) {
            // Otherwise, update existing profile fields
            vals.push(userId);
            await pool.query(
                `UPDATE profiles SET ${fields.join(", ")} WHERE user_id=$${idx}`,
                vals
            );
        }

        // Return full updated profile
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, pr.display_name, pr.profile_picture, pr.bio, pr.profile_color
             FROM users u LEFT JOIN profiles pr ON u.user_id=pr.user_id WHERE u.user_id=$1`,
            [userId]
        );
        res.json({ profile: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update profile" });
    }
});

// ─── PATCH /api/users/settings/account ────────────────────────────────────
// Change username or email
router.patch("/settings/account", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { username, email } = req.body;
        const fields = [];
        const vals = [];
        let idx = 1;
        if (username) { fields.push(`username=$${idx++}`); vals.push(username.trim()); }
        if (email) { fields.push(`email=$${idx++}`); vals.push(email.trim().toLowerCase()); }
        if (!fields.length) return res.status(400).json({ message: "Nothing to update" });
        vals.push(userId);
        await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE user_id=$${idx}`, vals);
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, pr.display_name, pr.profile_picture, pr.bio
             FROM users u LEFT JOIN profiles pr ON u.user_id=pr.user_id WHERE u.user_id=$1`,
            [userId]
        );
        res.json({ profile: rows[0] });
    } catch (err) {
        if (err.code === "23505") return res.status(409).json({ message: "Username or email already taken" });
        console.error(err);
        res.status(500).json({ message: "Failed to update account" });
    }
});

module.exports = router;
