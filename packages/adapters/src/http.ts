import { parseRobots, type RobotsRules } from './robots';

export const USER_AGENT = 'BlackWeekPrisBot/0.1 (+https://github.com/LeoAaaan/black-week-pris)';

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt tillater ikke ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export interface HttpClientOptions {
  /** Minste tid mellom to kall til samme domene (ms). Crawl-delay i robots.txt vinner hvis den er lengre. */
  minIntervalMs?: number;
  /** Hvor lenge et svar caches (ms). */
  cacheTtlMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

interface CacheEntry {
  body: string;
  expires: number;
}

/**
 * Høflig HTTP-klient for alle adaptere:
 * - sjekker robots.txt før hvert kall (og cacher reglene per domene)
 * - rate limiting per domene, og respekterer Crawl-delay
 * - cacher svar i minnet
 * - prøver igjen ved 429/5xx med økende ventetid, og respekterer Retry-After
 */
export class PoliteHttpClient {
  private robots = new Map<string, Promise<RobotsRules>>();
  private nextSlot = new Map<string, number>();
  private cache = new Map<string, CacheEntry>();
  private readonly o: Required<HttpClientOptions>;

  constructor(options: HttpClientOptions = {}) {
    this.o = {
      minIntervalMs: options.minIntervalMs ?? 2000,
      cacheTtlMs: options.cacheTtlMs ?? 15 * 60_000,
      maxRetries: options.maxRetries ?? 3,
      fetchImpl: options.fetchImpl ?? fetch,
      now: options.now ?? Date.now,
      sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      userAgent: options.userAgent ?? USER_AGENT,
    };
  }

  async robotsFor(origin: string): Promise<RobotsRules> {
    let rules = this.robots.get(origin);
    if (!rules) {
      rules = (async () => {
        try {
          await this.waitForSlot(origin, this.o.minIntervalMs);
          const res = await this.o.fetchImpl(`${origin}/robots.txt`, { headers: { 'User-Agent': this.o.userAgent } });
          // 4xx: ingen robots.txt = alt tillatt. 5xx: vær forsiktig og stopp alt.
          if (res.status >= 500) return parseRobots('User-agent: *\nDisallow: /', this.o.userAgent);
          if (!res.ok) return parseRobots('', this.o.userAgent);
          return parseRobots(await res.text(), this.o.userAgent);
        } catch {
          return parseRobots('User-agent: *\nDisallow: /', this.o.userAgent);
        }
      })();
      this.robots.set(origin, rules);
    }
    return rules;
  }

  private async waitForSlot(origin: string, intervalMs: number) {
    const now = this.o.now();
    const slot = Math.max(now, this.nextSlot.get(origin) ?? 0);
    this.nextSlot.set(origin, slot + intervalMs);
    if (slot > now) await this.o.sleep(slot - now);
  }

  /** Henter en side som tekst. Kaster RobotsDisallowedError hvis robots.txt sier nei. */
  async getText(url: string): Promise<string> {
    const cached = this.cache.get(url);
    if (cached && cached.expires > this.o.now()) return cached.body;

    const u = new URL(url);
    const rules = await this.robotsFor(u.origin);
    if (!rules.isAllowed(u.pathname + u.search)) throw new RobotsDisallowedError(url);
    const interval = Math.max(this.o.minIntervalMs, (rules.crawlDelaySeconds ?? 0) * 1000);

    for (let attempt = 0; ; attempt++) {
      await this.waitForSlot(u.origin, interval);
      const res = await this.o.fetchImpl(url, {
        headers: { 'User-Agent': this.o.userAgent, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
      });
      if (res.ok) {
        const body = await res.text();
        this.cache.set(url, { body, expires: this.o.now() + this.o.cacheTtlMs });
        return body;
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.o.maxRetries) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 5000;
      await this.o.sleep(backoff);
    }
  }
}
