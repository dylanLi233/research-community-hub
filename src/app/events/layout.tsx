import "./events.css";

import { PublicFooter, PublicHeader } from "@/components/public-header";

export default function EventsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="public-site-shell">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
