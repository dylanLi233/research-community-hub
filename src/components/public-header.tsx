import Link from "next/link";

import styles from "./public-header.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          Research Community Hub
        </Link>
        <nav className={styles.nav} aria-label="主导航">
          <Link href="/reports">研报</Link>
          <Link href="/login?returnTo=/reports">登录</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <p>Research Community Hub · 为社群成员沉淀可持续阅读的研究内容。</p>
    </footer>
  );
}
