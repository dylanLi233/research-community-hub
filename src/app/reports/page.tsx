import type { Metadata } from "next";
import Link from "next/link";

import { getDb } from "@/db/client";
import { listPublicReports } from "@/reports/public-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "研报精选",
  description: "阅读经过整理和审核的机构研报，访客可试读，会员可查看完整内容。",
};

const PAGE_SIZE = 12;

function parsePage(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const page = Number(normalized ?? "1");
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "日期未标注";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const db = await getDb();
  const result = await listPublicReports(db, {
    page,
    pageSize: PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <main className="reports-main">
      <section className="reports-hero">
        <span className="eyebrow">Research Library</span>
        <h1>研报精选</h1>
        <p>
          将海外机构和产业研究整理成可持续阅读的中文内容。公开研报可阅读全文，会员研报提供摘要或公开试读。
        </p>
      </section>

      <section className="report-list" aria-label="已发布研报">
        {result.items.length === 0 ? (
          <div className="report-empty">
            <h2>暂时没有已发布研报</h2>
            <p>内容通过审核并发布后会出现在这里。</p>
          </div>
        ) : (
          result.items.map((report) => (
            <article className="report-card" key={report.id}>
              {report.coverUrl ? (
                <Link className="report-card-cover" href={`/reports/${report.slug}`}>
                  <img src={report.coverUrl} alt="" loading="lazy" />
                </Link>
              ) : (
                <div className="report-card-cover report-card-cover-placeholder" aria-hidden="true">
                  <span>RCH</span>
                </div>
              )}

              <div className="report-card-body">
                <div className="report-card-meta">
                  <span
                    className={`access-badge access-badge-${report.accessLevel}`}
                  >
                    {report.accessLevel === "public" ? "公开" : "会员"}
                  </span>
                  <span>{report.sourceInstitution}</span>
                  <span>{formatDate(report.sourceReportDate)}</span>
                </div>

                <h2>
                  <Link href={`/reports/${report.slug}`}>{report.title}</Link>
                </h2>
                {report.subtitle ? <p className="report-card-subtitle">{report.subtitle}</p> : null}
                <p className="report-card-summary">{report.summary}</p>

                {report.tags.length > 0 ? (
                  <div className="report-tags" aria-label="研报标签">
                    {report.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}

                <Link className="report-read-link" href={`/reports/${report.slug}`}>
                  阅读研报
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))
        )}
      </section>

      {pageCount > 1 ? (
        <nav className="pagination" aria-label="研报分页">
          {page > 1 ? <Link href={`/reports?page=${page - 1}`}>上一页</Link> : <span />}
          <span>
            第 {Math.min(page, pageCount)} / {pageCount} 页
          </span>
          {page < pageCount ? (
            <Link href={`/reports?page=${page + 1}`}>下一页</Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
