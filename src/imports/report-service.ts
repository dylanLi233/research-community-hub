import { and, eq, inArray, ne } from "drizzle-orm";

import type { ImportReportInput } from "./report-validation";
import type { ImportResponseBody } from "./log-service";
import { generateId } from "@/auth/token";
import { prepareContentHtml } from "@/content/pipeline";
import { ContentHtmlError } from "@/content/types";
import { assets } from "@/db/assets-schema";
import type { AppDatabase } from "@/db/client";
import { importResponseSnapshots } from "@/db/import-schema";
import { researchReports } from "@/db/reports-schema";
import { auditLogs, importRequests } from "@/db/schema";
import { getReviewMode } from "@/integrations/review-mode";
import { hashReportContent } from "@/reports/hash";
import {
  extractMediaAssetIds,
  validateReportAssetReferences,
} from "@/reports/media-policy";

export class ImportReportServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Array<{
      field?: string;
      code: string;
      message: string;
    }>,
  ) {
    super(message);
    this.name = "ImportReportServiceError";
  }
}

export type ImportReportAction = "created" | "updated" | "unchanged";

export type ImportReportResult = {
  httpStatus: number;
  body: ImportResponseBody;
};

async function ensureSlugAvailable(
  db: AppDatabase,
  slug: string,
  excludingReportId?: string,
): Promise<void> {
  const conditions = [eq(researchReports.slug, slug)];

  if (excludingReportId) {
    conditions.push(ne(researchReports.id, excludingReportId));
  }

  const [existing] = await db
    .select({ id: researchReports.id })
    .from(researchReports)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw new ImportReportServiceError(
      "SLUG_CONFLICT",
      "Slug 已被其他研报使用",
      409,
      [{ field: "slug", code: "SLUG_CONFLICT", message: "Slug 必须全站唯一" }],
    );
  }
}

