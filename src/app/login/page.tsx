import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "会员登录",
  description: "使用管理员提供的用户名和密码登录投研内容平台。",
};

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-heading">
          <span className="eyebrow">Member Access</span>
          <h1 id="login-title">登录投研内容平台</h1>
          <p>账号由社群管理员创建。登录后可以查看对应权限的完整内容。</p>
        </div>
        <Suspense fallback={<p className="form-status">正在加载登录表单…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
