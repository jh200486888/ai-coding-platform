// @ts-nocheck
// AI SDK v7 tool() + needsApproval/execute type inference issue - keep @ts-nocheck until SDK fix
import { tool } from 'ai';
import { z } from 'zod';

const FIRECRAWL_BASE = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v1';
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || '';

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (FIRECRAWL_KEY) h['Authorization'] = `Bearer ${FIRECRAWL_KEY}`;
  return h;
}

// Firecrawl scrape - single URL to clean markdown
export const web_scrape = tool({
  description: `Scrape any URL into clean, LLM-ready markdown. Handles JavaScript rendering, anti-bot, and content extraction automatically.
Use this when you need to read the full content of a specific webpage, article, documentation, or product page.
Returns the page content as clean markdown with metadata (title, description, language).`,
  parameters: z.object({
    url: z.string().describe('The URL to scrape'),
    formats: z.array(z.enum(['markdown', 'html', 'links'])).default(['markdown']).describe('Output formats. Default: markdown only'),
    onlyMainContent: z.boolean().default(true).describe('Extract only main content, removing nav/footer/ads'),
    timeout: z.number().default(30000).describe('Timeout in ms (default 30000)'),
  }),
  execute: async ({ url, formats = ['markdown'], onlyMainContent = true, timeout = 30000 }) => {
    try {
      const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ url, formats, onlyMainContent, timeout }),
        signal: AbortSignal.timeout(timeout + 5000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { success: false, error: `Firecrawl ${res.status}: ${errText.slice(0, 200)}`, fallback: true };
      }
      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Firecrawl scrape failed', fallback: true };
      }
      const result: any = { success: true, url: data.data?.metadata?.sourceURL || url };
      if (data.data?.markdown) result.markdown = data.data.markdown;
      if (data.data?.html) result.html = data.data.html;
      if (data.data?.links) result.links = data.data.links;
      if (data.data?.metadata) result.metadata = data.data.metadata;
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown error', fallback: true };
    }
  },
});

// Firecrawl search - web search + auto-scrape results
export const web_search = tool({
  description: `Search the web and optionally get full page content for each result. Combines search and scraping in one call.
Use this when you need to find information across the web - similar to a Google search but returns actual page content.
Returns search results with titles, URLs, descriptions, and optionally full markdown content.`,
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().default(5).describe('Max results (default 5, max 10)'),
    scrapeContent: z.boolean().default(true).describe('Whether to scrape full content for each result (costs more credits)'),
    lang: z.string().default('zh').describe('Language preference for results (e.g. zh, en)'),
  }),
  execute: async ({ query, limit = 5, scrapeContent = true, lang = 'zh' }) => {
    try {
      const body: any = { query, limit: Math.min(limit, 10), lang };
      if (scrapeContent) {
        body.scrapeOptions = { formats: ['markdown'], onlyMainContent: true };
      }
      const res = await fetch(`${FIRECRAWL_BASE}/search`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { success: false, error: `Firecrawl search ${res.status}: ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      if (!data.success) {
        return { success: false, error: data.error || 'Firecrawl search failed' };
      }
      const results = (data.data || []).map((r: any) => ({
        title: r.metadata?.title || '',
        url: r.url || r.metadata?.sourceURL || '',
        description: r.metadata?.description || '',
        markdown: r.markdown || undefined,
      }));
      return { success: true, query, resultCount: results.length, results };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown error' };
    }
  },
});

export const webTools = {
  web_scrape,
  web_search,
};
