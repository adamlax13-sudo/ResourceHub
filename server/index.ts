import express from "express";
import session from "express-session";
import { createServer } from "http";
import path from "path";
import { registerRoutes } from "./routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const sessionSecret = process.env.AUTH_SECRET || process.env.SESSION_SECRET || "dev-secret-change-in-production";

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000
    },
  })
);

const httpServer = createServer(app);

(async () => {
  await registerRoutes(httpServer, app);

  const clientBuildPath = path.join(__dirname, "../dist/public");
  app.use(express.static(clientBuildPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
})();
