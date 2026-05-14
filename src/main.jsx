import React from "react";
import { createRoot } from "react-dom/client";
import reports from "./reports.generated.json";
import "./styles.css";

const page = document.getElementById("root")?.dataset.page || "home";
const latest = reports[0] || null;

function linkTo(prefix, target) {
  return `${prefix}/${target}`.replace(/\/{2,}/g, "/").replace(/^\.\//, "./");
}

function HomePage() {
  return (
    <main className="page page--centered">
      <section className="home-shell">
        <h1>Whistle 互联网日报</h1>
        <p className="intro">
          面向互联网工作群体的低噪音日报，优先保留会影响产品、研发、增长、商业化、基础设施与合规判断的信号。
        </p>
        <nav className="nav" aria-label="站点导航">
          <a className="pill brand" href={latest ? linkTo(".", latest.reportPath) : "./archive/"}>
            最新日报
          </a>
          <a className="pill" href="./archive/">
            归档
          </a>
          <a className="pill" href="./subscribe/">
            订阅
          </a>
        </nav>
      </section>
    </main>
  );
}

function ArchivePage() {
  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Archive</p>
        <h1>日报归档</h1>
        <p className="intro">按日期保存的 Whistle 互联网日报。每期都提供 HTML 阅读页与 PDF 版本。</p>
        <nav className="nav" aria-label="站点导航">
          <a className="pill" href="../">
            首页
          </a>
          <a className="pill brand" href="../subscribe/">
            订阅
          </a>
        </nav>
      </header>

      <section className="section">
        <h2 className="section-title">全部日报</h2>
        <div className="grid">
          {reports.map((report) => (
            <article className="card" key={report.date}>
              <h3>
                <a href={linkTo("..", report.reportPath)}>{report.title}</a>
              </h3>
              <p>{report.summary}</p>
              <span className="meta">
                {report.date} · <a href={linkTo("..", report.pdfPath)}>PDF</a>
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function SubscribePage() {
  return (
    <main className="page page--centered">
      <section className="subscribe-shell">
        <h1>订阅 Whistle</h1>
        <p className="intro">
          每日生成一份低噪音互联网工作日报，覆盖 AI 与新工具、平台动态、产品增长、工程实践、机会与合规信号。
        </p>
        <form className="subscribe-form">
          <label className="sr-only" htmlFor="email">
            邮箱
          </label>
          <input id="email" name="email" type="email" placeholder="输入邮箱地址" className="input" />
          <button type="submit" className="pill pill--solid">
            订阅
          </button>
        </form>
      </section>
    </main>
  );
}

const pages = {
  archive: <ArchivePage />,
  home: <HomePage />,
  subscribe: <SubscribePage />,
};

createRoot(document.getElementById("root")).render(pages[page] || pages.home);
