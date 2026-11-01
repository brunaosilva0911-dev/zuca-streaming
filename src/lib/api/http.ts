import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: true;
  code: string;
  message: string;
  retryable: boolean;
}

export interface ApiOkBody<T> {
  error: false;
  data: T;
  generatedAt: string;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiOkBody<T>> {
  return NextResponse.json<ApiOkBody<T>>(
    { error: false, data, generatedAt: new Date().toISOString() },
    {
      ...init,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        ...(init?.headers ?? {}),
      },
    },
  );
}

export function fail(
  status: number,
  code: string,
  message: string,
  retryable = true,
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { error: true, code, message, retryable },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** Uniform handler wrapper: every route degrades gracefully instead of 500ing raw. */
export async function route<T>(
  handler: () => Promise<T>,
  fallback: { status: number; code: string; message: string },
): Promise<NextResponse> {
  try {
    const data = await handler();
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : fallback.message;
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? ((error as { status: number }).status as number)
        : fallback.status;
    return fail(status, fallback.code, message, status >= 500);
  }
}
