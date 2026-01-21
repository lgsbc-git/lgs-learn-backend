const express = require("express");
const passport = require("passport");
const { login } = require("./auth.controller");

const router = express.Router();

// Existing password login
router.post("/login", login);

// Microsoft SSO
router.get("/microsoft", passport.authenticate("azuread-openidconnect"));

router.get(
  "/microsoft/callback",
  passport.authenticate("azuread-openidconnect", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    try {
      console.log("🔍 Microsoft Callback - req.user:", req.user);

      // The passport strategy returns { token, id, email, role } which becomes req.user
      const token = req.user?.token;

      if (!token) {
        console.error("❌ No token in req.user:", req.user);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_token`);
      }

      console.log("✅ Token generated successfully, redirecting to frontend");

      // Redirect to frontend with token
      res.redirect(
        `${process.env.FRONTEND_URL}/sso-success?token=${encodeURIComponent(token)}`,
      );
    } catch (error) {
      console.error("❌ SSO callback error:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_error`);
    }
  },
);

module.exports = router;

module.exports = router;
