import Link from "next/link";
import { redirect } from "next/navigation";

import "./admin.css";
import { getServerSession } from "@/auth/authorization";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login?returnTo=/admin/users");
  }

  if (session.user.mustChangePassword) {
    redirect("/account/password");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="admin-brand" href="/admin/users">
          Research Community Hub
        </Link>
        <nav aria-label="后台导航">
          <Link href="/admin/users">用户与会员</Link>
          <Link href="/">返回网站</Link>
        </nav>
      </header>
      <div className="admin-content">{children}</div>
    </div>
  );
}
