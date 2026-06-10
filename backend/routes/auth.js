const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dns = require("dns").promises;
const crypto = require("crypto");

const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

const router = express.Router();

// ─── Real-time email domain validation via DNS MX lookup ───────────────────
// This checks whether the email domain actually has mail servers configured.
// It cannot verify if the specific mailbox exists (SMTP servers block that),
// but it reliably catches typos like user@gmal.com vs user@gmail.com.
router.get("/check-email", async (req, res) => {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
        return res.status(400).json({ valid: false, reason: "No email provided" });
    }

    // 1. Syntax check
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
        return res.json({ valid: false, reason: "Invalid email format" });
    }

    const domain = email.split("@")[1].toLowerCase();

    // 2. Block obvious disposable/temp email domains
    const disposableDomains = [
        "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
        "yopmail.com", "fakeinbox.com", "trashmail.com", "dispostable.com",
        "maildrop.cc", "sharklasers.com", "spam4.me", "10minutemail.com",
        "temp-mail.org", "getnada.com", "mailnull.com", "spamgourmet.com",
    ];
    if (disposableDomains.includes(domain)) {
        return res.json({ valid: false, reason: "Disposable email addresses are not allowed" });
    }

    // 3. DNS MX record lookup — does this domain have mail servers?
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
            return res.json({ valid: true, reason: "Email domain is valid" });
        } else {
            return res.json({ valid: false, reason: "This email domain cannot receive mail" });
        }
    } catch (err) {
        // DNS lookup failed — domain doesn't exist or has no MX records
        if (err.code === "ENOTFOUND" || err.code === "ENODATA" || err.code === "ESERVFAIL") {
            return res.json({ valid: false, reason: "Email domain does not exist" });
        }
        // Network error — don't block the user, fail open
        return res.json({ valid: true, reason: "Could not verify (network error)" });
    }
});

// ─── Forgot Password ────────────────────────────────────────────────────────
// In production: generate a reset token, store it hashed in DB, and send an
// email with a reset link. Here we return success if the email exists so we
// don't leak which emails are registered (security best practice).
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Check if user exists (but don't reveal whether they do)
        const result = await pool.query(
            "SELECT user_id FROM users WHERE email = $1",
            [email.toLowerCase().trim()]
        );

        if (result.rows.length > 0) {
            // TODO: Generate reset token & send email
            // const resetToken = crypto.randomBytes(32).toString("hex");
            // const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
            // Store hashedToken + expiry in DB, send email with resetToken link
            console.log(`Password reset requested for: ${email}`);
        }

        // Always return success (don't leak whether email exists)
        return res.status(200).json({
            message: "If an account with that email exists, a reset link has been sent."
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to process request" });
    }
});

router.post("/register", async (req, res) => {

    try {

        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Username, email and password are required"
            });
        }

        const existingUser = await pool.query(
            `
            SELECT user_id
            FROM users
            WHERE email = $1
               OR username = $2
            `,
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Username or email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const result = await pool.query(
            `
            INSERT INTO users
            (
                username,
                email,
                password_hash
            )
            VALUES
            ($1, $2, $3)
            RETURNING user_id
            `,
            [
                username,
                email,
                hashedPassword
            ]
        );

        const userId = result.rows[0].user_id;

        const token = jwt.sign(
            {
                user_id: userId
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(201).json({
            message: "User registered successfully",
            token
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: "Registration failed"
        });

    }

});

router.post(
    "/complete-profile",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                firstname,
                lastname,
                displayname,
                profile_picture,
                bio
            } = req.body;

            if (!firstname || !lastname) {
                return res.status(400).json({
                    message: "First name and last name are required"
                });
            }

            const userId = req.user.user_id;

            const existingProfile = await pool.query(
                `
                SELECT user_id
                FROM profiles
                WHERE user_id = $1
                `,
                [userId]
            );

            if (existingProfile.rows.length > 0) {
                return res.status(409).json({
                    message: "Profile already exists"
                });
            }

            const finalDisplayName =
                displayname?.trim()
                    ? displayname.trim()
                    : `${firstname} ${lastname}`;

            await pool.query(
                `
                INSERT INTO profiles
                (
                    user_id,
                    first_name,
                    last_name,
                    display_name,
                    profile_picture,
                    bio
                )
                VALUES
                ($1, $2, $3, $4, $5, $6)
                `,
                [
                    userId,
                    firstname,
                    lastname,
                    finalDisplayName,
                    profile_picture || null,
                    bio || null
                ]
            );

            return res.status(201).json({
                message: "Profile completed successfully",
                display_name: finalDisplayName
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                message: "Failed to create profile"
            });

        }

    }
);
router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE email = $1
            `,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(200).json({
            message: "Login successful",
            token
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            message: "Login failed"
        });

    }

});
router.get(
    "/me",
    authMiddleware,
    async (req, res) => {

        try {

            const userId = req.user.user_id;

            const result = await pool.query(
                `
                SELECT
                    u.user_id,
                    u.username,
                    u.email,
                    p.display_name,
                    p.profile_picture,
                    p.bio,
                    p.profile_color
                FROM users u
                LEFT JOIN profiles p
                    ON u.user_id = p.user_id
                WHERE u.user_id = $1
                `,
                [userId]
            );

            return res.json(result.rows[0]);

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                message: "Failed to fetch user"
            });

        }

    }
);

module.exports = router;