import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth first
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.auth.me.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.json(null);
    }
    const replitId = req.user.claims.sub;
    const user = await storage.upsertUser({ 
      replitId,
      email: req.user.claims.email,
      firstName: req.user.claims.first_name,
      lastName: req.user.claims.last_name,
      profileImageUrl: req.user.claims.profile_image_url
    });
    res.json(user);
  });

  app.post(api.search.query.path, async (req, res) => {
    try {
      const input = api.search.query.input.parse(req.body);
      const cached = await storage.getSearchByQuery(input.query);
      if (cached) return res.json(cached.results);

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are helpful assistant for "Recovery on Campus Resource Hub" in Alberta.
            Return JSON matching:
            {
              "services": [{
                "id": "string",
                "name": "string",
                "category": "string",
                "description": "string",
                "location": "string",
                "contact": "string",
                "eligibility": "string",
                "process": ["step 1", "step 2"],
                "waitTimes": "string",
                "requiredDocs": ["doc 1"]
              }],
              "summary": "string"
            }`
          },
          { role: "user", content: input.query }
        ],
        response_format: { type: "json_object" },
      });

      const results = JSON.parse(completion.choices[0].message.content!);
      await storage.createSearch({ query: input.query, results });
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get(api.favorites.list.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.json([]);
    const favs = await storage.getFavorites(user.id);
    res.json(favs);
  });

  app.post(api.favorites.add.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const input = api.favorites.add.input.parse(req.body);
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.status(401).send();
    
    const fav = await storage.addFavorite({
      userId: user.id,
      ...input,
      status: 'saved',
      completedSteps: []
    });
    res.status(201).json(fav);
  });

  app.patch(api.favorites.update.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.status(401).send();
    
    const id = parseInt(req.params.id);
    const favorite = await storage.getFavorite(id);
    if (!favorite || favorite.userId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const input = api.favorites.update.input.parse(req.body);
    const updated = await storage.updateFavorite(id, input);
    res.json(updated);
  });

  app.delete(api.favorites.delete.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.status(401).send();
    
    const id = parseInt(req.params.id);
    const favorite = await storage.getFavorite(id);
    if (!favorite || favorite.userId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteFavorite(id);
    res.status(204).send();
  });

  // Profile endpoints
  app.get(api.profile.get.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json(user);
  });

  app.patch(api.profile.update.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    const input = api.profile.update.input.parse(req.body);
    const updated = await storage.updateUserDemographics(user.id, input);
    res.json(updated);
  });

  // Recommendations endpoint
  app.get(api.recommendations.get.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUserByReplitId(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const favorites = await storage.getFavorites(user.id);
      
      // Build context for recommendations
      const demographicContext = [];
      if (user.age) demographicContext.push(`Age: ${user.age}`);
      if (user.gender) demographicContext.push(`Gender: ${user.gender}`);
      if (user.race) demographicContext.push(`Race/Ethnicity: ${user.race}`);
      if (user.sexuality) demographicContext.push(`Sexual Orientation: ${user.sexuality}`);
      
      const favoriteCategories = Array.from(new Set(favorites.map(f => f.category)));
      const favoriteNames = favorites.slice(0, 5).map(f => f.serviceName);
      
      const prompt = `You are a helpful assistant for "Recovery on Campus Resource Hub" in Alberta, Canada.
      
Based on the user's profile and preferences, recommend 5-7 relevant recovery and support services.

${demographicContext.length > 0 ? `User Demographics (use to personalize recommendations):
${demographicContext.join('\n')}` : 'No demographic information provided - give general recommendations.'}

${favoriteCategories.length > 0 ? `User's favorite service categories: ${favoriteCategories.join(', ')}` : 'No favorites yet.'}
${favoriteNames.length > 0 ? `Services they've saved: ${favoriteNames.join(', ')}` : ''}

IMPORTANT: Consider services that would be especially relevant or welcoming for this user's identity and needs.
For example:
- LGBTQ2S+ resources if relevant to sexuality/gender
- Culturally-specific services if relevant to race/ethnicity  
- Age-appropriate services
- Similar services to their favorites but in different categories they haven't explored

Return JSON matching:
{
  "recommendations": [{
    "id": "string (unique id)",
    "name": "string (service name)",
    "category": "string (e.g., Mental Health, Financial Aid, Housing, LGBTQ2S+ Support, Cultural Services)",
    "description": "string (brief description)",
    "reasoning": "string (why this is recommended for this user)",
    "location": "string",
    "contact": "string", 
    "eligibility": "string",
    "process": ["step 1", "step 2"],
    "waitTimes": "string",
    "requiredDocs": ["doc 1"]
  }],
  "summary": "string (personalized summary explaining these recommendations)"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Please provide personalized service recommendations." }
        ],
        response_format: { type: "json_object" },
      });

      const results = JSON.parse(completion.choices[0].message.content!);
      res.json(results);
    } catch (err) {
      console.error("Recommendations error:", err);
      res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  return httpServer;
}
