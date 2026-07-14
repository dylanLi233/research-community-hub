"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type LoginResponse = {
  data?: {
    returnTo: string;
  };
  error?: {
    message?: string;
  };
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    const returnTo = searchParams.get("returnTo") ?? undefined;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, returnTo }),
      });
      const payload = (await response.json()) as LoginResponse;

      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "登录失败，请稍后重试");
        return;
      }

      window.location.assign(payload.data.returnTo);
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label>
        <span>用户名</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          minLength={3}
          maxLength={64}
          required
          disabled={submitting}
        />
      </label>

      <label>
        <span>密码</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
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
        {submitting ? "正在登录…" : "登录"}
      </button>
    </form>
  );
}
