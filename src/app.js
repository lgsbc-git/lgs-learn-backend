const express = require("express");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");

require("./config/microsoft.strategy");

const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/user.routes");
const courseRoutes = require("./modules/courses/course.routes");
const employeeRoutes = require("./modules/employee/employee.routes");
const managerRoutes = require("./modules/manager/manager.routes");
const instructorRoutes = require("./modules/instructor/instructor.routes");

const app = express();

/* =========================
   🔥 REQUIRED FOR RENDER
========================= */
app.set("trust proxy", 1);

/* =========================
   MIDDLEWARE
========================= */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://lgs-learn-frontend.onrender.com",
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* =========================
   SESSION (FIXED)
========================= */
app.use(
  session({
    secret: process.env.JWT_SECRET || "session-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

/* =========================
   PASSPORT
========================= */
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
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/courses", courseRoutes);
app.use("/employee", employeeRoutes);
app.use("/manager", managerRoutes);
app.use("/instructor", instructorRoutes);

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

module.exports = app;
