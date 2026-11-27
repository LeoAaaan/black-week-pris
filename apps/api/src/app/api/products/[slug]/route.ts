import { getProduct } from '@bwp/db';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/products/apple-airpods-pro-2-usb-c */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const product = await getProduct(slug);
  if (!product) return json({ error: 'Fant ikke produktet' }, { status: 404, maxAge: 0 });
  return json(product);
}
