/**
 * SEO Landing Page HTML Renderer
 *
 * Generates static HTML pages for category/city landing pages.
 * Pure function — no side effects, no template engine.
 */

import type { Service } from "@shared/schema";
import type { CategoryPage, CityPage } from "./config";
import { CATEGORY_PAGES, CITY_PAGES } from "./config";

const BASE_URL = "https://albertaresourcehub.ca";
const FULL_CARD_LIMIT = 20;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).replace(/\s+\S*$/, "") + "...";
}

function renderServiceCard(service: Service): string {
  const name = escapeHtml(service.name);
  const desc = service.description
    ? escapeHtml(truncate(service.description, 200))
    : "";
  const phone = service.phone ? escapeHtml(service.phone) : "";
  const address = service.address ? escapeHtml(service.address) : "";
  const location = service.location ? escapeHtml(service.location) : "";
  const detailUrl = `${BASE_URL}/?service=${encodeURIComponent(service.serviceId)}`;

  return `      <div class="card">
        <h2><a href="${detailUrl}">${name}</a></h2>
        ${desc ? `<p class="desc">${desc}</p>` : ""}
        ${location ? `<p class="meta"><strong>Location:</strong> ${location}</p>` : ""}
        ${phone ? `<p class="meta"><strong>Phone:</strong> ${phone}</p>` : ""}
        ${address ? `<p class="meta"><strong>Address:</strong> ${address}</p>` : ""}
        <a href="${detailUrl}" class="detail-link">View details &rarr;</a>
      </div>`;
}

function renderCompactItem(service: Service): string {
  const name = escapeHtml(service.name);
  const location = service.location ? escapeHtml(service.location) : "";
  const detailUrl = `${BASE_URL}/?service=${encodeURIComponent(service.serviceId)}`;
  return `          <li><a href="${detailUrl}">${name}</a>${location ? ` — ${location}` : ""}</li>`;
}

function renderJsonLd(
  category: CategoryPage,
  city: CityPage | undefined,
  svcs: Service[],
): string {
  const name = city
    ? `${category.label} Services in ${city.label}, Alberta`
    : `${category.label} Services in Alberta`;

  const items = svcs.slice(0, 50).map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Service",
      name: s.name,
      ...(s.description && { description: truncate(s.description, 200) }),
      ...(s.phone && { telephone: s.phone }),
      ...(city && {
        areaServed: { "@type": "City", name: city.label },
      }),
    },
  }));

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: svcs.length,
    itemListElement: items,
  };

  return JSON.stringify(ld);
}

