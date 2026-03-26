/**
 * SEO routes — /sitemap.xml, /robots.txt
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { CATEGORY_PAGES, CITY_PAGES } from "../seo/config";

const BASE_URL = "https://albertaresourcehub.ca";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedSitemap: string | null = null;
let cacheTimestamp = 0;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generateSitemap(): Promise<string> {
  const now = Date.now();
  if (cachedSitemap && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSitemap;
  }

  const services = await storage.getAllActiveServices();
  const today = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Homepage
  xml += `  <url>\n`;
  xml += `    <loc>${BASE_URL}/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  // Category landing pages
  for (const cat of CATEGORY_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/${cat.slug}</loc>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    for (const city of CITY_PAGES) {
      xml += `  <url>\n`;
      xml += `    <loc>${BASE_URL}/${cat.slug}/${city.slug}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }
  }

  // Service pages
  for (const service of services) {
    const lastmod = service.lastUpdated
      ? new Date(service.lastUpdated).toISOString().split("T")[0]
      : today;
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/?service=${escapeXml(service.serviceId)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  cachedSitemap = xml;
  cacheTimestamp = now;
  return xml;
}

const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${BASE_URL}/sitemap.xml
`;

export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const xml = await generateSitemap();
      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      console.error("Error generating sitemap:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.set("Content-Type", "text/plain");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(ROBOTS_TXT);
  });
}
