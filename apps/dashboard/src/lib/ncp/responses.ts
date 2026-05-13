import { NextResponse } from "next/server";

type JsonBody = Record<string, unknown>;

export function ok(body: JsonBody, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      ...body,
    },
    { status },
  );
}

export function blocked(body: JsonBody, status = 200) {
  return NextResponse.json(
    {
      ok: false,
      ...body,
    },
    { status },
  );
}

export function routeError(error: unknown, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      title: "Request blocked",
      message: error instanceof Error ? error.message : "Unknown error",
    },
    { status },
  );
}
