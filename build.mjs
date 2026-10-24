// lps.json を読んで、一覧のページを dist に書き出す。依存なし（Node 20 以上）
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
            <h2 class="card__title">${esc(lp.title)}</h2>
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

const template = await readFile("src/index.html", "utf8");
const html = template
  .replace("<!-- LPS -->", list)
  .replace("<!-- COUNT -->", `${lps.length}`)
  .replaceAll("<!-- ORG -->", ORG);

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp("src/style.css", "dist/style.css");
await writeFile("dist/index.html", html);
console.log(`dist/index.html: ${lps.length} 件の LP を書き出しました`);
