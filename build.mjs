// lps.json と、GitHubのIssueにあるLPのリクエストを読んで、一覧のページを dist に書き出す。依存なし（Node 20 以上）
// 使い方: node build.mjs（中身を確かめるだけなら node build.mjs --check）
import { readFile, writeFile, mkdir, cp, rm, access } from "node:fs/promises";

const ORG = "mousou-lp";
const REQUIRED = ["slug", "title", "summary", "author", "url", "thumbnail", "date"];
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

// 新しいものを上に
const sorted = [...lps].sort((a, b) => b.date.localeCompare(a.date));
const cards = sorted
  .map(
    (lp) => `
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
        </li>`,
  )
  .join("");

const list = sorted.length
  ? `<ul class="grid" role="list">${cards}
      </ul>`
  : `<p class="empty">まだLPがありません。最初の1つを作ってみてください。</p>`;

// LPのリクエストは、ラベル lp-request が付いた開いているIssue。閉じると一覧から消える
const requests = await fetchRequests();
const requestItems = requests
  .map(
    (r) => `
        <li class="request">
          ${r.name ? `<h3 class="request__name">${esc(r.name)}</h3>` : ""}
          <p class="request__idea">${esc(r.idea)}</p>
          ${r.who ? `<p class="request__who">だれのため：${esc(r.who)}</p>` : ""}
          <p class="card__meta">
            <span>書いた人：<a href="https://github.com/${esc(r.author)}">@${esc(r.author)}</a></span>
            <a href="${esc(r.url)}">くわしく見る</a>
          </p>
        </li>`,
  )
  .join("");
const requestList = requests.length
  ? `<ul class="requests" role="list">${requestItems}
      </ul>`
  : `<p class="empty">いま待っているリクエストはありません。見てみたいサービスを書いてみてください。</p>`;

const template = await readFile("src/index.html", "utf8");
const html = template
  .replace("<!-- LPS -->", list)
  .replace("<!-- REQUESTS -->", requestList)
  .replace("<!-- COUNT -->", `${lps.length}`)
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
      return { name: name === idea ? "" : name, idea: clip(idea, 120), who: clip(form["だれのためのサービスか"] ?? "", 40), author: i.user.login, url: i.html_url };
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
