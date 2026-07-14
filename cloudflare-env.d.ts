interface CloudflareEnv {
  ASSETS?: Fetcher;
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  BOOTSTRAP_ADMIN_SECRET?: string;
}
