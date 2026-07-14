import { z } from "zod";

import { API_CLIENT_SCOPES } from "./scopes";

const scopeSchema = z.enum(API_CLIENT_SCOPES);
const scopesSchema = z
  .array(scopeSchema)
  .min(1)
  .max(API_CLIENT_SCOPES.length)
  .transform((values) => [...new Set(values)]);

export const createApiClientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: scopesSchema,
});

export const updateApiClientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "disabled"]).optional(),
    scopes: scopesSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要提供一个要修改的字段",
  });

export const createApiTokenSchema = z.object({
  expiresAt: z
    .iso.datetime({ offset: true })
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
});

export const apiClientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(120).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const reviewModeSchema = z.object({
  mode: z.enum(["on", "off"]),
});

export type CreateApiClientInput = z.infer<typeof createApiClientSchema>;
export type UpdateApiClientInput = z.infer<typeof updateApiClientSchema>;
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;
export type ApiClientListQueryInput = z.infer<typeof apiClientListQuerySchema>;
