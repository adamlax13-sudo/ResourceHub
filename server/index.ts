// server/index.ts

import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// --- Helper: check required secrets ---
const requiredSecrets = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "AUTH_SECRET"];
for (const key of requiredSecrets) {
  if (!process.env[key]) {
    console.error(`Error: Missing required secret ${key}. Please set it in Render Dashboard.`);
    process.exit(1);
  }
}

// --- Express app ---
const app = express();

// --- Session setup ---
app.use(
  session({
    secret: process.env.AUTH_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }, // secure cookies in prod
  })
);

app.use(passport.initialize());
app.use(passport.session());

// --- Passport Google OAuth ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_REDIRECT_URI!,
    },
    async (accessToken, refreshToken, profile, done) => {
      // Here you can save profile info to your database
      return done(null, profile);
    }
  )
);

// --- Serialize / deserialize user ---
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((obj: any, done) => done(null, obj));

// --- Auth routes ---
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    // Successful login
    res.redirect("/profile");
  }
);

// --- Protected route example ---
app.get("/profile", (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect("/auth/google");
  res.send(`
    <h1>Welcome ${req.user?.displayName}</h1>
    <p>Email: ${req.user?.emails?.[0]?.value}</p>
    <p><a href="/logout">Logout</a></p>
  `);
});

// --- Logout ---
app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// --- Home page ---
app.get("/", (req, res) => {
  res.send(`
    <h1>ResourceHub</h1>
    <p><a href="/auth/google">Login with Google</a></p>
  `);
});

// --- Start server ---
const port = parseInt(process.env.PORT || "5000", 10);
app.listen(port, () => console.log(`Server running on port ${port}`));

export default app;
