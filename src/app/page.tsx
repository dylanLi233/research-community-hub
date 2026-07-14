import Link from "next/link";

import "./home.css";
import { PublicFooter, PublicHeader } from "@/components/public-header";

const modules = [
  {
    title: "研报精选",
    description: "阅读经过整理和审核的机构研报，访客可试读，会员可查看完整内容。",
    href: "/reports",
    status: "已开放",
  },
  {
    title: "重要事件",
    description: "按周查看宏观、政策、央行、产业与市场的重要时间节点和重点观察。",
    href: "/events",
    status: "已开放",
  },
  {
    title: "宏观课程",
    description: "通过结构化章节建立宏观经济和资产价格分析的基础框架。",
    href: null,
    status: "建设中",
  },
];

export default function Home() {
  return (
    <div className="public-home-shell">
      <PublicHeader />
      <main>
        <section className="hero">
          <span className="eyebrow">Research Community Hub</span>
          <h1>把分散的信息，沉淀成可持续阅读的研究内容。</h1>
          <p>
            网站负责接收、校验、审核和展示 Hermes 上传的内容，为社群成员提供稳定的研报、事件和课程入口。
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/reports">
              浏览研报精选
            </Link>
            <Link className="secondary-link" href="/events">
              查看本周重要事件
            </Link>
          </div>
          <div className="status" aria-label="项目状态">
            <span className="status-dot" aria-hidden="true" />
            研报阅读与重要事件时间表已开放
          </div>
        </section>

        <section className="modules" aria-label="核心内容模块">
          {modules.map((module) => (
            <article key={module.title}>
              <span className="module-status">{module.status}</span>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
              {module.href ? (
                <Link className="module-link" href={module.href}>
                  进入模块 <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
