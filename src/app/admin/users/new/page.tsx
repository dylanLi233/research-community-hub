import type { Metadata } from "next";

import { AdminUserCreateForm } from "@/components/admin/user-create-form";

export const metadata: Metadata = {
  title: "创建用户",
};

export default function AdminNewUserPage() {
  return (
    <main className="admin-page admin-form-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">New Member</span>
          <h1>创建用户</h1>
          <p>设置用户名、初始密码和会员有效期。用户首次登录后必须修改密码。</p>
        </div>
      </div>
      <AdminUserCreateForm />
    </main>
  );
}
