import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerSession } from "@/auth/authorization";
import { resolveCourseAudience } from "@/courses/public-audience";
import { getPublicCourseBySlug } from "@/courses/public-service";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "时长待补充";
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `约 ${hours} 小时 ${remainder} 分钟` : `约 ${hours} 小时`;
}

function chapterAccessLabel(chapter: {
  accessLevel: "public" | "member";
  previewMode: "none" | "paywall_marker" | "summary_only";
}): string {
  if (chapter.accessLevel === "public") return "公开章节";
  return chapter.previewMode === "paywall_marker" ? "会员 · 可试读" : "会员章节";
}

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();
  const course = await getPublicCourseBySlug(db, slug);

  if (!course) return { title: "课程不存在" };

  return {
    title: course.seoTitle || course.title,
    description: course.seoDescription || course.summary,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      type: "website",
      title: course.seoTitle || course.title,
      description: course.seoDescription || course.summary,
      images: course.coverUrl ? [{ url: course.coverUrl }] : undefined,
    },
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const db = await getDb();
  const [course, session] = await Promise.all([
    getPublicCourseBySlug(db, slug),
    getServerSession(),
  ]);

  if (!course) notFound();

  const audience = await resolveCourseAudience(db, session);
  const firstChapter = course.chapters[0] ?? null;

  return (
    <main className="course-detail-main">
      <nav className="course-breadcrumb" aria-label="面包屑">
        <Link href="/courses">宏观课程</Link>
        <span aria-hidden="true">/</span>
        <span>{course.title}</span>
      </nav>

      <section className="course-detail-hero">
        <div className="course-detail-copy">
          <div className="course-detail-badges">
            <span className={`course-access course-access-${course.accessLevel}`}>
              {course.accessLevel === "public" ? "公开课程" : "会员课程"}
            </span>
            <span>{course.chapterCount} 个已发布章节</span>
            <span>{formatDuration(course.totalEstimatedMinutes)}</span>
          </div>

          <h1>{course.title}</h1>
          {course.subtitle ? <p className="course-detail-subtitle">{course.subtitle}</p> : null}
          <p className="course-detail-summary">{course.summary}</p>

          <div className="course-detail-actions">
            {firstChapter ? (
              <Link
                className="course-primary-action"
                href={`/courses/${course.slug}/${firstChapter.slug}`}
              >
                开始学习
              </Link>
            ) : null}
            {course.accessLevel === "member" && audience.audience === "visitor" ? (
              <Link
                className="course-secondary-action"
                href={`/login?returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`}
              >
                登录会员账户
              </Link>
            ) : null}
          </div>

          <div className="course-instructor">
            <span>课程整理</span>
            <strong>{course.instructorName ?? "研究编辑部"}</strong>
          </div>

          {course.tags.length > 0 ? (
            <div className="course-tags" aria-label="课程标签">
              {course.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="course-detail-cover">
          {course.coverUrl ? (
            <img src={course.coverUrl} alt="" />
          ) : (
            <div className="course-detail-cover-placeholder" aria-hidden="true">
              <span>RCH</span>
              <strong>COURSE</strong>
            </div>
          )}
        </div>
      </section>

      <div className="course-detail-columns">
        <section className="course-description" aria-labelledby="course-introduction">
          <span className="course-section-kicker">Course Overview</span>
          <h2 id="course-introduction">课程介绍</h2>
          <div
            className="course-prose"
            dangerouslySetInnerHTML={{ __html: course.descriptionHtml }}
          />
        </section>

        <aside className="course-membership-note">
          <span>阅读权限</span>
          <h2>
            {audience.audience === "member" || audience.audience === "admin"
              ? "会员章节已解锁"
              : "目录公开，会员章节可试读"}
          </h2>
          <p>
            公开章节可以阅读全文。会员章节根据设置提供公开试读或摘要，有效会员可查看完整内容。
          </p>
          {audience.mustChangePassword ? (
            <Link href="/account/password">先修改初始密码</Link>
          ) : audience.audience === "visitor" ? (
            <Link href={`/login?returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`}>
              登录会员账户
            </Link>
          ) : null}
        </aside>
      </div>

      <section className="course-chapter-section" aria-labelledby="course-chapters">
        <div className="course-section-heading">
          <div>
            <span className="course-section-kicker">Curriculum</span>
            <h2 id="course-chapters">章节目录</h2>
          </div>
          <p>仅显示已经发布的章节，顺序由课程编辑设置。</p>
        </div>

        {course.chapters.length === 0 ? (
          <div className="course-empty course-chapter-empty">
            <h3>章节正在整理</h3>
            <p>课程已发布，章节通过审核后会出现在这里。</p>
          </div>
        ) : (
          <ol className="course-chapter-list">
            {course.chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <Link href={`/courses/${course.slug}/${chapter.slug}`}>
                  <span className="chapter-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="chapter-copy">
                    <strong>{chapter.title}</strong>
                    <span>{chapter.summary}</span>
                  </span>
                  <span className="chapter-meta">
                    <span
                      className={`chapter-access chapter-access-${chapter.accessLevel}`}
                    >
                      {chapterAccessLabel(chapter)}
                    </span>
                    {chapter.estimatedMinutes ? (
                      <span>{chapter.estimatedMinutes} 分钟</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
