const passport = require("passport");
const { OIDCStrategy } = require("passport-azure-ad");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const { getDbPool } = require("../config/db");

passport.use(
  new OIDCStrategy(
    {
      identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
      clientID: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      responseType: "code",
      responseMode: "query",
      redirectUrl: process.env.AZURE_CALLBACK_URL,
      scope: ["profile", "email", "openid"],
    },
    async (iss, sub, profile, accessToken, refreshToken, done) => {
      try {
        const email =
          profile._json?.preferred_username ||
          profile.displayName ||
          profile.userPrincipalName;
        const fullName = profile.displayName || "User";

        // Optional: restrict company domain (comment out for testing)
        // if (!email.endsWith("@yourcompany.com")) {
        //   return done(null, false);
        // }

        if (!email) {
          return done(new Error("Email not found in profile"));
        }

        const pool = await getDbPool();

        const existing = await pool
          .request()
          .input("email", email)
          .query("SELECT * FROM Users WHERE email = @email");

        let user;

        if (existing.recordset.length === 0) {
          const insert = await pool
            .request()
            .input("name", fullName)
            .input("email", email)
            .input("role", "employee")
            .input("isActive", 1)
            .input("passwordHash", "").query(`
              INSERT INTO Users (name, email, role, isActive, passwordHash, createdAt)
              OUTPUT INSERTED.*
              VALUES (@name, @email, @role, @isActive, @passwordHash, GETDATE())
            `);

          user = insert.recordset[0];
        } else {
          user = existing.recordset[0];
        }

        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );

        console.log("✅ Microsoft SSO: User authenticated", {
          id: user.id,
          email: user.email,
          role: user.role,
        });

        return done(null, {
          token,
          id: user.id,
          email: user.email,
          role: user.role,
        });
      } catch (err) {
        console.error("❌ Microsoft SSO Error:", err);
        return done(err);
      }
    },
  ),
);

// Serialize user for session storage
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const pool = await getDbPool();
    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM Users WHERE id = @id");

    if (result.recordset.length > 0) {
      done(null, result.recordset[0]);
    } else {
      done(null, false);
    }
  } catch (err) {
    done(err);
  }
});
