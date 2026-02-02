// use this while in the local system

// const fs = require("fs");
// const path = require("path");
// const https = require("https");

// const app = require("./app");
// const env = require("./config/env");
// const { getDbPool } = require("./config/db");
// const { initBlobService } = require("./config/blob");
// const { runMigrations } = require("./migrations/quiz-tables");

// /* ------------------ */
// /* Server Bootstrap   */
// /* ------------------ */
// const startServer = async () => {
//   try {
//     // Connect to DB
//     await getDbPool();

//     // Run database migrations
//     await runMigrations();

//     // Initialize Azure Blob (optional)
//     try {
//       initBlobService();
//     } catch (err) {
//       console.warn("⚠️ Azure Blob not configured:", err.message);
//     }

//     // HTTPS options
//     const sslOptions = {
//       key: fs.readFileSync(path.join(__dirname, "../ssl/localhost+1-key.pem")),
//       cert: fs.readFileSync(path.join(__dirname, "../ssl/localhost+1.pem")),
//     };

//     // Start HTTPS server
//     https.createServer(sslOptions, app).listen(env.port, () => {
//       console.log(`🔐 HTTPS Server running at https://localhost:${env.port}`);
//     });
//   } catch (err) {
//     console.error("❌ Failed to start server:", err.message);
//     process.exit(1);
//   }
// };

// startServer();

// Production code
const app = require("./app");
const env = require("./config/env");
const { getDbPool } = require("./config/db");
const { initBlobService } = require("./config/blob");

/* ------------------ */
/* Server Bootstrap   */
/* ------------------ */
const startServer = async () => {
  try {
    // Connect to DB
    await getDbPool();

    // Initialize Azure Blob (optional)
    try {
      initBlobService();
    } catch (err) {
      console.warn("⚠️ Azure Blob not configured:", err.message);
    }

    const PORT = process.env.PORT || env.port || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
