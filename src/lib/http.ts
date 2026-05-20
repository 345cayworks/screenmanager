import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handle<T>(fn: () => Promise<T>) {
  return fn().catch((err) => {
    if (err instanceof HttpError) return fail(err.status, err.message);
    console.error("[api] unhandled error", err);
    return fail(500, "Internal Server Error");
  });
}
