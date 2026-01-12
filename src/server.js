const app = require("./app");
const env = require("./config/env");
const { getDbPool } = require("./config/db");

/* ------------------ */
/* Server Bootstrap   */
/* ------------------ */
const startServer = async () => {
  try {
    // Connect to DB first
    await getDbPool();

    // Start server
    app.listen(env.port, () => {
      console.log(`🚀 Server running on port ${env.port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
