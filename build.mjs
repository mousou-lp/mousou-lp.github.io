// lps.json と、GitHubのIssueにあるLPのリクエストを読んで、時代ごとの年表のページを dist に書き出す。依存なし（Node 20 以上）
// 使い方: node build.mjs（中身を確かめるだけなら node build.mjs --check）
import { readFile, writeFile, mkdir, cp, rm, access } from "node:fs/promises";

const ORG = "mousou-lp";
const REQUIRED = ["slug", "title", "summary", "author", "url", "thumbnail", "date", "era"];
// 年表の区切り。mirai の build.mjs の eraOf と同じ並び。リクエストの用紙（.github/ISSUE_TEMPLATE/lp-request.yml）の選択肢もこれに合わせる
const ERAS = [
  { name: "2030年代", note: "あと10年ほど" },
  { name: "2040年代", note: "あと20年ほど" },
  { name: "2050年代", note: "あと30年ほど" },
  { name: "2070年ごろ", note: "いまの子どもが大人になるころ" },
  { name: "2100年ごろ", note: "いまの子どもの子どもの時代" },
  { name: "2200年ごろ", note: "200年ほど先" },
  { name: "もっと先", note: "まだ見当もつかない先" },
  { name: "わからない", note: "いつになるか、まだわからないもの" },
];
const checkOnly = process.argv.includes("--check");

