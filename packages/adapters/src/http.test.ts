import { describe, expect, it } from 'vitest';
import { PoliteHttpClient, RobotsDisallowedError } from './http';

function fakeServer(routes: Record<string, (() => Response) | Response[]>) {
  const calls: { url: string; at: number }[] = [];
  let clock = 0;
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    calls.push({ url, at: clock });
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404 });
    if (Array.isArray(route)) return route.shift() ?? new Response('gone', { status: 404 });
    return route();
  }) as typeof fetch;
  const client = new PoliteHttpClient({
    fetchImpl,
    minIntervalMs: 1000,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  return { client, calls, advance: (ms: number) => (clock += ms) };
}

const ok = (body: string) => () => new Response(body, { status: 200 });

describe('PoliteHttpClient', () => {
  it('sjekker robots.txt og nekter blokkerte sider', async () => {
    const { client } = fakeServer({
      'https://shop.test/robots.txt': ok('User-agent: *\nDisallow: /kasse'),
      'https://shop.test/vare/1': ok('vare'),
    });
    await expect(client.getText('https://shop.test/vare/1')).resolves.toBe('vare');
    await expect(client.getText('https://shop.test/kasse')).rejects.toBeInstanceOf(RobotsDisallowedError);
  });

  it('venter mellom kall til samme domene, og bruker Crawl-delay når den er lengre', async () => {
    const { client, calls } = fakeServer({
      'https://shop.test/robots.txt': ok('User-agent: *\nCrawl-delay: 5'),
      'https://shop.test/a': ok('a'),
      'https://shop.test/b': ok('b'),
    });
    await client.getText('https://shop.test/a');
    await client.getText('https://shop.test/b');
    const a = calls.find((c) => c.url.endsWith('/a'))!.at;
    const b = calls.find((c) => c.url.endsWith('/b'))!.at;
    expect(b - a).toBeGreaterThanOrEqual(5000);
  });

  it('cacher svar', async () => {
    const { client, calls } = fakeServer({
      'https://shop.test/robots.txt': ok(''),
      'https://shop.test/a': ok('a'),
    });
    await client.getText('https://shop.test/a');
    await client.getText('https://shop.test/a');
    expect(calls.filter((c) => c.url.endsWith('/a'))).toHaveLength(1);
  });

  it('prøver igjen ved 429 og respekterer Retry-After', async () => {
    const { client, calls } = fakeServer({
      'https://shop.test/robots.txt': ok(''),
      'https://shop.test/a': [
        new Response('slow down', { status: 429, headers: { 'Retry-After': '30' } }),
        new Response('a', { status: 200 }),
      ],
    });
    await expect(client.getText('https://shop.test/a')).resolves.toBe('a');
    const tries = calls.filter((c) => c.url.endsWith('/a'));
    expect(tries).toHaveLength(2);
    expect(tries[1]!.at - tries[0]!.at).toBeGreaterThanOrEqual(30000);
  });

  it('gir opp ved 404 uten å prøve igjen', async () => {
    const { client, calls } = fakeServer({ 'https://shop.test/robots.txt': ok('') });
    await expect(client.getText('https://shop.test/borte')).rejects.toThrow('HTTP 404');
    expect(calls.filter((c) => c.url.endsWith('/borte'))).toHaveLength(1);
  });

  it('stopper alt hvis robots.txt gir serverfeil', async () => {
    const { client } = fakeServer({
      'https://shop.test/robots.txt': () => new Response('feil', { status: 503 }),
      'https://shop.test/a': ok('a'),
    });
    await expect(client.getText('https://shop.test/a')).rejects.toBeInstanceOf(RobotsDisallowedError);
  });
});
