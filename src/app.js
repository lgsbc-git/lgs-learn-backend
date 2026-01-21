const express = require("express");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");

// 🔐 Load Microsoft SSO strategy (MUST be before routes)
require("./config/microsoft.strategy");

// Routes
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/user.routes");
const courseRoutes = require("./modules/courses/course.routes");
const employeeRoutes = require("./modules/employee/employee.routes");
const managerRoutes = require("./modules/manager/manager.routes");

const app = express();

/* =========================
   MIDDLEWARE
========================= */

// CORS (allow frontend + SSO redirects)
app.use(
  cors({
    origin: [
      "http://localhost:5173", // local frontend
      "http://localhost:3000",
      "https://your-frontend.onrender.com", // deployed frontend
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware (required for passport OIDC strategy)
app.use(
  session({
    secret: process.env.JWT_SECRET || "session-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // HTTPS only
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Initialize passport (required for Microsoft SSO)
app.use(passport.initialize());
app.use(passport.session());

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "LMS Backend is running",
    time: new Date().toISOString(),
  });
});

/* =========================
   ROUTES
========================= */
app.use("/auth", authRoutes); // password + microsoft SSO
app.use("/users", userRoutes);
app.use("/courses", courseRoutes);
app.use("/employee", employeeRoutes);
app.use("/manager", managerRoutes);

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({
    message: "Internal Server Error",
  });
});

module.exports = app;
