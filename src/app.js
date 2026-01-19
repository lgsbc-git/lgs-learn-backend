const express = require("express");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/users/user.routes");
const courseRoutes = require("./modules/courses/course.routes");
const employeeRoutes = require("./modules/employee/employee.routes");
const managerRoutes = require("./modules/manager/manager.routes");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "LMS Backend is running" });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/courses", courseRoutes);
app.use("/employee", employeeRoutes);
app.use("/manager", managerRoutes);

module.exports = app;
