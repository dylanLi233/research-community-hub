import Image from "next/image";
import Link from "next/link";

import { listAdminAssets } from "@/assets/service";
import { assetListQuerySchema } from "@/assets/validation";
import { AssetDeleteButton } from "@/components/admin/asset-delete-button";
import { AssetUploadForm } from "@/components/admin/asset-upload-form";
import { getDb } from "@/db/client";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AdminAssetsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = assetListQuerySchema.safeParse({
    page: scalar(raw.page),
    pageSize: scalar(raw.pageSize),
    query: scalar(raw.query),
    status: scalar(raw.status) || undefined,
  });
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 24, query: undefined, status: "active" as const };
  const db = await getDb();
  const result = await listAdminAssets(db, query);
  const pageCount = Math.max(1, Math.ceil(result.total / query.pageSize));

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (query.query) params.set("query", query.query);
    if (query.status) params.set("status", query.status);
    params.set("page", String(page));
    return `/admin/assets?${params.toString()}`;
  }

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Asset Library</span>
          <h1>素材库</h1>
          <p>图片字节存储在 Cloudflare R2，数据库只保存尺寸、哈希和公开地址等元数据。</p>
        </div>
      </div>

      <section className="asset-upload-panel" aria-labelledby="asset-upload-title">
        <div>
          <h2 id="asset-upload-title">上传图片</h2>
          <p>文件扩展名不会被信任，系统会从图片内容识别真实格式和尺寸。</p>
        </div>
        <AssetUploadForm />
      </section>

      <form className="admin-filters asset-filters" method="get">
        <label>
          <span>搜索</span>
          <input
            name="query"
            defaultValue={query.query}
            placeholder="原文件名或图片说明"
          />
        </label>
        <label>
          <span>状态</span>
          <select name="status" defaultValue={query.status ?? ""}>
            <option value="">全部</option>
            <option value="active">可用</option>
            <option value="deleted">已删除</option>
          </select>
        </label>
        <button type="submit">筛选</button>
      </form>

      <section className="asset-grid" aria-label="素材列表">
        {result.items.map((asset) => (
          <article className="asset-card" key={asset.id}>
            <div className="asset-preview">
              {asset.status === "active" ? (
                <Image
                  src={asset.url}
                  alt={asset.altText || asset.originalFilename}
                  width={asset.width}
                  height={asset.height}
                  sizes="(max-width: 700px) 100vw, 320px"
                  unoptimized
                />
              ) : (
                <div className="asset-deleted-placeholder">已删除</div>
              )}
            </div>
            <div className="asset-card-body">
              <div className="asset-card-title">
                <strong>{asset.originalFilename}</strong>
                <span>{asset.status === "active" ? "可用" : "已删除"}</span>
              </div>
              <p>{asset.altText || "未填写图片说明"}</p>
              <dl>
                <div>
                  <dt>格式</dt>
                  <dd>{asset.mimeType}</dd>
                </div>
                <div>
                  <dt>尺寸</dt>
                  <dd>{asset.width} × {asset.height}</dd>
                </div>
                <div>
                  <dt>大小</dt>
                  <dd>{formatBytes(asset.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>上传者</dt>
                  <dd>{asset.uploadedBy || asset.source}</dd>
                </div>
              </dl>
              <div className="asset-card-actions">
                {asset.status === "active" ? (
                  <>
                    <Link href={asset.url} target="_blank">
                      打开原图
                    </Link>
                    <AssetDeleteButton
                      assetId={asset.id}
                      filename={asset.originalFilename}
                    />
                  </>
                ) : (
                  <span>
                    删除于 {asset.deletedAt ? new Date(asset.deletedAt).toLocaleString("zh-CN") : "—"}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
        {result.items.length === 0 ? (
          <div className="asset-empty">没有符合条件的素材。</div>
        ) : null}
      </section>

      <div className="admin-pagination">
        <span>
          共 {result.total} 个素材 · 第 {query.page}/{pageCount} 页
        </span>
        <div>
          {query.page > 1 ? <Link href={pageHref(query.page - 1)}>上一页</Link> : null}
          {query.page < pageCount ? (
            <Link href={pageHref(query.page + 1)}>下一页</Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