const lps = JSON.parse(await readFile("lps.json", "utf8"));
const errors = [];
const slugs = new Set();
for (const [i, lp] of lps.entries()) {
  const where = lp.slug ?? `${i + 1}番目`;
  for (const key of REQUIRED) if (!lp[key]) errors.push(`${where}: ${key} がありません`);
  if (slugs.has(lp.slug)) errors.push(`${where}: slug がほかと同じです`);
  slugs.add(lp.slug);
  if (lp.url && !/^https:\/\//.test(lp.url)) errors.push(`${where}: url は https:// で始めてください`);
  if (lp.date && !/^\d{4}-\d{2}-\d{2}$/.test(lp.date)) errors.push(`${where}: date は 2026-10-24 の形で書いてください`);
  if (lp.summary && [...lp.summary].length > 60) errors.push(`${where}: summary は 60 字までにしてください`);
  if (lp.era && !ERAS.some((e) => e.name === lp.era)) errors.push(`${where}: era は ${ERAS.map((e) => e.name).join("・")} のどれかにしてください`);
  if (lp.thumbnail) await access(`public/${lp.thumbnail}`).catch(() => errors.push(`${where}: public/${lp.thumbnail} がありません`));
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
if (checkOnly) {
  console.log(`lps.json: ${lps.length} 件、問題なし`);
  process.exit(0);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const formatDate = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}年${m}月${day}日`;
};

const lpCard = (lp) => `
            <li class="card">
              <a class="card__link" href="${esc(lp.url)}">
                <img class="card__thumb" src="${esc(lp.thumbnail)}" alt="" width="960" height="600" loading="lazy" decoding="async" />
                <h3 class="card__title">${esc(lp.title)}</h3>
              </a>
              <p class="card__summary">${esc(lp.summary)}</p>
              <p class="card__meta">
                <span>作った人：<a href="https://github.com/${esc(lp.author)}">@${esc(lp.author)}</a></span>
                <time datetime="${esc(lp.date)}">${formatDate(lp.date)}</time>
              </p>
            </li>`;

// まだLPのないリクエスト。サムネイルのところに Coming soon を出す
const soonCard = (r) => `
            <li class="card card--soon">
              <a class="card__link" href="${esc(r.url)}">
                <span class="card__soon" aria-hidden="true">
                  <span class="card__soon-label">Coming soon</span>
                  <span class="card__soon-note">作る人を待っています</span>
                </span>
                <h3 class="card__title">${esc(r.name || clip(r.idea, 24))}</h3>
              </a>
              ${r.name || [...r.idea].length > 24 ? `<p class="card__summary">${esc(r.idea)}</p>` : ""}
              <p class="card__meta">
                <span class="votes">面白そう：${r.votes}票</span>
                <a href="${esc(r.url)}">面白そうを押す</a>
              </p>
              <p class="card__by">リクエストした人：<a href="https://github.com/${esc(r.author)}">@${esc(r.author)}</a></p>
            </li>`;

// LPのリクエストは、ラベル lp-request が付いた開いているIssue。閉じると年表から消える
const requests = await fetchRequests();

// 時代ごとに、LP（新しい順）のあとに、リクエスト（面白そうが多い順）を並べる
const eras = ERAS.map((era) => ({
  ...era,
  lps: lps.filter((lp) => lp.era === era.name).sort((a, b) => b.date.localeCompare(a.date)),
  requests: requests.filter((r) => r.era === era.name).sort((a, b) => b.votes - a.votes),
})).filter((era) => era.lps.length || era.requests.length);

const eraId = (i) => `era-${i + 1}`;
const timeline = eras.length
  ? `<nav class="era-nav" aria-label="時代">
        ${eras.map((e, i) => `<a href="#${eraId(i)}">${esc(e.name)}</a>`).join("\n        ")}
      </nav>
      <ol class="timeline" role="list">${eras
        .map(
          (e, i) => `
        <li class="era" id="${eraId(i)}">
          <div class="era__head">
            <h2 class="era__title">${esc(e.name)}</h2>
            <p class="era__note">${esc(e.note)}</p>
          </div>
          <ul class="grid" role="list">${e.lps.map(lpCard).join("")}${e.requests.map(soonCard).join("")}
          </ul>
        </li>`,
        )
        .join("")}
      </ol>`
  : `<p class="empty">まだLPもリクエストもありません。見てみたいサービスを書いてみてください。</p>`;

const template = await readFile("src/index.html", "utf8");
const html = template
  .replace("<!-- TIMELINE -->", timeline)
  .replace("<!-- COUNT -->", `${lps.length}`)
  .replace("<!-- SOON -->", `${requests.length}`)
  .replaceAll("<!-- ORG -->", ORG);

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp("src/style.css", "dist/style.css");
await writeFile("dist/index.html", html);
console.log(`dist/index.html: ${lps.length} 件の LP と ${requests.length} 件のリクエストを書き出しました`);

async function fetchRequests() {
  const url = `https://api.github.com/repos/${ORG}/${ORG}.github.io/issues?labels=lp-request&state=open&per_page=100`;
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let issues;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    issues = await res.json();
  } catch (e) {
    // 公開のときに取れなければ止める。手元ではリクエストなしで続ける
    if (process.env.CI) throw e;
    console.warn(`リクエストを取れませんでした（${e.message}）。リクエストなしで書き出します`);
    return [];
  }
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const form = parseForm(i.body ?? "");
      const name = i.title.replace(/^LPのリクエスト[:：]\s*/, "").trim();
      const idea = form["どんなサービスか"] || name;
      const era = ERAS.some((e) => e.name === form["いつごろの未来のサービスか"]) ? form["いつごろの未来のサービスか"] : "わからない";
      return {
        name: name === idea ? "" : clip(name, 40),
        idea: clip(idea, 120),
        era,
        // 面白そうの票は、Issueへの親指のマークの数
        votes: i.reactions?.["+1"] ?? 0,
        author: i.user.login,
        url: i.html_url,
      };
    })
    .filter((r) => r.idea);
}

// Issueのフォームは「### 見出し」と答えが交互に並ぶ。答えのない欄は _No response_ になる
function parseForm(body) {
  const out = {};
  for (const part of body.split(/^###\s+/m).slice(1)) {
    const [label, ...rest] = part.split("\n");
    const value = rest.join("\n").trim();
    out[label.trim()] = value === "_No response_" ? "" : value;
  }
  return out;
}

function clip(s, max) {
  const chars = [...s.replace(/\s+/g, " ").trim()];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : chars.join("");
}
