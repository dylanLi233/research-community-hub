import { z } from "zod";

const usernamePattern = /^[\p{L}\p{N}._-]+$/u;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少需要 3 个字符")
  .max(64, "用户名不能超过 64 个字符")
  .regex(usernamePattern, "用户名只能包含文字、数字、点、下划线和连字符");

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
  returnTo: z.string().max(2048).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z
      .string()
      .min(12, "新密码至少需要 12 个字符")
      .max(128, "新密码不能超过 128 个字符"),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "新密码不能与当前密码相同",
  });

export const bootstrapAdminSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(12).max(128),
});

export function normalizeUsername(username: string): string {
  return username.trim().normalize("NFKC").toLocaleLowerCase("und");
}

export function safeReturnTo(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) {
    return fallback;
  }

  try {
    const base = new URL("https://local.invalid");
    const target = new URL(value, base);

    if (target.origin !== base.origin || !value.startsWith("/")) {
      return fallback;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
