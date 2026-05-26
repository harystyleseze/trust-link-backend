import express from "express";
import { readConfig } from "./config.js";
import { HttpError } from "./errors.js";
import { MemoryChallengeStore } from "./auth/challenge-store.js";
import { createAuthRouter } from "./routes/auth.js";

export function createApp({ config, env, challengeStore } = {}) {
  const appConfig = config || readConfig(env);
  const store = challengeStore || new MemoryChallengeStore();
  const app = express();

  app.use(express.json({ limit: "128kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    "/auth",
    createAuthRouter({
      config: appConfig,
      challengeStore: store,
    }),
  );

  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      code: "internal_error",
    });
  });

  return app;
}
