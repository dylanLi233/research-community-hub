import Link from "next/link";

import { listAdminUsers } from "@/admin/user-service";
import { userListQuerySchema } from "@/admin/user-validation";
import { getDb } from "@/db/client";

const membershipLabels = {
  none: "未设置",
  account_disabled: "账号停用",
  inactive: "会员停用",
  upcoming: "未开始",
  active: "有效",
  expired: "已到期",
} as const;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = userListQuerySchema.safeParse({
    page: scalar(raw.page),
    pageSize: scalar(raw.pageSize),
    query: scalar(raw.query),
    role: scalar(raw.role) || undefined,
    status: scalar(raw.status) || undefined,
  });
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 20, query: undefined, role: undefined, status: undefined };
  const db = await getDb();
  const result = await listAdminUsers(db, query);
  const pageCount = Math.max(1, Math.ceil(result.total / query.pageSize));

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (query.query) params.set("query", query.query);
    if (query.role) params.set("role", query.role);
    if (query.status) params.set("status", query.status);
    params.set("page", String(page));
    return `/admin/users?${params.toString()}`;
  }

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>用户与会员</h1>
          <p>手工创建社群成员账号，设置会员期限、账号状态和角色。</p>
        </div>
        <Link className="admin-primary-link" href="/admin/users/new">
          创建用户
        </Link>
      </div>

      <form className="admin-filters" method="get">
        <label>
          <span>搜索</span>
          <input
            name="query"
            defaultValue={query.query}
            placeholder="用户名或显示名称"
          />
        </label>
        <label>
          <span>角色</span>
          <select name="role" defaultValue={query.role ?? ""}>
            <option value="">全部</option>
            <option value="member">会员</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <label>
          <span>账号状态</span>
          <select name="status" defaultValue={query.status ?? ""}>
            <option value="">全部</option>
            <option value="active">正常</option>
            <option value="disabled">停用</option>
          </select>
        </label>
        <button type="submit">筛选</button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>账号</th>
              <th>会员状态</th>
              <th>到期时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName || user.username}</strong>
                  <small>{user.username}</small>
                </td>
                <td>{user.role === "admin" ? "管理员" : "会员"}</td>
                <td>{user.status === "active" ? "正常" : "停用"}</td>
                <td>
                  {membershipLabels[user.membership?.state ?? "none"]}
                </td>
                <td>
                  {user.membership?.expiresAt
                    ? new Date(user.membership.expiresAt).toLocaleDateString("zh-CN")
                    : user.membership
                      ? "长期"
                      : "—"}
                </td>
                <td>
                  <Link href={`/admin/users/${user.id}`}>管理</Link>
                </td>
              </tr>
            ))}
            {result.items.length === 0 ? (
              <tr>
                <td className="admin-empty" colSpan={6}>
                  没有符合条件的用户。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination">
        <span>
          共 {result.total} 个用户 · 第 {query.page}/{pageCount} 页
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
