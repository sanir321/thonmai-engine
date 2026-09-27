import { NextResponse } from "next/server";
import { toHeaders, type RateLimitResult } from "@/lib/rate-limit";

/**
 * Every failure the API returns has the same shape, so the client can render
 * `error` without special-casing anything. Messages are written for a student
 * to read, and never include stack traces, SQL, or whether an account exists.
 */
export function jsonError(message: string, status: number, extra?: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: extra ? toHeaders(extra) : undefined },
  );
}
