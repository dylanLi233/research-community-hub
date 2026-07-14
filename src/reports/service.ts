import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  like,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import { hashReportContent, type ReportHashInput } from "./hash";
import {
  extractMediaAssetIds,
  validateReportAssetReferences,
  type ReportAssetIssue,
} from "./media-policy";
import { canArchiveReport, canPublishReport } from "./state";
import type {
  CreateAdminReportInput,
  ReportListQueryInput,
  UpdateAdminReportInput,
} from "./validation";
import { generateId } from "@/auth/token";
import { prepareContentHtml } from "@/content/pipeline";
import { ContentHtmlError } from "@/content/types";
import { assets } from "@/db/assets-schema";
import type { AppDatabase } from "@/db/client";
import { researchReports } from "@/db/reports-schema";
import { auditLogs } from "@/db/schema";
import type { ApiErrorDetail } from "@/lib/api-response";

export class ReportServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ReportServiceError";
  }
}

type ReportInputState = ReportHashInput;
type ReportWarnings = ReturnType<typeof prepareContentHtml>["warnings"];

export type AdminReportSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  summary: string;
  accessLevel: "public" | "member" | "private";
  previewMode: "none" | "paywall_marker" | "summary_only";
  sourceInstitution: string;
  sourceReportDate: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  tags: string[];
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  publishedAt: string | null;
  scheduledAt: string | null;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminReportView = AdminReportSummary & {
  bodyHtml: string;
  authorName: string | null;
  rejectionReason: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  externalId: string | null;
};

function toReportSummary(
  row: typeof researchReports.$inferSelect,
): AdminReportSummary {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    summary: row.summary,
    accessLevel: row.accessLevel,
    previewMode: row.previewMode,
    sourceInstitution: row.sourceInstitution,
    sourceReportDate: row.sourceReportDate,
    coverAssetId: row.coverAssetId,
    coverUrl: row.coverAssetId ? `/media/${row.coverAssetId}` : null,
    tags: row.tags,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReportView(row: typeof researchReports.$inferSelect): AdminReportView {
  return {
    ...toReportSummary(row),
    bodyHtml: row.bodyHtml,
    authorName: row.authorName,
    rejectionReason: row.rejectionReason,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    externalId: row.externalId,
  };
}

function contentErrorToServiceError(error: ContentHtmlError): ReportServiceError {
  return new ReportServiceError(error.code, error.message, 422, [
    { field: error.field, code: error.code, message: error.message },
  ]);
}

function assetIssuesToServiceError(issues: ReportAssetIssue[]): ReportServiceError {
  return new ReportServiceError(
    "REPORT_ASSET_VALIDATION_FAILED",
    "研报引用的素材未通过校验",
    422,
    issues.map((issue) => ({
      field: issue.field,
      code: issue.code,
      message: issue.message,
    })),
  );
}

async function ensureSlugAvailable(
  db: AppDatabase,
  slug: string,
  excludingReportId?: string,
): Promise<void> {
  const conditions: SQL[] = [eq(researchReports.slug, slug)];

  if (excludingReportId) {
    conditions.push(ne(researchReports.id, excludingReportId));
  }

  const existing = await db
    .select({ id: researchReports.id })
    .from(researchReports)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new ReportServiceError("SLUG_CONFLICT", "Slug 已被其他研报使用", 409, [
      { field: "slug", code: "SLUG_CONFLICT", message: "Slug 必须全站唯一" },
    ]);
  }
}

async function validateAssets(
  db: AppDatabase,
  input: {
    coverAssetId: string | null;
    bodyHtml: string;
    accessLevel: ReportInputState["accessLevel"];
    previewMode: ReportInputState["previewMode"];
  },
): Promise<void> {
  const ids = new Set(extractMediaAssetIds(input.bodyHtml));

  if (input.coverAssetId) {
    ids.add(input.coverAssetId.toLowerCase());
  }

  const rows =
    ids.size === 0
      ? []
      : await db
          .select({
            id: assets.id,
            accessLevel: assets.accessLevel,
            status: assets.status,
          })
          .from(assets)
          .where(inArray(assets.id, [...ids]));
  const issues = validateReportAssetReferences({ ...input, assets: rows });

  if (issues.length > 0) {
    throw assetIssuesToServiceError(issues);
  }
}

