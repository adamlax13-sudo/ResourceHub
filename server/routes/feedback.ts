/**
 * Feedback routes — /api/feedback
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { feedbackLimiter } from "../middleware/rateLimiter";
import { createErrorResponse } from "../helpers/errors";

export function registerFeedbackRoutes(app: Express): void {
  app.post("/api/feedback", feedbackLimiter, async (req: Request, res: Response) => {
    try {
      const feedbackSchema = z.object({
        name: z.string().max(255).optional(),
        email: z.string().email().max(255).optional().or(z.literal('')),
        message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
        hp: z.string().max(0).optional(),
      });

      const validatedData = feedbackSchema.parse(req.body);

      // Honeypot check
      if (validatedData.hp) {
        return res.json({ success: true, id: 0 });
      }

      const feedbackData = {
        name: validatedData.name || null,
        email: validatedData.email || null,
        message: validatedData.message,
      };

      const newFeedback = await storage.createFeedback(feedbackData);
      res.json({ success: true, id: newFeedback.id });
    } catch (err) {
      console.error("Feedback error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json(createErrorResponse("Invalid feedback data", undefined, err.errors));
      } else {
        res.status(500).json(createErrorResponse("Failed to submit feedback"));
      }
    }
  });

  app.post("/api/service-vote", feedbackLimiter, async (req: Request, res: Response) => {
    try {
      const serviceVoteSchema = z.object({
        serviceId: z.string().min(1).max(255),
        vote: z.enum(['up', 'down']),
        queryContext: z.string().max(500).optional(),
      });
      const { serviceId, vote, queryContext } = serviceVoteSchema.parse(req.body);
      await storage.createServiceVote(serviceId, vote, queryContext);
      res.json({ success: true });
    } catch (err) {
      console.error("Service vote error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json(createErrorResponse("Invalid vote data", undefined, err.errors));
      } else if ((err as any)?.code === '23503') {
        // Postgres FK violation — serviceId doesn't exist in services table
        res.status(400).json(createErrorResponse("Service not found"));
      } else {
        res.status(500).json(createErrorResponse("Failed to record vote"));
      }
    }
  });
}
