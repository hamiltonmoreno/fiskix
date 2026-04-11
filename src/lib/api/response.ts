import { NextResponse } from "next/server";

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
}

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store",
};

export function apiSuccess<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status, headers: BASE_HEADERS });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: BASE_HEADERS });
}

export function apiCors() {
  return new Response(null, { status: 204, headers: BASE_HEADERS });
}

export function parsePaginacao(searchParams: URLSearchParams): { limit: number; offset: number; page: number } {
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}
