"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type CreateUserResponse = {
  data?: { user: { id: string } };
  error?: { message?: string };
};

function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminUserCreateForm() {
  const router = useRouter();
  const [withMembership, setWithMembership] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultStart = localInputValue(new Date());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt") ?? "");
    const expiresAt = String(formData.get("expiresAt") ?? "");
    const payload = {
      username: String(formData.get("username") ?? ""),
      displayName: String(formData.get("displayName") ?? "").trim() || null,
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "member"),
      status: String(formData.get("status") ?? "active"),
      membership: withMembership
        ? {
            status: String(formData.get("membershipStatus") ?? "active"),
            startsAt: new Date(startsAt).toISOString(),
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            note: String(formData.get("note") ?? "").trim() || null,
          }
        : null,
    };

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateUserResponse;

      if (!response.ok || !result.data?.user.id) {
        setError(result.error?.message ?? "创建用户失败，请稍后重试");
        return;
      }

      router.push(`/admin/users/${result.data.user.id}`);
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form-grid">
        <label>
          <span>用户名</span>
          <input name="username" minLength={3} maxLength={64} required />
        </label>
        <label>
          <span>显示名称</span>
          <input name="displayName" maxLength={80} />
        </label>
        <label>
          <span>初始密码</span>
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          <span>角色</span>
          <select name="role" defaultValue="member">
            <option value="member">会员</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <label>
          <span>账号状态</span>
          <select name="status" defaultValue="active">
            <option value="active">正常</option>
            <option value="disabled">停用</option>
          </select>
        </label>
      </div>

      <section className="admin-form-section">
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={withMembership}
            onChange={(event) => setWithMembership(event.target.checked)}
          />
          <span>同时设置会员期限</span>
        </label>

        {withMembership ? (
          <div className="admin-form-grid">
            <label>
              <span>会员状态</span>
              <select name="membershipStatus" defaultValue="active">
                <option value="active">有效</option>
                <option value="inactive">停用</option>
              </select>
            </label>
            <label>
              <span>开始时间</span>
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={defaultStart}
                required
              />
            </label>
            <label>
              <span>到期时间</span>
              <input name="expiresAt" type="datetime-local" />
              <small>留空表示长期有效。</small>
            </label>
            <label className="admin-form-wide">
              <span>备注</span>
              <textarea name="note" maxLength={500} rows={3} />
            </label>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="admin-form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "正在创建…" : "创建用户"}
        </button>
      </div>
    </form>
  );
}
