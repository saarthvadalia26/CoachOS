import type { MetadataRoute } from "next";

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const now = new Date();
  const routes = [
    "",
    "/contact",
    "/login",
    "/signup",
    "/forgot-password",
    "/privacy",
    "/terms",
    "/security",
  ];

  return routes.map((route) => ({
    changeFrequency: route === "" ? "weekly" : "monthly",
    lastModified: now,
    priority: route === "" ? 1 : 0.7,
    url: `${baseUrl}${route}`,
  }));
}
