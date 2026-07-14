import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getAdminUserById } from "@/admin/user-service";
import { AdminUserEditForm } from "@/components/admin/user-edit-form";
import { getDb } from "@/db/client";

export const metadata: Metadata = {
  title: "管理用户",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = await getDb();
  const user = await getAdminUserById(db, id);

  if (!user) {
    notFound();
  }

  return (
    <main className="admin-page admin-form-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Member Detail</span>
          <h1>{user.displayName || user.username}</h1>
          <p>
            用户名：{user.username} · 创建于
            {new Date(user.createdAt).toLocaleDateString("zh-CN")}
          </p>
        </div>
      </div>
      <AdminUserEditForm user={user} />
    </main>
  );
}
