import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  // Use PostgreSQL session store if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    const sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
    return session({
      secret: process.env.SESSION_SECRET || process.env.AUTH_SECRET || "dev-secret",
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionTtl,
      },
    });
  }
  
  // Fallback to memory store for development
  return session({
    secret: process.env.SESSION_SECRET || process.env.AUTH_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(profile: any) {
  await authStorage.upsertUserByReplitId({
    replitId: profile.id,
    email: profile.emails?.[0]?.value || null,
    firstName: profile.name?.givenName || null,
    lastName: profile.name?.familyName || null,
    profileImageUrl: profile.photos?.[0]?.value || null,
  });
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Support both callback URL formats
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
    process.env.GOOGLE_REDIRECT_URI || 
    "/auth/google/callback";

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          await upsertUser(profile);
          const user = {
            claims: {
              sub: profile.id,
              email: profile.emails?.[0]?.value,
              first_name: profile.name?.givenName,
              last_name: profile.name?.familyName,
              profile_image_url: profile.photos?.[0]?.value,
            },
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Login route - redirects to Google
  app.get("/api/login", (req, res, next) => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
    })(req, res, next);
  });

  // Also support /auth/google for login
  app.get("/auth/google", (req, res, next) => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
    })(req, res, next);
  });

  // Callback route - handles Google's response
  app.get("/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/",
    })(req, res, next);
  });

  // Also support /api/callback for backwards compatibility
  app.get("/api/callback", (req, res, next) => {
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/",
    })(req, res, next);
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
