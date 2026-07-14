import {
  and,
  count,
  desc,
  eq,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";

import type { AppDatabase } from "@/db/client";
import { researchReports } from "@/db/reports-schema";

export type PublicReportCard = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  accessLevel: "public" | "member";
  sourceInstitution: string;
  sourceReportDate: string | null;
  authorName: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  tags: string[];
  publishedAt: string;
};

export type PublicReportDetail = PublicReportCard & {
  bodyHtml: string;
  previewMode: "none" | "paywall_marker" | "summary_only";
  seoTitle: string | null;
  seoDescription: string | null;
};

function publicConditions(now: Date) {
  return and(
    eq(researchReports.status, "published"),
    ne(researchReports.accessLevel, "private"),
    isNull(researchReports.deletedAt),
    lte(researchReports.publishedAt, now),
    or(
      isNull(researchReports.scheduledAt),
      lte(researchReports.scheduledAt, now),
    ),
  );
}

function toCard(row: {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  accessLevel: "public" | "member" | "private";
  sourceInstitution: string;
  sourceReportDate: string | null;
  authorName: string | null;
  coverAssetId: string | null;
  tags: string[];
  publishedAt: Date | null;
}): PublicReportCard {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    summary: row.summary,
    accessLevel: row.accessLevel === "public" ? "public" : "member",
    sourceInstitution: row.sourceInstitution,
    sourceReportDate: row.sourceReportDate,
    authorName: row.authorName,
    coverAssetId: row.coverAssetId,
    coverUrl: row.coverAssetId ? `/media/${row.coverAssetId}` : null,
    tags: row.tags,
    publishedAt: row.publishedAt!.toISOString(),
  };
}

export async function listPublicReports(
  db: AppDatabase,
  input: { page: number; pageSize: number; now?: Date },
): Promise<{ items: PublicReportCard[]; total: number }> {
  const now = input.now ?? new Date();
  const where = publicConditions(now);
  const [{ total }] = await db
    .select({ total: count() })
    .from(researchReports)
    .where(where);
  const rows = await db
    .select({
      id: researchReports.id,
      title: researchReports.title,
      subtitle: researchReports.subtitle,
      slug: researchReports.slug,
      summary: researchReports.summary,
      accessLevel: researchReports.accessLevel,
      sourceInstitution: researchReports.sourceInstitution,
      sourceReportDate: researchReports.sourceReportDate,
      authorName: researchReports.authorName,
      coverAssetId: researchReports.coverAssetId,
      tags: researchReports.tags,
      publishedAt: researchReports.publishedAt,
    })
    .from(researchReports)
    .where(where)
    .orderBy(desc(researchReports.publishedAt), desc(researchReports.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return { items: rows.map(toCard), total };
}

export async function getPublicReportBySlug(
  db: AppDatabase,
  slug: string,
  now = new Date(),
): Promise<PublicReportDetail | null> {
  const [row] = await db
    .select({
      id: researchReports.id,
      title: researchReports.title,
      subtitle: researchReports.subtitle,
      slug: researchReports.slug,
      summary: researchReports.summary,
      bodyHtml: researchReports.bodyHtml,
      accessLevel: researchReports.accessLevel,
      previewMode: researchReports.previewMode,
      sourceInstitution: researchReports.sourceInstitution,
      sourceReportDate: researchReports.sourceReportDate,
      authorName: researchReports.authorName,
      coverAssetId: researchReports.coverAssetId,
      tags: researchReports.tags,
      publishedAt: researchReports.publishedAt,
      seoTitle: researchReports.seoTitle,
      seoDescription: researchReports.seoDescription,
    })
    .from(researchReports)
    .where(and(publicConditions(now), eq(researchReports.slug, slug)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...toCard(row),
    bodyHtml: row.bodyHtml,
    previewMode:
      row.previewMode === "none"
        ? "none"
        : row.previewMode === "paywall_marker"
          ? "paywall_marker"
          : "summary_only",
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}
