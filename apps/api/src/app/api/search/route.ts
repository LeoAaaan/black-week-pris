import { searchProducts } from '@bwp/db';
import { parseSearchParams } from '@bwp/shared';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/search?q=airpods&stores=elkjop,power&inStock=1&minDiscount=20&sort=discount */
export async function GET(req: Request) {
  const filters = parseSearchParams(new URL(req.url).searchParams);
  return json(await searchProducts(filters));
}
