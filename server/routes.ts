import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI client using Replit's integration env vars
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.search.query.path, async (req, res) => {
    try {
      const input = api.search.query.input.parse(req.body);
      
      // Check cache first
      const cached = await storage.getSearchByQuery(input.query);
      if (cached) {
        return res.json(cached.results);
      }

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant helping people in Alberta, Canada find support services. 
            You must return a valid JSON object matching this structure:
            {
              "services": [
                {
                  "id": "string",
                  "name": "string",
                  "category": "Mental Health" | "Financial" | "Housing" | "Food" | "Legal" | "Addiction" | "Domestic Abuse" | "Disability" | "Social Program",
                  "description": "string",
                  "location": "string",
                  "contact": "string",
                  "eligibility": "string",
                  "process": ["step 1", "step 2"],
                  "waitTimes": "string",
                  "requiredDocs": ["doc 1", "doc 2"]
                }
              ],
              "summary": "string"
            }
            Provide real, accurate resources for Alberta. If specific wait times aren't known, provide general estimates based on the service type.
            Include 3-5 most relevant services.`
          },
          {
            role: "user",
            content: input.query
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("No content received from OpenAI");
      }

      const results = JSON.parse(content);

      // Cache the result
      await storage.createSearch({
        query: input.query,
        results: results,
      });

      res.json(results);
    } catch (err) {
      console.error("Search error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      res.status(500).json({ message: "Failed to fetch results" });
    }
  });

  return httpServer;
}
