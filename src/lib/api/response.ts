import { NextResponse } from "next/server";
import { corsHeadersFor } from "./cors";

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
}

const STATIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store",
};

/**
 * Resolve headers para o request. Se um Request é passado, o origin é
 * filtrado pela allowlist em configuracoes (CORS dinâmico). Caso contrário
 * (callsites legacy) usa wildcard estático para compat.
 */
async function resolveHeaders(request?: Request): Promise<Record<string, string>> {
  return request ? await corsHeadersFor(request) : STATIC_HEADERS;
}

export async function apiSuccess<T>(
  data: T,
  meta?: ApiMeta,
  status = 200,
  request?: Request
) {
  const headers = await resolveHeaders(request);
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status, headers });
}

export async function apiError(message: string, status = 400, request?: Request) {
  const headers = await resolveHeaders(request);
  return NextResponse.json({ error: message }, { status, headers });
}

export async function apiCors(request?: Request) {
  const headers = await resolveHeaders(request);
  return new Response(null, { status: 204, headers });
}

export function parsePaginacao(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  page: number;
} {
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}