async function validateAssets(
  db: AppDatabase,
  input: {
    coverAssetId: string | null;
    bodyHtml: string;
    accessLevel: "public" | "member" | "private";
    previewMode: "none" | "paywall_marker" | "summary_only";
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
    throw new ImportReportServiceError(
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
}

function importSuccessBody(input: {
  requestId: string;
  clientRequestId: string | null;
  action: ImportReportAction;
  reportId: string;
  externalId: string;
  status: string;
  slug: string;
  warnings: unknown[];
}): ImportResponseBody {
  return {
    request_id: input.requestId,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
    data: {
      action: input.action,
      report_id: input.reportId,
      external_id: input.externalId,
      status: input.status,
      url: `/reports/${input.slug}`,
      warnings: input.warnings,
    },
  };
}

export async function importResearchReport(
  db: AppDatabase,
  input: {
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    requestId: string;
    clientRequestId: string | null;
    report: ImportReportInput;
    startedAt: number;
  },
): Promise<ImportReportResult> {
  let prepared: ReturnType<typeof prepareContentHtml>;

  try {
    prepared = prepareContentHtml({
      rawHtml: input.report.bodyHtml,
      accessLevel: input.report.accessLevel,
      previewMode: input.report.previewMode,
    });
  } catch (error) {
    if (error instanceof ContentHtmlError) {
      throw new ImportReportServiceError(error.code, error.message, 422, [
        { field: "body_html", code: error.code, message: error.message },
      ]);
    }

    throw error;
  }

  const normalizedReport = {
    ...input.report,
    bodyHtml: prepared.bodyHtml,
  };
  await validateAssets(db, normalizedReport);
  const contentHash = await hashReportContent(normalizedReport);
  const [existing] = await db
    .select()
    .from(researchReports)
    .where(
      and(
        eq(researchReports.importedByApiClientId, input.apiClientId),
        eq(researchReports.externalId, input.report.externalId),
      ),
    )
    .limit(1);

  if (existing?.deletedAt) {
    throw new ImportReportServiceError(
      "REPORT_ARCHIVED_BY_DELETION",
      "该 external_id 对应的研报已被删除，不能自动恢复",
      409,
    );
  }

  const reviewMode = await getReviewMode(db);
  const now = new Date();
  const action: ImportReportAction = !existing
    ? "created"
    : existing.contentHash === contentHash
      ? "unchanged"
      : "updated";
  const reportId = existing?.id ?? generateId();
  const targetStatus =
    action === "unchanged"
      ? existing!.status
      : reviewMode === "on"
        ? "pending_review"
        : "published";
  const httpStatus =
    action === "unchanged"
      ? 200
      : reviewMode === "on"
        ? 202
        : action === "created"
          ? 201
          : 200;
  const responseData = importSuccessBody({
    requestId: input.requestId,
    clientRequestId: input.clientRequestId,
    action,
    reportId,
    externalId: input.report.externalId,
    status: targetStatus,
    slug: input.report.slug,
    warnings: prepared.warnings,
  });
  const importResult = prepared.warnings.length > 0 ? "warning" : "success";
  const durationMs = Date.now() - input.startedAt;

  if (action === "created") {
    await ensureSlugAvailable(db, input.report.slug);
    await db.batch([
      db.insert(researchReports).values({
        id: reportId,
        externalId: input.report.externalId,
        title: normalizedReport.title,
        subtitle: normalizedReport.subtitle,
        slug: normalizedReport.slug,
        summary: normalizedReport.summary,
        bodyHtml: normalizedReport.bodyHtml,
        accessLevel: normalizedReport.accessLevel,
        previewMode: normalizedReport.previewMode,
        sourceInstitution: normalizedReport.sourceInstitution,
        sourceReportDate: normalizedReport.sourceReportDate,
        authorName: normalizedReport.authorName,
        coverAssetId: normalizedReport.coverAssetId,
        tags: normalizedReport.tags,
        status: targetStatus,
        publishedAt: targetStatus === "published" ? now : null,
        scheduledAt: null,
        seoTitle: normalizedReport.seoTitle,
        seoDescription: normalizedReport.seoDescription,
        contentHash,
        importedByApiClientId: input.apiClientId,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/reports",
        externalId: input.report.externalId,
        contentType: "research_report",
        result: importResult,
        httpStatus,
        resourceType: "research_report",
        resourceId: reportId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.report_created",
        resourceType: "research_report",
        resourceId: reportId,
        metadata: {
          externalId: input.report.externalId,
          contentHash,
          status: targetStatus,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  } else if (action === "updated") {
    await ensureSlugAvailable(db, input.report.slug, reportId);
    await db.batch([
      db
        .update(researchReports)
        .set({
          title: normalizedReport.title,
          subtitle: normalizedReport.subtitle,
          slug: normalizedReport.slug,
          summary: normalizedReport.summary,
          bodyHtml: normalizedReport.bodyHtml,
          accessLevel: normalizedReport.accessLevel,
          previewMode: normalizedReport.previewMode,
          sourceInstitution: normalizedReport.sourceInstitution,
          sourceReportDate: normalizedReport.sourceReportDate,
          authorName: normalizedReport.authorName,
          coverAssetId: normalizedReport.coverAssetId,
          tags: normalizedReport.tags,
          status: targetStatus,
          publishedAt: targetStatus === "published" ? now : existing!.publishedAt,
          rejectionReason: null,
          seoTitle: normalizedReport.seoTitle,
          seoDescription: normalizedReport.seoDescription,
          contentHash,
          updatedAt: now,
        })
        .where(eq(researchReports.id, reportId)),
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/reports",
        externalId: input.report.externalId,
        contentType: "research_report",
        result: importResult,
        httpStatus,
        resourceType: "research_report",
        resourceId: reportId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.report_updated",
        resourceType: "research_report",
        resourceId: reportId,
        metadata: {
          externalId: input.report.externalId,
          previousContentHash: existing!.contentHash,
          contentHash,
          status: targetStatus,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  } else {
    await db.batch([
      db.insert(importRequests).values({
        id: input.requestId,
        apiClientId: input.apiClientId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        endpoint: "/api/v1/import/reports",
        externalId: input.report.externalId,
        contentType: "research_report",
        result: importResult,
        httpStatus,
        resourceType: "research_report",
        resourceId: reportId,
        durationMs,
        createdAt: now,
      }),
      db.insert(importResponseSnapshots).values({
        importRequestId: input.requestId,
        responseData,
      }),
      db.insert(auditLogs).values({
        id: generateId(),
        actorType: "api",
        actorId: input.apiClientId,
        action: "api.report_unchanged",
        resourceType: "research_report",
        resourceId: reportId,
        metadata: {
          externalId: input.report.externalId,
          contentHash,
          requestId: input.requestId,
        },
        createdAt: now,
      }),
    ]);
  }

  return { httpStatus, body: responseData };
}

export async function getImportedReportSummary(
  db: AppDatabase,
  apiClientId: string,
  externalId: string,
): Promise<Record<string, unknown> | null> {
  const [report] = await db
    .select({
      id: researchReports.id,
      externalId: researchReports.externalId,
      slug: researchReports.slug,
      status: researchReports.status,
      contentHash: researchReports.contentHash,
      publishedAt: researchReports.publishedAt,
      updatedAt: researchReports.updatedAt,
    })
    .from(researchReports)
    .where(
      and(
        eq(researchReports.importedByApiClientId, apiClientId),
        eq(researchReports.externalId, externalId),
      ),
    )
    .limit(1);

  return report
    ? {
        report_id: report.id,
        external_id: report.externalId,
        slug: report.slug,
        status: report.status,
        content_hash: report.contentHash,
        published_at: report.publishedAt?.toISOString() ?? null,
        updated_at: report.updatedAt.toISOString(),
        url: `/reports/${report.slug}`,
      }
    : null;
}
