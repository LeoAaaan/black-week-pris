/**
 * Enkel robots.txt-tolker etter RFC 9309:
 * - velger gruppen for vår user-agent, ellers «*»
 * - lengste treff vinner, Allow vinner ved likt
 * - støtter jokertegn «*» og «$» på slutten
 * - leser Crawl-delay og Sitemap
 */
export interface RobotsRules {
  isAllowed(pathWithQuery: string): boolean;
  crawlDelaySeconds: number | null;
  sitemaps: string[];
}

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay: number | null;
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function parseRobots(text: string, userAgent: string): RobotsRules {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      // Tom Disallow betyr «alt er lov» og gir ingen regel.
      if (value) current.rules.push({ allow: key === 'allow', pattern: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const ua = userAgent.toLowerCase();
  const token = ua.split('/')[0]!;
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules).map((r) => ({ ...r, re: patternToRegex(r.pattern) }));
  const crawlDelay = chosen.map((g) => g.crawlDelay).find((d) => d != null) ?? null;

  return {
    crawlDelaySeconds: crawlDelay,
    sitemaps,
    isAllowed(path: string) {
      let best: { len: number; allow: boolean } | null = null;
      for (const r of rules) {
        if (!r.re.test(path)) continue;
        const len = r.pattern.length;
        if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
      }
      return best ? best.allow : true;
    },
  };
}
