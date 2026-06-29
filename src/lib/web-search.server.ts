// Server-only Web-Zugriff für GHASI AI über den Firecrawl-Connector.
// Stellt Echtzeit-Internetsuche und das Auslesen einzelner Seiten bereit.
// Ist kein Connector verbunden, wird das sauber gemeldet (graceful fallback).

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2";

export interface WebQuelle {
  titel: string;
  url: string;
  auszug: string;
}

export interface WebSearchErgebnis {
  verbunden: boolean;
  treffer: WebQuelle[];
  fehler?: string;
}

export interface WebScrapeErgebnis {
  verbunden: boolean;
  url: string;
  titel?: string;
  inhalt?: string;
  fehler?: string;
}

function key(): string | undefined {
  return process.env.FIRECRAWL_API_KEY;
}

/** Live-Websuche. Liefert die wichtigsten Treffer inkl. kurzem Auszug. */
export async function firecrawlSearch(query: string, limit = 5): Promise<WebSearchErgebnis> {
  const apiKey = key();
  if (!apiKey) {
    return { verbunden: false, treffer: [], fehler: "Kein Web-Connector verbunden." };
  }
  try {
    const res = await fetch(`${FIRECRAWL_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) {
      return {
        verbunden: true,
        treffer: [],
        fehler: `Websuche fehlgeschlagen (HTTP ${res.status}).`,
      };
    }
    const json = (await res.json()) as {
      data?: { web?: unknown[] } | unknown[];
    };
    const raw = Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
    const treffer: WebQuelle[] = (raw as Record<string, string>[]).slice(0, limit).map((r) => ({
      titel: r.title || r.url || "Quelle",
      url: r.url,
      auszug: r.description || r.snippet || "",
    }));
    return { verbunden: true, treffer };
  } catch (e) {
    return {
      verbunden: true,
      treffer: [],
      fehler: e instanceof Error ? e.message : "Unbekannter Fehler.",
    };
  }
}

/** Liest eine konkrete Seite als Text/Markdown aus (z.B. zum Zusammenfassen). */
export async function firecrawlScrape(url: string): Promise<WebScrapeErgebnis> {
  const apiKey = key();
  if (!apiKey) {
    return { verbunden: false, url, fehler: "Kein Web-Connector verbunden." };
  }
  try {
    const res = await fetch(`${FIRECRAWL_URL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) {
      return {
        verbunden: true,
        url,
        fehler: `Seite konnte nicht gelesen werden (HTTP ${res.status}).`,
      };
    }
    const json = (await res.json()) as {
      data?: { markdown?: string; metadata?: { title?: string } };
      markdown?: string;
      metadata?: { title?: string };
    };
    const markdown = json.data?.markdown ?? json.markdown ?? "";
    const titel = json.data?.metadata?.title ?? json.metadata?.title;
    return { verbunden: true, url, titel, inhalt: markdown.slice(0, 8000) };
  } catch (e) {
    return { verbunden: true, url, fehler: e instanceof Error ? e.message : "Unbekannter Fehler." };
  }
}
