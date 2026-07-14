import type { Metadata } from "next";
import Link from "next/link";

import { getServerSession } from "@/auth/authorization";
import { getDb } from "@/db/client";
import { resolveReportAudience } from "@/reports/audience";
import { formatEventTime } from "@/events/public-policy";
import { listPublicEventsForWeek } from "@/events/public-service";
import { resolveEventWeek } from "@/events/week";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "重要会议与事件时间表",
  description: "按周查看宏观、政策、央行、经济数据、产业与公司重要事件。",
};

const CATEGORY_LABELS = {
  macro: "宏观",
  policy: "政策",
  central_bank: "央行",
  economic_data: "经济数据",
  industry: "产业",
  company: "公司",
  earnings: "财报",
  market: "市场",
  geopolitics: "地缘",
  other: "其他",
} as const;

const IMPORTANCE_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

function stringParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(value: string): { date: string; weekday: string } {
  const date = new Date(`${value}T00:00:00.000Z`);
  return {
    date: new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(date),
    weekday: new Intl.DateTimeFormat("zh-CN", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date),
  };
}

function weekLabel(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(startDate)}—${formatter.format(endDate)}`;
}

function MembershipCell({
  mustChangePassword,
  authenticated,
}: {
  mustChangePassword: boolean;
  authenticated: boolean;
}) {
  return (
    <div className="event-member-lock">
      <span>会员可见</span>
      {mustChangePassword ? (
        <Link href="/account/password">先修改密码</Link>
      ) : authenticated ? (
        <span>请确认会员状态</span>
      ) : (
        <Link href="/login?returnTo=/events">登录查看</Link>
      )}
    </div>
  );
}

type EventsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams;
  const week = resolveEventWeek(stringParam(params.week));
  const db = await getDb();
  const session = await getServerSession();
  const audience = await resolveReportAudience(db, session);
  const events = await listPublicEventsForWeek(db, {
    weekStart: week.start,
    weekEnd: week.end,
    audience: audience.audience,
  });

  return (
    <main className="events-main">
      <section className="events-hero">
        <span className="eyebrow">Market Calendar</span>
        <h1>重要会议与事件时间表</h1>
        <p>
          聚合本周值得关注的宏观、政策、央行、经济数据、产业和公司事件，并给出可能影响与重点观察。
        </p>
      </section>

      <section className="events-toolbar" aria-label="周切换">
        <Link href={`/events?week=${week.previous}`}>← 上一周</Link>
        <div>
          <strong>{weekLabel(week.start, week.end)}</strong>
          <Link href="/events">回到本周</Link>
        </div>
        <Link href={`/events?week=${week.next}`}>下一周 →</Link>
      </section>

      {events.length === 0 ? (
        <section className="events-empty">
          <h2>这一周暂时没有已发布事件</h2>
          <p>可以切换前后周查看，或等待事件通过审核后发布。</p>
        </section>
      ) : (
        <>
          <div className="events-table-wrap">
            <table className="events-table">
              <thead>
                <tr>
                  <th>日期时间</th>
                  <th>事件</th>
                  <th>分类</th>
                  <th>重要性</th>
                  <th>影响判断</th>
                  <th>重点观察</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const day = formatDate(event.eventDate);
                  return (
                    <tr id={`event-${event.id}`} key={event.id}>
                      <td className="event-date-cell">
                        <strong>{day.date}</strong>
                        <span>{day.weekday}</span>
                        <span>
                          {formatEventTime({
                            allDay: event.allDay,
                            startsAt: event.startsAt,
                            endsAt: event.endsAt,
                            timezone: event.timezone,
                          })}
                        </span>
                        <small>{event.timezone}</small>
                      </td>
                      <td className="event-title-cell">
                        <div className="event-title-line">
                          <strong>{event.title}</strong>
                          {event.accessLevel === "member" ? (
                            <span className="event-access-badge">会员</span>
                          ) : null}
                        </div>
                        <p>{event.summary}</p>
                        <div className="event-source-line">
                          {event.region ? <span>{event.region}</span> : null}
                          {event.sourceName ? (
                            event.sourceUrl ? (
                              <a
                                href={event.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {event.sourceName}
                              </a>
                            ) : (
                              <span>{event.sourceName}</span>
                            )
                          ) : null}
                        </div>
                        {event.tags.length > 0 ? (
                          <div className="event-tags">
                            {event.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className="event-category-badge">
                          {CATEGORY_LABELS[event.category]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`event-importance event-importance-${event.importance}`}
                        >
                          {IMPORTANCE_LABELS[event.importance]}
                        </span>
                      </td>
                      <td className="event-detail-cell">
                        {event.restricted ? (
                          <MembershipCell
                            mustChangePassword={audience.mustChangePassword}
                            authenticated={audience.isAuthenticated}
                          />
                        ) : (
                          event.impact || "暂无补充判断"
                        )}
                      </td>
                      <td className="event-detail-cell">
                        {event.restricted ? (
                          <MembershipCell
                            mustChangePassword={audience.mustChangePassword}
                            authenticated={audience.isAuthenticated}
                          />
                        ) : event.focusPoints.length > 0 ? (
                          <ul>
                            {event.focusPoints.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : (
                          "暂无重点观察"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="event-card-list" aria-label="移动端事件列表">
            {events.map((event) => {
              const day = formatDate(event.eventDate);
              return (
                <article className="event-card" key={event.id}>
                  <header>
                    <div>
                      <span>{day.date}</span>
                      <span>{day.weekday}</span>
                      <strong>
                        {formatEventTime({
                          allDay: event.allDay,
                          startsAt: event.startsAt,
                          endsAt: event.endsAt,
                          timezone: event.timezone,
                        })}
                      </strong>
                    </div>
                    <span
                      className={`event-importance event-importance-${event.importance}`}
                    >
                      {IMPORTANCE_LABELS[event.importance]}
                    </span>
                  </header>

                  <div className="event-card-labels">
                    <span className="event-category-badge">
                      {CATEGORY_LABELS[event.category]}
                    </span>
                    {event.accessLevel === "member" ? (
                      <span className="event-access-badge">会员</span>
                    ) : null}
                  </div>

                  <h2>{event.title}</h2>
                  <p>{event.summary}</p>

                  <section>
                    <h3>影响判断</h3>
                    {event.restricted ? (
                      <MembershipCell
                        mustChangePassword={audience.mustChangePassword}
                        authenticated={audience.isAuthenticated}
                      />
                    ) : (
                      <p>{event.impact || "暂无补充判断"}</p>
                    )}
                  </section>

                  <section>
                    <h3>重点观察</h3>
                    {event.restricted ? (
                      <MembershipCell
                        mustChangePassword={audience.mustChangePassword}
                        authenticated={audience.isAuthenticated}
                      />
                    ) : event.focusPoints.length > 0 ? (
                      <ul>
                        {event.focusPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>暂无重点观察</p>
                    )}
                  </section>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
