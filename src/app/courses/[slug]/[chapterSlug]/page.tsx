import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerSession } from "@/auth/authorization";
import { resolveCourseAudience } from "@/courses/public-audience";
import { projectChapterForAudience } from "@/courses/public-policy";
import { getPublicCourseChapterBySlugs } from "@/courses/public-service";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CourseChapterPageProps = {
  params: Promise<{ slug: string; chapterSlug: string }>;
};

function RestrictedChapterNotice({
  courseSlug,
  chapterSlug,
  isAuthenticated,
  mustChangePassword,
  membershipState,
}: {
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  membershipState: string;
}) {
  const returnTo = `/courses/${courseSlug}/${chapterSlug}`;

  if (mustChangePassword) {
    return (
      <aside className="course-paywall" aria-label="需要修改密码">
        <span>账户安全</span>
        <h2>修改初始密码后继续学习</h2>
        <p>为了保护会员课程，请先完成首次密码修改。</p>
        <Link href="/account/password">修改密码</Link>
      </aside>
    );
  }

  if (!isAuthenticated) {
    return (
      <aside className="course-paywall" aria-label="会员章节">
        <span>Member Course</span>
        <h2>登录后查看完整章节</h2>
        <p>访客可以阅读摘要或公开试读，有效会员可以查看完整课程正文。</p>
        <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
          登录会员账户
        </Link>
      </aside>
    );
  }

  const message =
    membershipState === "expired"
      ? "当前会员已到期，请联系管理员续期后继续学习。"
      : membershipState === "upcoming"
        ? "会员权益尚未开始，生效后即可查看完整章节。"
        : membershipState === "inactive"
          ? "当前会员权益未启用，请联系管理员确认。"
          : "当前账户尚未开通会员权限，请联系管理员。";

  return (
    <aside className="course-paywall" aria-label="会员权限不足">
      <span>Member Course</span>
      <h2>完整章节仅对有效会员开放</h2>
      <p>{message}</p>
      <Link href={`/courses/${courseSlug}`}>返回课程目录</Link>
    </aside>
  );
}

export async function generateMetadata({
  params,
}: CourseChapterPageProps): Promise<Metadata> {
  const { slug, chapterSlug } = await params;
  const db = await getDb();
  const data = await getPublicCourseChapterBySlugs(db, slug, chapterSlug);

  if (!data) return { title: "章节不存在" };

  return {
    title: `${data.chapter.title} | ${data.course.title}`,
    description: data.chapter.summary,
    alternates: {
      canonical: `/courses/${data.course.slug}/${data.chapter.slug}`,
    },
    openGraph: {
      type: "article",
      title: data.chapter.title,
      description: data.chapter.summary,
      publishedTime: data.chapter.publishedAt,
      images: data.course.coverUrl ? [{ url: data.course.coverUrl }] : undefined,
    },
  };
}

export default async function CourseChapterPage({
  params,
}: CourseChapterPageProps) {
  const { slug, chapterSlug } = await params;
  const db = await getDb();
  const [data, session] = await Promise.all([
    getPublicCourseChapterBySlugs(db, slug, chapterSlug),
    getServerSession(),
  ]);

  if (!data) notFound();

  const audience = await resolveCourseAudience(db, session);
  const chapter = projectChapterForAudience(data.chapter, audience.audience);
  const chapterNumber =
    data.course.chapters.findIndex((item) => item.id === chapter.id) + 1;

  return (
    <main className="chapter-reading-main">
      <nav className="course-breadcrumb" aria-label="面包屑">
        <Link href="/courses">宏观课程</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/courses/${data.course.slug}`}>{data.course.title}</Link>
        <span aria-hidden="true">/</span>
        <span>第 {chapterNumber} 章</span>
      </nav>

      <div className="chapter-reading-layout">
        <article className="chapter-article">
          <header className="chapter-header">
            <div className="chapter-header-meta">
              <span>第 {String(chapterNumber).padStart(2, "0")} 章</span>
              <span
                className={`chapter-access chapter-access-${chapter.accessLevel}`}
              >
                {chapter.accessLevel === "public" ? "公开章节" : "会员章节"}
              </span>
              {chapter.estimatedMinutes ? (
                <span>预计 {chapter.estimatedMinutes} 分钟</span>
              ) : null}
            </div>
            <h1>{chapter.title}</h1>
            <p>{chapter.summary}</p>
          </header>

          {chapter.html ? (
            <div
              className="course-prose chapter-prose"
              dangerouslySetInnerHTML={{ __html: chapter.html }}
            />
          ) : null}

          {chapter.isRestricted ? (
            <RestrictedChapterNotice
              courseSlug={data.course.slug}
              chapterSlug={chapter.slug}
              isAuthenticated={audience.isAuthenticated}
              mustChangePassword={audience.mustChangePassword}
              membershipState={audience.membershipState}
            />
          ) : (
            <div className="chapter-complete">
              <span>本章全文已显示</span>
              <Link href={`/courses/${data.course.slug}`}>查看课程目录</Link>
            </div>
          )}

          <nav className="chapter-sequence" aria-label="章节导航">
            {data.previousChapter ? (
              <Link
                className="chapter-sequence-card"
                href={`/courses/${data.course.slug}/${data.previousChapter.slug}`}
              >
                <span>上一章</span>
                <strong>{data.previousChapter.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {data.nextChapter ? (
              <Link
                className="chapter-sequence-card chapter-sequence-next"
                href={`/courses/${data.course.slug}/${data.nextChapter.slug}`}
              >
                <span>下一章</span>
                <strong>{data.nextChapter.title}</strong>
              </Link>
            ) : (
              <Link
                className="chapter-sequence-card chapter-sequence-next"
                href={`/courses/${data.course.slug}`}
              >
                <span>课程完成</span>
                <strong>返回课程目录</strong>
              </Link>
            )}
          </nav>
        </article>

        <aside className="chapter-sidebar" aria-label="课程章节目录">
          <div className="chapter-sidebar-heading">
            <span>Course</span>
            <h2>{data.course.title}</h2>
            <Link href={`/courses/${data.course.slug}`}>课程介绍</Link>
          </div>
          <ol>
            {data.course.chapters.map((item, index) => (
              <li key={item.id} className={item.id === chapter.id ? "is-current" : undefined}>
                <Link href={`/courses/${data.course.slug}/${item.slug}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <small>{item.accessLevel === "public" ? "公开" : "会员"}</small>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
