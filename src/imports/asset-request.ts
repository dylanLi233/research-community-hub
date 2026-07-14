import type { ImportAssetMetadata } from "./asset-validation";
import { hashImportRequest } from "./idempotency";

export async function hashAssetImportRequest(input: {
  metadata: ImportAssetMetadata;
  fileSha256: string;
}): Promise<string> {
  return hashImportRequest({
    external_id: input.metadata.externalId,
    access_level: input.metadata.accessLevel,
    alt_text: input.metadata.altText ?? null,
    file_sha256: input.fileSha256,
  });
}
