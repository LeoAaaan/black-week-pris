# Black Week-pris

App som sammenligner Black Week-tilbud i norske nettbutikker, så du raskt finner det billigste alternativet.

**Status:** MVP på mock-data (8 butikker, 33 produkter, 60 dager prishistorikk). Ekte butikkdata kommer via adaptere.

## Funksjoner

- Søk med autoforslag som tåler skrivefeil («airpdos pro», «playstaton», «ps5»)
- Produktside med alle tilbud: butikk, pris, førpris, rabatt (% og kr), frakt, totalpris, lagerstatus, leveringstid og lenke til butikken
- Filtre: prisintervall, butikk, kategori, merke, på lager, minste rabatt, gratis frakt
- Sortering: totalpris, rabatt, nyeste tilbud
- «Ekte tilbud?»: sammenligner tilbudsprisen med laveste pris de 30 dagene før tilbudet, og flagger oppblåste førpriser
- Viser når prisen sist ble oppdatert, og en graf over laveste pris per dag

## Oppbygging

```
apps/mobile/        Expo-app (React Native, Expo Router, TanStack Query)
apps/api/           Next.js API: /api/search, /api/suggest, /api/products/[slug]
packages/shared/    typer, prisberegning, «ekte tilbud»-sjekk, produktmatching, NOK-formatering + tester
packages/db/        Prisma-schema, migrasjoner, mock-data (seed), databasespørringer
packages/adapters/  butikk-adaptere, høflig HTTP-klient (robots.txt, rate limiting, cache), JSON-LD-leser
```

Alle beløp lagres som heltall i øre. Søk bruker Postgres-utvidelsen `pg_trgm`.

## Kom i gang

Krever Node 22, pnpm 10 og Docker (eller en egen PostgreSQL 16).

```bash
pnpm install
cp .env.example .env
pnpm db:up          # starter PostgreSQL i Docker
pnpm db:migrate     # lager tabellene
pnpm db:seed        # fyller inn mock-data
pnpm dev:api        # API på http://localhost:3001
pnpm dev:mobile     # Expo: skann QR-koden med Expo Go, eller trykk w for nettleser
```

På telefonen finner appen API-et automatisk via samme maskin som Expo kjører på (telefon og PC må være på samme nett). I produksjon settes `EXPO_PUBLIC_API_URL`.

## Butikk-adaptere

Hver butikk har én adapter som implementerer `StoreAdapter` (`packages/adapters/src/types.ts`).
Prioritet: offisielle API-er og produktfeeder, deretter schema.org/JSON-LD på produktsidene, scraping bare som siste utvei.

Den generiske JSON-LD-adapteren finner produktsider via sitemapene i butikkens robots.txt, følger robots.txt-reglene og Crawl-delay,
venter minst 2 sekunder mellom kall til samme butikk, cacher svar og prøver igjen ved 429/5xx.
Tilbudene kobles til produkter via EAN/GTIN → modellnummer → navn. Ukjente produkter med gyldig EAN blir nye produkter; resten logges som umatchet.

```bash
pnpm --filter @bwp/adapters run-store komplett --limit 20 --dry-run   # se hva som ville blitt lagret
pnpm --filter @bwp/adapters run-store komplett --limit 20             # lagre
```

Butikkoppsettene i `packages/adapters/src/stores/` er ikke verifisert mot ekte sider ennå.

## Tester

```bash
pnpm test        # Vitest: matching, prisberegning, ekte tilbud, filtre, formatering
pnpm typecheck
```

## API

| Endepunkt | Beskrivelse |
|---|---|
| `GET /api/search?q=&minPrice=&maxPrice=&stores=a,b&category=&brands=a,b&inStock=1&minDiscount=20&freeShipping=1&sort=price\|discount\|newest` | Produkter med beste tilbud, pluss tellinger til filtrene. Priser i hele kroner. |
| `GET /api/suggest?q=` | Autoforslag (maks 8) |
| `GET /api/products/:slug` | Produkt med alle tilbud og prishistorikk |
