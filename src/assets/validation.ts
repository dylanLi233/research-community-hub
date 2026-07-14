import { z } from "zod";

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  query: z.string().trim().max(100).optional(),
  status: z.enum(["active", "deleted"]).optional(),
});
