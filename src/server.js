const app = require("./app");
const env = require("./config/env");
const { getDbPool } = require("./config/db");
const { initBlobService } = require("./config/blob");

/* ------------------ */
/* Server Bootstrap   */
/* ------------------ */
const startServer = async () => {
  try {
    // Connect to DB first
    await getDbPool();

    // Initialize Azure Blob Storage (optional feature)
    try {
      initBlobService();
    } catch (err) {
      console.warn("⚠️  Azure Blob Storage not available:", err.message);
      // Don't fail startup if blob service is not configured
    }

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
