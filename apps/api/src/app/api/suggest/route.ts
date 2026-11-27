import { suggest } from '@bwp/db';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/suggest?q=airpd → autoforslag som tåler skrivefeil */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return json([]);
  return json(await suggest(q), { maxAge: 300 });
}
