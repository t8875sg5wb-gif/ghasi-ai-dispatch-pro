import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { allNavItems } from "@/lib/navigation";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = allNavItems.map((item) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${item.to}</loc>`,
            `    <changefreq>weekly</changefreq>`,
            `    <priority>${item.to === "/" ? "1.0" : "0.7"}</priority>`,
            `  </url>`,
          ].join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
