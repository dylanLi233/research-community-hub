import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCourses } from "@/courses/public-service";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "宏观课程",
  description: "通过结构化课程和章节建立宏观经济、政策与资产价格分析框架。",
};

const PAGE_SIZE = 12;

type CoursesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePage(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const page = Number(normalized ?? "1");
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "时长待补充";
  }

  if (minutes < 60) {
    return `约 ${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `约 ${hours} 小时 ${remainder} 分钟` : `约 ${hours} 小时`;
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const db = await getDb();
  const result = await listPublicCourses(db, { page, pageSize: PAGE_SIZE });
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <main className="courses-main">
      <section className="courses-hero">
        <span className="course-eyebrow">Learning Library</span>
        <h1>宏观课程</h1>
        <p>
          从增长、通胀、货币政策到资产价格，用结构化章节建立可以长期复用的分析框架。课程介绍与目录公开，会员章节提供试读。
        </p>
      </section>

      <section className="course-grid" aria-label="已发布课程">
        {result.items.length === 0 ? (
          <div className="course-empty">
            <h2>暂时没有已发布课程</h2>
            <p>课程和章节通过审核后会出现在这里。</p>
          </div>
        ) : (
          result.items.map((course) => (
            <article className="course-card" key={course.id}>
              <Link className="course-cover" href={`/courses/${course.slug}`}>
                {course.coverUrl ? (
                  <img src={course.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span className="course-cover-placeholder" aria-hidden="true">
                    COURSE
                  </span>
                )}
              </Link>

              <div className="course-card-body">
                <div className="course-card-meta">
                  <span
                    className={`course-access course-access-${course.accessLevel}`}
                  >
                    {course.accessLevel === "public" ? "公开课程" : "会员课程"}
                  </span>
                  <span>{course.chapterCount} 个章节</span>
                  <span>{formatDuration(course.totalEstimatedMinutes)}</span>
                </div>

                <h2>
                  <Link href={`/courses/${course.slug}`}>{course.title}</Link>
                </h2>
                {course.subtitle ? (
                  <p className="course-card-subtitle">{course.subtitle}</p>
                ) : null}
                <p className="course-card-summary">{course.summary}</p>

                {course.tags.length > 0 ? (
                  <div className="course-tags" aria-label="课程标签">
                    {course.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}

                <div className="course-card-footer">
                  <span>{course.instructorName ?? "研究编辑部"}</span>
                  <Link href={`/courses/${course.slug}`}>
                    查看课程 <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {pageCount > 1 ? (
        <nav className="course-pagination" aria-label="课程分页">
          {page > 1 ? <Link href={`/courses?page=${page - 1}`}>上一页</Link> : <span />}
          <span>
            第 {Math.min(page, pageCount)} / {pageCount} 页
          </span>
          {page < pageCount ? (
            <Link href={`/courses?page=${page + 1}`}>下一页</Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
