import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../errors.js";
import { buildChallenge, verifySignedChallenge } from "../auth/sep10.js";

const challengeSchema = z.object({
  publicKey: z.string().min(1),
});

const verifySchema = z.object({
  publicKey: z.string().min(1),
  role: z.enum(["vendor", "admin"]).optional(),
  signedTransaction: z.string().min(1).optional(),
  signedXdr: z.string().min(1).optional(),
  transaction: z.string().min(1).optional(),
});

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw badRequest("invalid_request", result.error.issues[0]?.message || "Invalid request");
  }
  return result.data;
}

export function createAuthRouter(dependencies) {
  const router = Router();

  router.post("/challenge", (req, res, next) => {
    try {
      const body = parse(challengeSchema, req.body);
      res.status(201).json(buildChallenge(body, dependencies));
    } catch (error) {
      next(error);
    }
  });

  router.post("/verify", (req, res, next) => {
    try {
      const body = parse(verifySchema, req.body);
      const signedTransaction = body.signedTransaction || body.signedXdr || body.transaction;
      res.json(
        verifySignedChallenge(
          {
            publicKey: body.publicKey,
            role: body.role,
            signedTransaction,
          },
          dependencies,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