async function prepareReportState(
  db: AppDatabase,
  input: ReportInputState,
): Promise<{ state: ReportInputState; warnings: ReportWarnings }> {
  let prepared: ReturnType<typeof prepareContentHtml>;

  try {
    prepared = prepareContentHtml({
      rawHtml: input.bodyHtml,
      accessLevel: input.accessLevel,
      previewMode: input.previewMode,
    });
  } catch (error) {
    if (error instanceof ContentHtmlError) {
      throw contentErrorToServiceError(error);
    }

    throw error;
  }

  const state = { ...input, bodyHtml: prepared.bodyHtml };
  await validateAssets(db, state);

  return { state, warnings: prepared.warnings };
}

function createInputState(input: CreateAdminReportInput): ReportInputState {
  return {
    title: input.title,
    subtitle: input.subtitle ?? null,
    slug: input.slug,
    summary: input.summary,
    bodyHtml: input.bodyHtml,
    accessLevel: input.accessLevel,
    previewMode: input.previewMode,
    sourceInstitution: input.sourceInstitution,
    sourceReportDate: input.sourceReportDate ?? null,
    authorName: input.authorName ?? null,
    coverAssetId: input.coverAssetId ?? null,
    tags: input.tags,
    scheduledAt: input.scheduledAt ?? null,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };
}

function mergeUpdateInput(
  current: typeof researchReports.$inferSelect,
  input: UpdateAdminReportInput,
): ReportInputState {
  return {
    title: input.title ?? current.title,
    subtitle: input.subtitle === undefined ? current.subtitle : input.subtitle,
    slug: input.slug ?? current.slug,
    summary: input.summary ?? current.summary,
    bodyHtml: input.bodyHtml ?? current.bodyHtml,
    accessLevel: input.accessLevel ?? current.accessLevel,
    previewMode: input.previewMode ?? current.previewMode,
    sourceInstitution: input.sourceInstitution ?? current.sourceInstitution,
    sourceReportDate:
      input.sourceReportDate === undefined
        ? current.sourceReportDate
        : input.sourceReportDate,
    authorName:
      input.authorName === undefined ? current.authorName : input.authorName,
    coverAssetId:
      input.coverAssetId === undefined
        ? current.coverAssetId
        : input.coverAssetId,
    tags: input.tags ?? current.tags,
    scheduledAt:
      input.scheduledAt === undefined ? current.scheduledAt : input.scheduledAt,
    seoTitle: input.seoTitle === undefined ? current.seoTitle : input.seoTitle,
    seoDescription:
      input.seoDescription === undefined
        ? current.seoDescription
        : input.seoDescription,
  };
}

async function getReportRow(
  db: AppDatabase,
  reportId: string,
): Promise<typeof researchReports.$inferSelect> {
  const [report] = await db
    .select()
    .from(researchReports)
    .where(and(eq(researchReports.id, reportId), isNull(researchReports.deletedAt)))
    .limit(1);

  if (!report) {
    throw new ReportServiceError("REPORT_NOT_FOUND", "研报不存在", 404);
  }

  return report;
}

