import { z } from "zod";

export const assetUploadMetadataSchema = z.object({
  accessLevel: z.enum(["public", "member", "private"]).default("private"),
  altText: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .default(""),
});

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  accessLevel: z.enum(["public", "member", "private"]).optional(),
  status: z.enum(["active", "deleted"]).optional(),
});
