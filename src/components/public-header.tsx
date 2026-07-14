import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/">
          Research Community Hub
        </Link>
        <nav className="site-nav" aria-label="主导航">
          <Link href="/reports">研报</Link>
          <Link href="/login?returnTo=/reports">登录</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <p>Research Community Hub · 为社群成员沉淀可持续阅读的研究内容。</p>
    </footer>
  );
}