export async function listAdminReports(
  db: AppDatabase,
  input: ReportListQueryInput,
): Promise<{ items: AdminReportSummary[]; total: number }> {
  const conditions: SQL[] = [isNull(researchReports.deletedAt)];

  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(
      or(
        like(researchReports.title, pattern),
        like(researchReports.subtitle, pattern),
        like(researchReports.summary, pattern),
      )!,
    );
  }

  if (input.status) {
    conditions.push(eq(researchReports.status, input.status));
  }

  if (input.accessLevel) {
    conditions.push(eq(researchReports.accessLevel, input.accessLevel));
  }

  if (input.sourceInstitution) {
    conditions.push(
      like(researchReports.sourceInstitution, `%${input.sourceInstitution}%`),
    );
  }

  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(researchReports)
    .where(where);
  const rows = await db
    .select()
    .from(researchReports)
    .where(where)
    .orderBy(desc(researchReports.updatedAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return { items: rows.map(toReportSummary), total };
}

export async function getAdminReport(
  db: AppDatabase,
  reportId: string,
): Promise<AdminReportView> {
  return toReportView(await getReportRow(db, reportId));
}

export async function createAdminReport(
  db: AppDatabase,
  actorUserId: string,
  input: CreateAdminReportInput,
): Promise<{ report: AdminReportView; warnings: ReportWarnings }> {
  await ensureSlugAvailable(db, input.slug);
  const prepared = await prepareReportState(db, createInputState(input));
  const now = new Date();
  const reportId = generateId();
  const contentHash = await hashReportContent(prepared.state);

  await db.batch([
    db.insert(researchReports).values({
      id: reportId,
      ...prepared.state,
      contentHash,
      status: "draft",
      createdByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.report_created",
      resourceType: "research_report",
      resourceId: reportId,
      metadata: { slug: prepared.state.slug, contentHash },
      createdAt: now,
    }),
  ]);

  return {
    report: await getAdminReport(db, reportId),
    warnings: prepared.warnings,
  };
}

export async function updateAdminReport(
  db: AppDatabase,
  actorUserId: string,
  reportId: string,
  input: UpdateAdminReportInput,
): Promise<{ report: AdminReportView; warnings: ReportWarnings }> {
  const current = await getReportRow(db, reportId);
  const merged = mergeUpdateInput(current, input);

  if (merged.slug !== current.slug) {
    await ensureSlugAvailable(db, merged.slug, reportId);
  }

  const prepared = await prepareReportState(db, merged);
  const contentHash = await hashReportContent(prepared.state);
  const now = new Date();

  await db.batch([
    db
      .update(researchReports)
      .set({ ...prepared.state, contentHash, updatedAt: now })
      .where(eq(researchReports.id, reportId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.report_updated",
      resourceType: "research_report",
      resourceId: reportId,
      metadata: {
        changedFields: Object.keys(input),
        previousContentHash: current.contentHash,
        contentHash,
      },
      createdAt: now,
    }),
  ]);

  return {
    report: await getAdminReport(db, reportId),
    warnings: prepared.warnings,
  };
}

export async function publishAdminReport(
  db: AppDatabase,
  actorUserId: string,
  reportId: string,
): Promise<AdminReportView> {
  const current = await getReportRow(db, reportId);

  if (!canPublishReport(current.status)) {
    throw new ReportServiceError(
      "INVALID_REPORT_TRANSITION",
      "当前研报状态不能执行发布",
      409,
    );
  }

  await validateAssets(db, current);
  const now = new Date();

  await db.batch([
    db
      .update(researchReports)
      .set({
        status: "published",
        publishedAt: now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(researchReports.id, reportId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.report_published",
      resourceType: "research_report",
      resourceId: reportId,
      metadata: { previousStatus: current.status },
      createdAt: now,
    }),
  ]);

  return getAdminReport(db, reportId);
}

export async function archiveAdminReport(
  db: AppDatabase,
  actorUserId: string,
  reportId: string,
): Promise<AdminReportView> {
  const current = await getReportRow(db, reportId);

  if (!canArchiveReport(current.status)) {
    throw new ReportServiceError(
      "INVALID_REPORT_TRANSITION",
      "只有已发布研报可以归档",
      409,
    );
  }

  const now = new Date();
  await db.batch([
    db
      .update(researchReports)
      .set({ status: "archived", updatedAt: now })
      .where(eq(researchReports.id, reportId)),
    db.insert(auditLogs).values({
      id: generateId(),
      actorType: "user",
      actorId: actorUserId,
      action: "admin.report_archived",
      resourceType: "research_report",
      resourceId: reportId,
      metadata: { previousStatus: current.status },
      createdAt: now,
    }),
  ]);

  return getAdminReport(db, reportId);
}
