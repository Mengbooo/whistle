import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import reports from "./reports.generated.json";
import "./styles.css";

const page = document.getElementById("root")?.dataset.page || "home";
const latest = reports[0] || null;

const categories = ["全部"];
const sortOptions = [
  ["desc", "最新到最旧"],
  ["asc", "最旧到最新"],
];
const reportsPerPage = 9;
const paginationSiblingCount = 2;
const coverStyles = [
  "silk",
  "ferrofluid",
  "prism",
  "dark-veil",
  "light-pillar",
  "floating-lines",
  "color-bends",
  "aurora",
  "plasma",
  "iridescence",
];
const coverColor = "#01c193";

const coverVertexShader = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const coverFragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;
uniform float uStyle;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

float softNoise(vec2 uv) {
  return noise(uv) * 0.5 + noise(uv * 2.3 + 11.7) * 0.3 + noise(uv * 5.1 + 3.2) * 0.2;
}

float silk(vec2 tex, float t) {
  tex.y += 0.03 * sin(8.0 * tex.x - t);
  return 0.6 +
         0.4 * sin(5.0 * (tex.x + tex.y +
                          cos(3.0 * tex.x + 5.0 * tex.y) +
                          0.02 * t) +
                  sin(20.0 * (tex.x + tex.y - 0.1 * t)));
}

float ferrofluid(vec2 uv, float t) {
  vec2 center = uv - 0.5;
  float r = length(center);
  float angle = atan(center.y, center.x);
  return smoothstep(0.36, 0.12, r + 0.07 * sin(11.0 * angle + t) + 0.04 * sin(23.0 * angle - t * 0.8));
}

float prism(vec2 uv, float t) {
  vec2 p = abs(uv - 0.5);
  float beam = smoothstep(0.035, 0.0, abs(p.x - p.y * 0.62 + 0.06 * sin(t)));
  float split = smoothstep(0.24, 0.0, abs(uv.y - 0.5 - 0.15 * sin(uv.x * 5.0 + t)));
  return max(beam, split * 0.72);
}

float darkVeil(vec2 uv, float t) {
  float v = sin((uv.x + uv.y) * 10.0 + t) * 0.5 + 0.5;
  v *= sin((uv.x - uv.y) * 7.0 - t * 0.7) * 0.5 + 0.5;
  return smoothstep(0.12, 0.92, v);
}

float lightPillar(vec2 uv, float t) {
  float pillar = smoothstep(0.42, 0.0, abs(uv.x - 0.5 - 0.04 * sin(t)));
  float falloff = smoothstep(0.02, 0.82, uv.y) * smoothstep(1.0, 0.2, uv.y);
  return pillar * falloff;
}

float floatingLines(vec2 uv, float t) {
  float bands = 0.0;
  for (float i = 0.0; i < 5.0; i += 1.0) {
    float y = fract(uv.y * 1.15 + i * 0.17 + t * (0.018 + i * 0.003));
    bands += smoothstep(0.025, 0.0, abs(y - 0.5 + 0.08 * sin(uv.x * 5.0 + i)));
  }
  return clamp(bands, 0.0, 1.0);
}

float colorBends(vec2 uv, float t) {
  float bend = uv.y + 0.16 * sin(uv.x * 4.5 + t) + 0.09 * sin((uv.x + uv.y) * 8.0 - t * 0.4);
  return smoothstep(0.18, 0.92, bend);
}

float aurora(vec2 uv, float t) {
  float wave = abs(uv.y - 0.52 - 0.18 * sin(uv.x * 5.5 + t) - 0.08 * sin(uv.x * 13.0 - t * 0.7));
  return smoothstep(0.34, 0.0, wave) * smoothstep(0.0, 0.55, uv.y);
}

float plasma(vec2 uv, float t) {
  float p = sin(uv.x * 9.0 + t) + sin(uv.y * 11.0 - t * 0.8) + sin((uv.x + uv.y) * 13.0 + t * 0.5);
  return 0.5 + 0.5 * sin(p);
}

