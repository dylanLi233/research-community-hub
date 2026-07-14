const modules = [
  {
    title: "研报精选",
    description: "阅读经过整理的海外机构研报，访客可试读，会员可查看完整内容。",
  },
  {
    title: "重要事件",
    description: "按周和月查看宏观、政策、产业与市场的重要时间节点。",
  },
  {
    title: "宏观课程",
    description: "通过 18 个章节建立宏观经济和资产价格分析的基础框架。",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <span className="eyebrow">Research Community Hub</span>
        <h1>把分散的信息，沉淀成可持续阅读的研究内容。</h1>
        <p>
          网站负责接收、校验、审核和展示 Hermes 上传的内容，为社群成员提供稳定的研报、事件和课程入口。
        </p>
        <div className="status" aria-label="项目状态">
          <span className="status-dot" aria-hidden="true" />
          TASK-001 · Cloudflare 全栈项目初始化
        </div>
      </section>

      <section className="modules" aria-label="核心内容模块">
        {modules.map((module) => (
          <article key={module.title}>
            <h2>{module.title}</h2>
            <p>{module.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
