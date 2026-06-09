const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

const router = express.Router();

// ─── GET /api/trends ──────────────────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT hashtag, post_count AS count
             FROM hashtag_metrics
             WHERE post_count > 0
             ORDER BY post_count DESC
             LIMIT 4`
        );

        const trends = rows.map((r, i) => ({
            id: i + 1,
            category: "Trending",
            name: r.hashtag,
            count: Number(r.count) > 1000 ? `${(Number(r.count) / 1000).toFixed(1)}K` : `${r.count}`
        }));

        res.json({ trends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load trends" });
    }
});

module.exports = router;
