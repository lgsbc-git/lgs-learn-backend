const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: process.env.PORT || 5000,

  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
  },

  azure: {
    storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    storageAccountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME,
  },
};

// Basic validation (fail fast)
if (!env.db.user || !env.db.password || !env.db.server || !env.db.database) {
  console.error("❌ Database environment variables are missing");
  process.exit(1);
}

if (!env.jwt.secret) {
  console.error("❌ JWT_SECRET is missing");
  process.exit(1);
}

if (!env.azure.connectionString || !env.azure.containerName) {
  console.warn(
    "⚠️  Azure Blob Storage variables are missing (optional feature)"
  );
}

module.exports = env;
