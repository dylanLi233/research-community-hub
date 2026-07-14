export const API_CLIENT_SCOPES = [
  "assets:write",
  "reports:write",
  "events:write",
  "courses:write",
  "imports:read",
] as const;

export type ApiClientScope = (typeof API_CLIENT_SCOPES)[number];

const scopeSet = new Set<string>(API_CLIENT_SCOPES);

export function normalizeApiClientScopes(values: string[]): ApiClientScope[] {
  const normalized: ApiClientScope[] = [];
  const seen = new Set<ApiClientScope>();

  for (const value of values) {
    if (!scopeSet.has(value)) {
      continue;
    }

    const scope = value as ApiClientScope;

    if (!seen.has(scope)) {
      seen.add(scope);
      normalized.push(scope);
    }
  }

  return normalized;
}

export function hasApiClientScope(
  scopes: readonly string[],
  requiredScope: ApiClientScope,
): boolean {
  return scopes.includes(requiredScope);
}
