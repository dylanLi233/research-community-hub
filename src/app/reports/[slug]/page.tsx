import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerSession } from "@/auth/authorization";
import { renderContentHtml } from "@/content/render";
import { getDb } from "@/db/client";
import { resolveReportAudience } from "@/reports/audience";
import { getPublicReportBySlug } from "@/reports/public-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportPageProps = {
  params: Promise<{ slug: string }>;
};

function formatCalendarDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPublishedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: ReportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();
  const report = await getPublicReportBySlug(db, slug);

  if (!report) {
    return { title: "研报不存在" };
  }

  return {
    title: report.seoTitle || report.title,
    description: report.seoDescription || report.summary,
    alternates: { canonical: `/reports/${report.slug}` },
    openGraph: {
      type: "article",
      title: report.seoTitle || report.title,
      description: report.seoDescription || report.summary,
      publishedTime: report.publishedAt,
      images: report.coverUrl ? [{ url: report.coverUrl }] : undefined,
    },
  };
}

function RestrictedNotice({
  slug,
  isAuthenticated,
  mustChangePassword,
  membershipState,
}: {
  slug: string;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  membershipState: string;
}) {
  if (mustChangePassword) {
    return (
      <aside className="paywall-card" aria-label="需要修改密码">
        <span className="paywall-kicker">账户安全</span>
        <h2>修改初始密码后继续阅读</h2>
        <p>为了保护会员内容，请先完成首次密码修改。</p>
        <Link className="paywall-action" href="/account/password">
          修改密码
        </Link>
      </aside>
    );
  }

  if (!isAuthenticated) {
    return (
      <aside className="paywall-card" aria-label="会员内容">
        <span className="paywall-kicker">Member Reading</span>
        <h2>登录后查看完整研报</h2>
        <p>访客可以阅读摘要和公开试读，有效会员可以查看完整分析。</p>
        <Link
          className="paywall-action"
          href={`/login?returnTo=${encodeURIComponent(`/reports/${slug}`)}`}
        >
          登录会员账户
        </Link>
      </aside>
    );
  }

  const message =
    membershipState === "expired"
      ? "当前会员已到期，请联系管理员续期后继续阅读。"
      : membershipState === "upcoming"
        ? "会员权益尚未开始，生效后即可查看完整内容。"
        : membershipState === "inactive"
          ? "当前会员权益未启用，请联系管理员确认。"
          : "当前账户尚未开通会员权限，请联系管理员。";

  return (
    <aside className="paywall-card" aria-label="会员权限不足">
      <span className="paywall-kicker">Member Reading</span>
      <h2>完整内容仅对有效会员开放</h2>
      <p>{message}</p>
      <Link className="paywall-secondary-action" href="/reports">
        返回研报列表
      </Link>
    </aside>
  );
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { slug } = await params;
  const db = await getDb();
  const [report, session] = await Promise.all([
    getPublicReportBySlug(db, slug),
    getServerSession(),
  ]);

  if (!report) {
    notFound();
  }

  const audience = await resolveReportAudience(db, session);
  const rendered = renderContentHtml({
    bodyHtml: report.bodyHtml,
    accessLevel: report.accessLevel,
    previewMode: report.previewMode,
    audience: audience.audience,
  });
  const sourceDate = formatCalendarDate(report.sourceReportDate);

  return (
    <main className="report-reading-main">
      <nav className="report-breadcrumb" aria-label="面包屑">
        <Link href="/reports">研报精选</Link>
        <span aria-hidden="true">/</span>
        <span>{report.sourceInstitution}</span>
      </nav>

      <article className="report-reading-shell">
        <header className="report-header">
          <div className="report-header-badges">
            <span
              className={`access-badge access-badge-${report.accessLevel}`}
            >
              {report.accessLevel === "public" ? "公开全文" : "会员研报"}
            </span>
            <span>{report.sourceInstitution}</span>
            {sourceDate ? <span>原报告 · {sourceDate}</span> : null}
          </div>

          <h1>{report.title}</h1>
          {report.subtitle ? <p className="report-subtitle">{report.subtitle}</p> : null}
          <p className="report-summary">{report.summary}</p>

          <div className="report-byline">
            {report.authorName ? <span>整理：{report.authorName}</span> : null}
            <span>发布于 {formatPublishedAt(report.publishedAt)}</span>
          </div>

          {report.tags.length > 0 ? (
            <div className="report-tags" aria-label="研报标签">
              {report.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </header>

        {report.coverUrl ? (
          <figure className="report-cover">
            <img src={report.coverUrl} alt="" />
          </figure>
        ) : null}

        {rendered.html ? (
          <div
            className="report-prose"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
        ) : null}

        {rendered.isRestricted ? (
          <RestrictedNotice
            slug={report.slug}
            isAuthenticated={audience.isAuthenticated}
            mustChangePassword={audience.mustChangePassword}
            membershipState={audience.membershipState}
          />
        ) : (
          <footer className="report-complete-footer">
            <span>全文已显示</span>
            <Link href="/reports">继续阅读其他研报</Link>
          </footer>
        )}
      </article>
    </main>
  );
}