export function renderLandingPage(opts: {
  category: CategoryPage;
  city?: CityPage;
  services: Service[];
}): string {
  const { category, city, services: svcs } = opts;
  const totalCount = svcs.length;

  const titleSuffix = city ? ` in ${city.label}` : "";
  const pageTitle = `${category.metaTitle.replace(" in Alberta", "")}${titleSuffix ? ` in ${city!.label}, Alberta` : " in Alberta"}`;
  const canonicalPath = city
    ? `/${category.slug}/${city.slug}`
    : `/${category.slug}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  const metaDesc = city
    ? category.metaDescription.replace(
        /in Alberta/,
        `in ${city.label}, Alberta`,
      )
    : category.metaDescription;

  const introText = city
    ? category.intro.replace(
        /Alberta Resource Hub/,
        `Alberta Resource Hub`,
      ) + ` Showing services available in ${city.label} and province-wide.`
    : category.intro;

  const h1 = city
    ? `${category.label} Services in ${city.label}, Alberta`
    : `${category.label} Services in Alberta`;

  // Breadcrumbs
  const breadcrumbs = city
    ? `<a href="/">Home</a> &rsaquo; <a href="/${category.slug}">${escapeHtml(category.label)}</a> &rsaquo; ${escapeHtml(city.label)}`
    : `<a href="/">Home</a> &rsaquo; ${escapeHtml(category.label)}`;

  // Split services into full cards and compact list
  const fullCards = svcs.slice(0, FULL_CARD_LIMIT);
  const remaining = svcs.slice(FULL_CARD_LIMIT);

  // Service cards HTML
  const cardsHtml = fullCards.map(renderServiceCard).join("\n");
  const compactHtml =
    remaining.length > 0
      ? `
    <details class="more-services">
      <summary>Show all ${totalCount} services (${remaining.length} more)</summary>
      <ul class="compact-list">
${remaining.map(renderCompactItem).join("\n")}
      </ul>
    </details>`
      : "";

  // CTA
  const searchUrl = `${BASE_URL}/?q=${encodeURIComponent(category.query)}`;
  const ctaHtml = `<a href="${searchUrl}" class="cta">Search all ${category.label.toLowerCase()} services &rarr;</a>`;

  // Browse by city links
  const cityLinksHtml = CITY_PAGES.map((c) => {
    const active = city && c.slug === city.slug ? ' class="active"' : "";
    return `        <li><a href="/${category.slug}/${c.slug}"${active}>${escapeHtml(c.label)}</a></li>`;
  }).join("\n");

  // Browse by category links
  const catLinksHtml = CATEGORY_PAGES.map((c) => {
    const active = c.slug === category.slug ? ' class="active"' : "";
    const href = city ? `/${c.slug}/${city.slug}` : `/${c.slug}`;
    return `        <li><a href="${href}"${active}>${escapeHtml(c.label)}</a></li>`;
  }).join("\n");

  const jsonLd = renderJsonLd(category, city, svcs);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)} | Alberta Resource Hub</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(pageTitle)} | Alberta Resource Hub">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Alberta Resource Hub">
  <script type="application/ld+json">${jsonLd}</script>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <div class="container header-inner">
      <a href="/" class="logo">Alberta Resource Hub</a>
      <nav class="breadcrumbs">${breadcrumbs}</nav>
    </div>
  </header>

  <main class="container">
    <h1>${escapeHtml(h1)}</h1>
    <p class="intro">${escapeHtml(introText)}</p>
    <p class="count">Found <strong>${totalCount}</strong> service${totalCount !== 1 ? "s" : ""}.</p>

    ${ctaHtml}

    <div class="cards">
${cardsHtml}
    </div>

${compactHtml}

    <section class="browse">
      <h2>Browse ${escapeHtml(category.label)} by City</h2>
      <ul class="link-grid">
${cityLinksHtml}
      </ul>
    </section>

    <section class="browse">
      <h2>Browse Other Categories${city ? ` in ${escapeHtml(city.label)}` : ""}</h2>
      <ul class="link-grid">
${catLinksHtml}
      </ul>
    </section>
  </main>

  <footer>
    <div class="container">
      <a href="/">Search all services on Alberta Resource Hub</a>
      <p>&copy; ${new Date().getFullYear()} Alberta Resource Hub</p>
    </div>
  </footer>
</body>
</html>`;
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; background: #fafafa; }
  .container { max-width: 960px; margin: 0 auto; padding: 0 1rem; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }

  header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 1rem 0; }
  .header-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
  .logo { font-size: 1.25rem; font-weight: 700; color: #1a1a1a; }
  .breadcrumbs { font-size: 0.875rem; color: #6b7280; }
  .breadcrumbs a { color: #6b7280; }

  main { padding: 2rem 0; }
  h1 { font-size: 1.75rem; margin-bottom: 0.75rem; color: #111; }
  .intro { font-size: 1rem; color: #374151; margin-bottom: 0.5rem; max-width: 720px; }
  .count { font-size: 0.9rem; color: #6b7280; margin-bottom: 1.25rem; }

  .cta { display: inline-block; background: #2563eb; color: #fff; padding: 0.625rem 1.25rem; border-radius: 6px; font-weight: 600; margin-bottom: 1.5rem; }
  .cta:hover { background: #1d4ed8; text-decoration: none; }

  .cards { display: grid; gap: 1rem; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.25rem; }
  .card h2 { font-size: 1.1rem; margin-bottom: 0.375rem; }
  .card h2 a { color: #111; }
  .card h2 a:hover { color: #2563eb; }
  .desc { font-size: 0.9rem; color: #374151; margin-bottom: 0.5rem; }
  .meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.25rem; }
  .detail-link { font-size: 0.85rem; font-weight: 600; display: inline-block; margin-top: 0.5rem; }

  .more-services { margin: 1.5rem 0; }
  .more-services summary { cursor: pointer; font-weight: 600; color: #2563eb; font-size: 0.95rem; padding: 0.5rem 0; }
  .compact-list { list-style: none; padding: 0.5rem 0; }
  .compact-list li { padding: 0.375rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
  .compact-list li:last-child { border-bottom: none; }

  .browse { margin-top: 2.5rem; }
  .browse h2 { font-size: 1.2rem; margin-bottom: 0.75rem; color: #111; }
  .link-grid { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .link-grid li a { display: inline-block; padding: 0.375rem 0.75rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 0.85rem; }
  .link-grid li a:hover { background: #eff6ff; border-color: #2563eb; text-decoration: none; }
  .link-grid li a.active { background: #2563eb; color: #fff; border-color: #2563eb; }

  footer { margin-top: 3rem; padding: 1.5rem 0; border-top: 1px solid #e5e7eb; text-align: center; font-size: 0.85rem; color: #6b7280; }
  footer a { display: block; margin-bottom: 0.5rem; }

  @media (max-width: 640px) {
    h1 { font-size: 1.375rem; }
    .header-inner { flex-direction: column; align-items: flex-start; }
  }
`;
