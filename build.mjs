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

// アイデアの種は、Discussions の Ideas に書かれたもの。ポータルのトップには出さず、/seeds/ にだけ並べる
const seeds = await fetchSeeds();
await mkdir("dist/seeds", { recursive: true });
await writeFile("dist/seeds/index.html", seedsPage(seeds));
console.log(`dist/seeds/index.html: ${seeds.length} 件の種を書き出しました`);

function seedsPage(seeds) {
  const newSeed = `https://github.com/${ORG}/${ORG}.github.io/discussions/new?category=ideas`;
  const items = seeds
    .map((s) => {
      const promoted = requests.find((r) => r.body.includes(s.url));
      const promote = `https://github.com/${ORG}/${ORG}.github.io/issues/new?${new URLSearchParams({
        template: "lp-request.yml",
        title: `LPのリクエスト: ${s.title}`,
        idea: s.idea,
        era: s.era,
        more: `アイデアの種から。${s.url}`,
      })}`;
      return `
          <li class="seed">
            <h2 class="seed__title"><a href="${esc(s.url)}">${esc(s.title)}</a></h2>
            ${s.idea !== s.title ? `<p class="seed__idea">${esc(s.idea)}</p>` : ""}
            ${s.from ? `<p class="seed__from">${esc(s.from)}</p>` : ""}
            <p class="card__meta">
              <span class="seed__counts"><span class="votes">面白そう：${s.votes}票</span><span>重ねた考え：${s.comments}件</span><span>${esc(s.era)}</span></span>
              <span>まいた人：<a href="https://github.com/${esc(s.author)}">@${esc(s.author)}</a></span>
            </p>
            <p class="seed__actions">
              <a href="${esc(s.url)}">考えを重ねる</a>
              ${promoted ? `<a href="${esc(promoted.url)}">LPの候補になりました</a>` : `<a href="${esc(promote)}">LPの候補にする</a>`}
            </p>
          </li>`;
    })
    .join("");
  const list = seeds.length
    ? `<ol class="seeds" role="list">${items}
        </ol>`
    : `<p class="empty">まだ種がありません。ひとことの妄想から、まいてみてください。</p>`;
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>アイデアの種 | 妄想LP</title>
    <meta name="description" content="まだLPにするほどではない妄想を置いて、みんなで考えを重ねる場所です。" />
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../style.css" />
  </head>
  <body>
    <nav class="site-nav container" aria-label="妄想LP">
      <a href="../">妄想LP</a>
      <a href="../mirai/">未来のこと</a>
      <a href="../tane/">妄想のタネ</a>
      <a href="./" aria-current="page">アイデアの種</a>
    </nav>
    <main class="container">
      <header class="site-header">
        <h1 class="site-title">アイデアの種</h1>
        <p class="site-lead">まだLPにするほどではない妄想を、そのまま置いておく場所です。ここに置いた種は、ポータルのトップには出ません。ほかの人が考えを重ねて、面白くなったものをLPの候補に上げます。</p>
      </header>
      <ol class="ladder" role="list">
        <li><span class="ladder__num" aria-hidden="true">1</span><span><strong>種をまく</strong>ひとことの妄想でかまいません</span></li>
        <li><span class="ladder__num" aria-hidden="true">2</span><span><strong>考えを重ねる</strong>返信で、ふくらませたり、ひねったりします。面白そうなら親指のマークを押します</span></li>
        <li><span class="ladder__num" aria-hidden="true">3</span><span><strong>LPの候補にする</strong>だれが上げてもかまいません。ポータルの年表に、Coming soonとして並びます</span></li>
      </ol>
      <p class="request-bar__actions">
        <a class="button" href="${newSeed}">種をまく<svg class="button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg></a>
      </p>
      <section class="seeds-section" aria-label="まかれた種">
        ${list}
      </section>
    </main>
    <footer class="site-footer">
      <div class="container">
        <a href="https://github.com/${ORG}/${ORG}.github.io/discussions/categories/ideas">GitHubで種を見る</a>
        <a href="../">妄想LPのポータル</a>
      </div>
    </footer>
  </body>
</html>
`;
}

async function fetchSeeds() {
  // Discussions は GraphQL でしか読めず、読むにはトークンが要る。公開のときは Actions のトークンを使う
  if (!process.env.GITHUB_TOKEN) {
    if (process.env.CI) throw new Error("GITHUB_TOKEN がありません");
    console.warn("GITHUB_TOKEN がないので、種なしで書き出します");
    return [];
  }
  const query = `query {
    repository(owner: "${ORG}", name: "${ORG}.github.io") {
      discussionCategory(slug: "ideas") {
        discussions(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes { title url body createdAt author { login } comments { totalCount } reactions(content: THUMBS_UP) { totalCount } }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`種を取れませんでした: ${JSON.stringify(json.errors ?? res.status)}`);
  const nodes = json.data.repository.discussionCategory?.discussions.nodes ?? [];
  return nodes
    .map((d) => {
      const form = parseForm(d.body ?? "");
      // 名前を書いていない種は、説明をそのまま見出しにする
      const named = d.title.replace(/^アイデアの種[:：]\s*/, "").trim();
      const title = named || clip(form["どんな妄想か"] ?? "", 80);
      const from = [form["どんな未来から考えたか"], form["どんな偏愛から考えたか"]].filter(Boolean).join(" × ");
      return {
        title: named ? clip(named, 40) : title,
        idea: named ? clip(form["どんな妄想か"] || named, 160) : title,
        era: ERAS.some((e) => e.name === form["いつごろの未来か"]) ? form["いつごろの未来か"] : "わからない",
        from,
        votes: d.reactions.totalCount,
        comments: d.comments.totalCount,
        author: d.author?.login ?? "ghost",
        url: d.url,
        createdAt: d.createdAt,
      };
    })
    .filter((s) => s.title)
    .sort((a, b) => b.votes + b.comments - (a.votes + a.comments) || b.createdAt.localeCompare(a.createdAt));
}

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
        // アイデアの種から上がったものかを見分けるのに使う
        body: i.body ?? "",
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
