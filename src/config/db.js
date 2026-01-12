const sql = require("mssql");
const env = require("./env");

const dbConfig = {
  user: env.db.user,
  password: env.db.password,
  server: env.db.server,
  database: env.db.database,
  options: {
    encrypt: true, // REQUIRED for Azure SQL
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

/**
 * Get or create SQL connection pool
 */
const getDbPool = async () => {
  try {
    if (pool) return pool;

    pool = await sql.connect(dbConfig);
    console.log("✅ Connected to Azure SQL Database");
    return pool;
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = {
  sql,
  getDbPool,
};
