export const PASSWORD_ALGORITHM = "pbkdf2-sha256";
export const PASSWORD_ITERATIONS = 600_000;
export const PASSWORD_SALT_BYTES = 16;
export const PASSWORD_HASH_BYTES = 32;

export const SESSION_TOKEN_BYTES = 32;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_COOKIE_NAME = "rch_session";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

export const DUMMY_PASSWORD_HASH =
  "pbkdf2-sha256$600000$cmNoLWR1bW15LXNhbHQhIQ$jz3P5OIN4c7RJZTguDTB--zBVR0tcgYlkohf83v5tgg";
