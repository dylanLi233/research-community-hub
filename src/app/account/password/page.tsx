import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = {
  title: "修改密码",
  description: "修改投研内容平台登录密码。",
};

export default function ChangePasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="password-title">
        <div className="auth-heading">
          <span className="eyebrow">Account Security</span>
          <h1 id="password-title">设置你的登录密码</h1>
          <p>新密码至少 12 个字符。修改成功后，其他登录状态会立即失效。</p>
        </div>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
