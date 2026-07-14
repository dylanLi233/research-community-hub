interface CloudflareEnv {
  ASSETS?: Fetcher;
  ASSETS_BUCKET: R2Bucket;
  DB: D1Database;
  BOOTSTRAP_ADMIN_SECRET?: string;
}
