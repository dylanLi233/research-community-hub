import {
  PASSWORD_ALGORITHM,
  PASSWORD_HASH_BYTES,
  PASSWORD_ITERATIONS,
  PASSWORD_SALT_BYTES,
} from "./constants";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  constantTimeEqual,
} from "@/lib/base64url";

const encoder = new TextEncoder();

type HashPasswordOptions = {
  iterations?: number;
  salt?: Uint8Array;
};

function randomBytes(length: number): Uint8Array {
  const value = new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const workerSafeSalt = Uint8Array.from(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: workerSafeSalt,
      iterations,
    },
    key,
    PASSWORD_HASH_BYTES * 8,
  );

  return new Uint8Array(bits);
}

export async function hashPassword(
  password: string,
  options: HashPasswordOptions = {},
): Promise<string> {
  const iterations = options.iterations ?? PASSWORD_ITERATIONS;
  const salt = options.salt ?? randomBytes(PASSWORD_SALT_BYTES);

  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    throw new Error("Password hash iterations must be a positive integer");
  }

  if (salt.length < PASSWORD_SALT_BYTES) {
    throw new Error(`Password salt must be at least ${PASSWORD_SALT_BYTES} bytes`);
  }

  const hash = await derivePassword(password, salt, iterations);

  return [
    PASSWORD_ALGORITHM,
    iterations.toString(),
    bytesToBase64Url(salt),
    bytesToBase64Url(hash),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  try {
    const [algorithm, rawIterations, rawSalt, rawHash, extra] =
      encodedHash.split("$");

    if (
      algorithm !== PASSWORD_ALGORITHM ||
      !rawIterations ||
      !rawSalt ||
      !rawHash ||
      extra !== undefined
    ) {
      return false;
    }

    const iterations = Number(rawIterations);

    if (
      !Number.isSafeInteger(iterations) ||
      iterations < 1 ||
      iterations > 10_000_000
    ) {
      return false;
    }

    const salt = base64UrlToBytes(rawSalt);
    const expectedHash = base64UrlToBytes(rawHash);

    if (
      salt.length < PASSWORD_SALT_BYTES ||
      expectedHash.length !== PASSWORD_HASH_BYTES
    ) {
      return false;
    }

    const actualHash = await derivePassword(password, salt, iterations);
    return constantTimeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

export function passwordHashNeedsUpgrade(encodedHash: string): boolean {
  const [algorithm, rawIterations] = encodedHash.split("$");
  const iterations = Number(rawIterations);

  return (
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isSafeInteger(iterations) ||
    iterations < PASSWORD_ITERATIONS
  );
}