float iridescence(vec2 uv, float t) {
  vec2 p = uv - 0.5;
  float rings = sin(length(p) * 28.0 - t * 0.8);
  float sweep = sin((uv.x - uv.y) * 12.0 + t * 0.45);
  return 0.5 + 0.25 * rings + 0.25 * sweep;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;
  float pattern    = silk(tex, tOffset);

  if (uStyle < 0.5) {
    pattern = silk(tex, tOffset);
  } else if (uStyle < 1.5) {
    pattern = ferrofluid(uv, tOffset);
  } else if (uStyle < 2.5) {
    pattern = prism(uv, tOffset);
  } else if (uStyle < 3.5) {
    pattern = darkVeil(uv, tOffset);
  } else if (uStyle < 4.5) {
    pattern = lightPillar(uv, tOffset);
  } else if (uStyle < 5.5) {
    pattern = floatingLines(uv, tOffset);
  } else if (uStyle < 6.5) {
    pattern = colorBends(uv, tOffset);
  } else if (uStyle < 7.5) {
    pattern = aurora(uv, tOffset);
  } else if (uStyle < 8.5) {
    pattern = plasma(uv, tOffset);
  } else if (uStyle < 9.5) {
    pattern = iridescence(uv, tOffset);
  }

  pattern = clamp(pattern + softNoise(tex * 2.0) * 0.1, 0.0, 1.0);

  vec3 base = mix(vec3(0.045), uColor, 0.78);
  vec3 light = mix(uColor, vec3(1.0), 0.3);
  vec3 colRgb = mix(base, light, pattern) - rnd / 18.0 * uNoiseIntensity;
  vec4 col = vec4(colRgb, 1.0);
  col.a = 1.0;
  gl_FragColor = col;
}
`;

function linkTo(prefix, target) {
  return `${prefix}/${target}`.replace(/\/{2,}/g, "/").replace(/^\.\//, "./");
}

function displayDate(date) {
  return String(date || "").replaceAll("-", "/");
}

function reportTags(report) {
  const tags = Array.isArray(report.tags) ? report.tags : [];
  if (tags.length) return tags.slice(0, 2);
  return [report.category || "日报"].filter(Boolean);
}

function monthKey(date) {
  return String(date || "").slice(0, 7);
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state + 0x6d2b79f5, 1);
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
}

function randomInRange(random, min, max) {
  return min + random() * (max - min);
}

function coverParamsFor(report, index) {
  const seed = hashString(`${report.date || ""}:${report.title || ""}`);
  const random = seededRandom(seed);
  const styleIndex = Math.floor(random() * coverStyles.length);
  return {
    color: coverColor,
    noiseIntensity: randomInRange(random, 0.1, 2.2),
    rotation: randomInRange(random, -Math.PI, Math.PI),
    scale: randomInRange(random, 0.35, 1.35),
    speed: randomInRange(random, 0.08, 0.75),
    style: styleIndex,
    styleName: coverStyles[styleIndex],
  };
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createCoverProgram(gl) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, coverVertexShader);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, coverFragmentShader);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function ShaderCover({ params }) {
  const canvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false });
    if (!canvas || !gl) return undefined;

    const program = createCoverProgram(gl);
    if (!program) return undefined;

    const buffer = gl.createBuffer();
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const uniforms = {
      color: gl.getUniformLocation(program, "uColor"),
      noiseIntensity: gl.getUniformLocation(program, "uNoiseIntensity"),
      rotation: gl.getUniformLocation(program, "uRotation"),
      scale: gl.getUniformLocation(program, "uScale"),
      speed: gl.getUniformLocation(program, "uSpeed"),
      style: gl.getUniformLocation(program, "uStyle"),
      time: gl.getUniformLocation(program, "uTime"),
    };
    const rgb = hexToRgb(params.color);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start = performance.now();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(uniforms.color, rgb);
    gl.uniform1f(uniforms.noiseIntensity, params.noiseIntensity);
    gl.uniform1f(uniforms.rotation, params.rotation);
    gl.uniform1f(uniforms.scale, params.scale);
    gl.uniform1f(uniforms.speed, params.speed);
    gl.uniform1f(uniforms.style, params.style);
    let didReveal = false;

    const render = (now) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.uniform1f(uniforms.time, reduceMotion ? 0.18 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!didReveal) {
        didReveal = true;
        setIsReady(true);
      }
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [params.color, params.noiseIntensity, params.rotation, params.scale, params.speed, params.style]);

  return (
    <canvas
      aria-hidden="true"
      className={`shader-canvas${isReady ? " is-ready" : ""}`}
      data-cover-style={params.styleName}
      ref={canvasRef}
    />
  );
}

function Shell({ children, active = "日报" }) {
  return children;
}

function PageBackLink({ href = "./", label = "返回首页" }) {
  return (
    <a className="page-back-link" href={href}>
      ← {label}
    </a>
  );
}

function ReportCard({ report, index, prefix = "." }) {
  const coverParams = useMemo(() => coverParamsFor(report, index), [index, report]);

  return (
    <article className="report-card">
      <div className="media">
        <ShaderCover params={coverParams} />
        <a className="media__click-target" href={linkTo(prefix, report.reportPath)} aria-label={`阅读 ${report.title}`} />
        <div className="media__header">
          <a className="media__title" href={linkTo(prefix, report.reportPath)}>
            {report.title}
          </a>
          <div className="media__links">
            <a href={linkTo(prefix, report.reportPath)}>阅读</a>
            <a href={linkTo(prefix, report.pdfPath)}>PDF ↗</a>
          </div>
        </div>
        <p className="media__summary">{report.summary}</p>
      </div>
    </article>
  );
}

function CategoryTabs({ active, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="日报分类">
      {categories.map((category) => (
        <button
          aria-selected={active === category}
          className="tab"
          key={category}
          onClick={() => onChange(category)}
          type="button"
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function filterReports(category) {
  if (category === "全部") return reports;
  return reports.filter((report) => {
    const tags = reportTags(report);
    return report.category === category || tags.includes(category);
  });
}

function monthOptionsFor(sourceReports) {
  return Array.from(new Set(sourceReports.map((report) => monthKey(report.date)).filter(Boolean)));
}

function visibleReportsFor({ category, month, search, sortOrder }) {
  const normalizedSearch = search.trim().replaceAll("/", "-");

  return filterReports(category)
    .filter((report) => month === "全部" || monthKey(report.date) === month)
    .filter((report) => !normalizedSearch || String(report.date || "").includes(normalizedSearch))
    .slice()
    .sort((left, right) => {
      const diff = String(left.date || "").localeCompare(String(right.date || ""));
      return sortOrder === "asc" ? diff : -diff;
    });
}

function paginationItemsFor(currentPage, pageCount) {
  if (pageCount <= 9) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const visiblePages = new Set([1, pageCount]);
  for (let page = currentPage - paginationSiblingCount; page <= currentPage + paginationSiblingCount; page += 1) {
    if (page >= 1 && page <= pageCount) visiblePages.add(page);
  }

  return Array.from(visiblePages)
    .sort((left, right) => left - right)
    .reduce((items, page, index, pages) => {
      if (index > 0) {
        const previous = pages[index - 1];
        if (page - previous === 2) items.push(previous + 1);
        if (page - previous > 2) items.push(`ellipsis-${previous}-${page}`);
      }
      items.push(page);
      return items;
    }, []);
}

function FeedControls({
  category,
  className = "",
  countSummary,
  month,
  monthOptions,
  onCategoryChange,
  onMonthChange,
  onSearchChange,
  onSortChange,
  search,
  sortOrder,
}) {
  const sectionClassName = ["feed-controls", className].filter(Boolean).join(" ");

  return (
    <section className={sectionClassName}>
      <div className="feed-controls__left">
        {countSummary ? <span className="feed-count">{countSummary}</span> : null}
      </div>
      <div className="view-controls">
        <label>
          <span>筛选</span>
          <span className="select-shell">
            <select aria-label="按月份筛选" onChange={(event) => onMonthChange(event.target.value)} value={month}>
              <option value="全部">全部月份</option>
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>排序</span>
          <span className="select-shell">
            <select aria-label="按日期排序" onChange={(event) => onSortChange(event.target.value)} value={sortOrder}>
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="search-control">
          <span>搜索</span>
          <input
            aria-label="搜索特定日期"
            inputMode="numeric"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="YYYY-MM-DD"
            type="search"
            value={search}
          />
        </label>
      </div>
    </section>
  );
}

function HomePage() {
  const [category, setCategory] = useState("全部");
  const [month, setMonth] = useState("全部");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const monthOptions = useMemo(() => monthOptionsFor(filterReports(category)), [category]);
  const allVisibleReports = useMemo(
    () => visibleReportsFor({ category, month, search, sortOrder }),
    [category, month, search, sortOrder],
  );
  const visibleReports = useMemo(
    () => allVisibleReports.slice(0, reportsPerPage),
    [allVisibleReports],
  );
  const countSummary = `共 ${allVisibleReports.length} 篇 · 共 ${Math.max(1, Math.ceil(allVisibleReports.length / reportsPerPage))} 页`;

  return (
    <Shell active="日报">
      <main className="page">
        <section className="hero">
          <h1>Whistle 互联网日报</h1>
          <p className="intro">
            面向互联网工作群体的低噪音日报，保留会影响产品、研发、增长、商业化、基础设施与合规判断的信号。
          </p>
          {latest ? (
            <div className="hero-actions">
              <a className="button button--ghost" href={linkTo(".", latest.reportPath)}>
                阅读最新日报
              </a>
              <a className="button button--ghost" href="./archive/">
                查看归档
              </a>
              <a className="button button--ghost" href="./subscribe/">
                订阅
              </a>
            </div>
          ) : null}
        </section>

        <FeedControls
          category={category}
          countSummary={countSummary}
          month={month}
          monthOptions={monthOptions}
          onCategoryChange={setCategory}
          onMonthChange={setMonth}
          onSearchChange={setSearch}
          onSortChange={setSortOrder}
          search={search}
          sortOrder={sortOrder}
        />

        <section className="card-grid" aria-label="日报列表">
          {visibleReports.map((report, index) => (
            <ReportCard index={index} key={report.date} report={report} />
          ))}
        </section>

        <div className="center">
          <a className="load-more" href="./archive/">
            加载更多
          </a>
        </div>
      </main>
    </Shell>
  );
}

function ArchivePage() {
  const [category, setCategory] = useState("全部");
  const [month, setMonth] = useState("全部");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [pageNumber, setPageNumber] = useState(1);
  const monthOptions = useMemo(() => monthOptionsFor(filterReports(category)), [category]);
  const visibleReports = useMemo(
    () => visibleReportsFor({ category, month, search, sortOrder }),
    [category, month, search, sortOrder],
  );
  const pageCount = Math.max(1, Math.ceil(visibleReports.length / reportsPerPage));
  const currentPage = Math.min(pageNumber, pageCount);
  const firstReportIndex = (currentPage - 1) * reportsPerPage;
  const pagedReports = visibleReports.slice(firstReportIndex, firstReportIndex + reportsPerPage);
  const paginationItems = useMemo(() => paginationItemsFor(currentPage, pageCount), [currentPage, pageCount]);
  const countSummary = `共 ${visibleReports.length} 篇 · 第 ${currentPage}/${pageCount} 页`;

  useEffect(() => {
    setPageNumber(1);
  }, [category, month, search, sortOrder]);

  return (
    <Shell active="归档">
      <main className="page">
        <PageBackLink href="../" />
        <section className="archive-hero">
          <h1>日报归档</h1>
          <p className="intro">按日期保存的 Whistle 互联网日报。未来日报会使用结构化内容协议，历史日报保留原始输出。</p>
        </section>

        <FeedControls
          category={category}
          className="feed-controls--archive"
          countSummary={countSummary}
          month={month}
          monthOptions={monthOptions}
          onCategoryChange={setCategory}
          onMonthChange={setMonth}
          onSearchChange={setSearch}
          onSortChange={setSortOrder}
          search={search}
          sortOrder={sortOrder}
        />

        <section className="card-grid" aria-label="归档日报">
          {pagedReports.map((report, index) => (
            <ReportCard index={firstReportIndex + index} key={report.date} prefix=".." report={report} />
          ))}
        </section>

        {pageCount > 1 ? (
          <nav className="pagination" aria-label="归档分页">
            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <button
                  aria-current={item === currentPage ? "page" : undefined}
                  className="page-button"
                  key={item}
                  onClick={() => setPageNumber(item)}
                  type="button"
                >
                  {item}
                </button>
              ) : (
                <span aria-hidden="true" className="page-ellipsis" key={item}>
                  …
                </span>
              ),
            )}
          </nav>
        ) : null}
      </main>
    </Shell>
  );
}

function SubscribePage() {
  const [email, setEmail] = useState("");
  const trimmedEmail = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const silkParams = useMemo(
    () => ({
      color: coverColor,
      noiseIntensity: 0.7,
      rotation: 0,
      scale: 1,
      speed: 1,
      style: 0,
      styleName: "silk",
    }),
    [],
  );

  return (
    <Shell active="订阅">
      <main className="page subscribe-page">
        <div className="subscribe-shell">
          <PageBackLink href="../" />
          <section className="subscribe-hero">
            <h1>订阅 Whistle</h1>
            <form className="subscribe-form" onSubmit={(event) => event.preventDefault()}>
              <label className="sr-only" htmlFor="email">
                邮箱
              </label>
              <div className="subscribe-field">
                <input
                  aria-invalid={trimmedEmail.length > 0 && !isEmailValid}
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="邮箱"
                  type="email"
                  value={email}
                />
                <button disabled={!isEmailValid} type="submit">
                  <ShaderCover params={silkParams} />
                  <span>订阅</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </Shell>
  );
}

const pages = {
  archive: <ArchivePage />,
  home: <HomePage />,
  subscribe: <SubscribePage />,
};

createRoot(document.getElementById("root")).render(pages[page] || pages.home);
