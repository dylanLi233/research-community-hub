import "./courses.css";

import { PublicFooter, PublicHeader } from "@/components/public-header";

export default function CoursesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="course-site-shell">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
