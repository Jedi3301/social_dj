require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const feedRoutes = require("./routes/feed");
const usersRoutes = require("./routes/users");
const trendsRoutes = require("./routes/trends");

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "https://social-dj.vercel.app",
    process.env.FRONTEND_URL, // allow override via env var
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Also allow any *.vercel.app subdomain for preview deployments
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json());

// Serve uploaded media files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/trends", trendsRoutes);

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    app.listen(5000, () => {
        console.log("Server running on port 5000");
    });
}

module.exports = app;