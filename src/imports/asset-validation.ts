import { z } from "zod";

export const MAX_ASSET_IMPORT_REQUEST_BYTES = 10.5 * 1024 * 1024;

export const importAssetMetadataSchema = z.object({
  externalId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/,
      "external_id 只能包含字母、数字、点、下划线、冒号和连字符",
    ),
  accessLevel: z.enum(["public", "member", "private"]),
  altText: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

export function formDataString(
  formData: FormData,
  key: string,
): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export type ImportAssetMetadata = z.infer<typeof importAssetMetadataSchema>;
