require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const feedRoutes = require("./routes/feed");
const usersRoutes = require("./routes/users");
const trendsRoutes = require("./routes/trends");

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded media files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/trends", trendsRoutes);

app.listen(5000, () => {
    console.log("Server running on port 5000");
});