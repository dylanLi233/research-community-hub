"use client";

import { type FormEvent, useEffect, useState } from "react";

type SessionResponse = {
  data?: {
    authenticated: boolean;
  };
};

type ChangePasswordResponse = {
  data?: {
    changed: boolean;
  };
  error?: {
    message?: string;
  };
};

export function ChangePasswordForm() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const payload = (await response.json()) as SessionResponse;

        if (active && (!response.ok || !payload.data?.authenticated)) {
          window.location.replace(
            `/login?returnTo=${encodeURIComponent("/account/password")}`,
          );
          return;
        }
      } catch {
        if (active) {
          setError("无法确认登录状态，请刷新后重试");
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as ChangePasswordResponse;

      if (!response.ok || !payload.data?.changed) {
        setError(payload.error?.message ?? "修改密码失败，请稍后重试");
        return;
      }

      form.reset();
      window.location.assign("/");
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return <p className="form-status">正在确认登录状态…</p>;
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label>
        <span>当前密码</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          disabled={submitting}
        />
      </label>

      <label>
        <span>新密码</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={submitting}
        />
      </label>

      <label>
        <span>确认新密码</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={submitting}
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting}>
        {submitting ? "正在保存…" : "保存新密码"}
      </button>
    </form>
  );
}
