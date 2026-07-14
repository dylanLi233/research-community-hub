import { NextResponse } from "next/server";

export type ApiErrorDetail = {
  field?: string;
  code: string;
  message: string;
};

export function apiError(
  code: string,
  message: string,
  status: number,
  options: {
    details?: ApiErrorDetail[];
    headers?: HeadersInit;
  } = {},
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options.details ? { details: options.details } : {}),
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...options.headers,
      },
    },
  );
}

export function validationDetails(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string; code: string }>,
): ApiErrorDetail[] {
  return issues.map((issue) => ({
    field: issue.path.join("."),
    code: issue.code.toUpperCase(),
    message: issue.message,
  }));
}
