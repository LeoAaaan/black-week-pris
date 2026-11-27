/**
 * Kjør én butikk-adapter:
 *   pnpm --filter @bwp/adapters run-store komplett --limit 20 --dry-run
 */
import { prisma } from '@bwp/db';
import { ingest } from './ingest';
import { adapters } from './stores';

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx > -1 ? Number(args[limitIdx + 1]) : undefined;
  const dryRun = args.includes('--dry-run');

  const make = slug ? adapters[slug] : undefined;
  if (!make) {
    console.error(`Bruk: run-store <${Object.keys(adapters).join('|')}> [--limit N] [--dry-run]`);
    process.exit(1);
  }
  const stats = await ingest(make(), { limit, dryRun });
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
