"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import type { AdminUserView } from "@/admin/user-service";

type ApiResponse = {
  data?: { user?: AdminUserView; reset?: boolean; revoked?: boolean };
  error?: { message?: string };
};

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminUserEditForm({ user }: { user: AdminUserView }) {
  const router = useRouter();
  const [withMembership, setWithMembership] = useState(Boolean(user.membership));
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<"reset" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function parseResponse(response: Response): Promise<ApiResponse> {
    return (await response.json()) as ApiResponse;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt") ?? "");
    const expiresAt = String(formData.get("expiresAt") ?? "");
    const nextStatus = String(formData.get("status") ?? user.status);

    if (
      user.status === "active" &&
      nextStatus === "disabled" &&
      !window.confirm("停用账号会立即撤销该用户的全部登录状态，确认继续吗？")
    ) {
      setSubmitting(false);
      return;
    }

    const payload = {
      displayName: String(formData.get("displayName") ?? "").trim() || null,
      role: String(formData.get("role") ?? user.role),
      status: nextStatus,
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
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await parseResponse(response);

      if (!response.ok || !result.data?.user) {
        setError(result.error?.message ?? "保存失败，请稍后重试");
        return;
      }

      setMessage("用户信息已保存。");
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setAction("reset");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("resetPassword") ?? "");

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const result = await parseResponse(response);

      if (!response.ok || !result.data?.reset) {
        setError(result.error?.message ?? "重置密码失败，请稍后重试");
        return;
      }

      form.reset();
      setMessage("密码已重置，旧登录状态已撤销。用户下次登录必须修改密码。");
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setAction(null);
    }
  }

  async function handleRevokeSessions() {
    if (!window.confirm("确认撤销该用户的全部登录状态吗？")) return;

    setError(null);
    setMessage(null);
    setAction("revoke");

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/revoke-sessions`,
        { method: "POST" },
      );
      const result = await parseResponse(response);

      if (!response.ok || !result.data?.revoked) {
        setError(result.error?.message ?? "撤销会话失败，请稍后重试");
        return;
      }

      setMessage("该用户的全部登录状态已撤销。");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="admin-form-stack">
      <form className="admin-form" onSubmit={handleSave}>
        <div className="admin-form-grid">
          <label>
            <span>用户名</span>
            <input value={user.username} disabled readOnly />
          </label>
          <label>
            <span>显示名称</span>
            <input name="displayName" defaultValue={user.displayName ?? ""} maxLength={80} />
          </label>
          <label>
            <span>角色</span>
            <select name="role" defaultValue={user.role}>
              <option value="member">会员</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label>
            <span>账号状态</span>
            <select name="status" defaultValue={user.status}>
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
            <span>设置会员期限</span>
          </label>

          {withMembership ? (
            <div className="admin-form-grid">
              <label>
                <span>会员状态</span>
                <select
                  name="membershipStatus"
                  defaultValue={user.membership?.status ?? "active"}
                >
                  <option value="active">有效</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                <span>开始时间</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={
                    toLocalInput(user.membership?.startsAt ?? null) ||
                    toLocalInput(new Date().toISOString())
                  }
                  required
                />
              </label>
              <label>
                <span>到期时间</span>
                <input
                  name="expiresAt"
                  type="datetime-local"
                  defaultValue={toLocalInput(user.membership?.expiresAt ?? null)}
                />
                <small>留空表示长期有效。</small>
              </label>
              <label className="admin-form-wide">
                <span>备注</span>
                <textarea
                  name="note"
                  defaultValue={user.membership?.note ?? ""}
                  maxLength={500}
                  rows={3}
                />
              </label>
            </div>
          ) : null}
        </section>

        <div className="admin-form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "正在保存…" : "保存修改"}
          </button>
        </div>
      </form>

      <section className="admin-danger-zone">
        <div>
          <h2>账号安全操作</h2>
          <p>重置密码和撤销会话不会删除用户或会员记录。</p>
        </div>
        <form className="admin-inline-form" onSubmit={handleResetPassword}>
          <label>
            <span>新临时密码</span>
            <input
              name="resetPassword"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" disabled={action !== null}>
            {action === "reset" ? "正在重置…" : "重置密码"}
          </button>
        </form>
        <button
          className="admin-secondary-button"
          type="button"
          onClick={handleRevokeSessions}
          disabled={action !== null}
        >
          {action === "revoke" ? "正在撤销…" : "撤销全部登录状态"}
        </button>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
