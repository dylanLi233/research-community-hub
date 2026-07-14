import { z } from "zod";

import { usernameSchema } from "@/auth/validation";
import { validateMembershipRange } from "@/membership/policy";

const isoDateSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const membershipSchema = z
  .object({
    status: z.enum(["active", "inactive"]).default("active"),
    startsAt: isoDateSchema,
    expiresAt: isoDateSchema.nullable().default(null),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (value) => validateMembershipRange(value.startsAt, value.expiresAt),
    {
      path: ["expiresAt"],
      message: "会员到期时间必须晚于开始时间",
    },
  );

export const createAdminUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  password: z.string().min(12).max(128),
  role: z.enum(["member", "admin"]).default("member"),
  status: z.enum(["active", "disabled"]).default("active"),
  membership: membershipSchema.nullable().optional(),
});

export const updateAdminUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).nullable().optional(),
    role: z.enum(["member", "admin"]).optional(),
    status: z.enum(["active", "disabled"]).optional(),
    membership: membershipSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要提供一个要修改的字段",
  });

export const resetPasswordSchema = z.object({
  password: z.string().min(12).max(128),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(80).optional(),
  role: z.enum(["member", "admin"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
