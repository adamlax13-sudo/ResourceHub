/**
 * Feedback endpoint for user submissions
 */

import type { Request, Response, Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { feedbackLimiter } from "../middleware/rateLimiter";

const feedbackSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
  hp: z.string().max(0).optional(), // Honeypot field
});

export function registerFeedbackRoutes(router: Router): void {
  router.post("/api/feedback", feedbackLimiter, async (req: Request, res: Response) => {
    try {
      const validatedData = feedbackSchema.parse(req.body);

      // Honeypot check: bots fill hidden fields, humans don't
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
        res.status(400).json({ message: "Invalid feedback data", errors: err.errors });
      } else {
        res.status(500).json({ message: "Failed to submit feedback" });
      }
    }
  });
}
