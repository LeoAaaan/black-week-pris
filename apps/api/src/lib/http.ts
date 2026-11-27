import { NextResponse } from 'next/server';

/**
 * JSON-svar med CORS, så Expo-appen (også i nettleser under utvikling) kan kalle API-et.
 * Kort cache: prisene oppdateres jevnlig, men samme søk fra mange brukere kan gjenbrukes.
 */
export function json(data: unknown, init: { status?: number; maxAge?: number } = {}) {
  const maxAge = init.maxAge ?? 60;
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}`,
    },
  });
}
