# 妄想LP ポータル

実在しないサービスのLPを集めた一覧のページです。LPそのものはここに置かず、1つのLPにつき1つのリポジトリを作り、ここには一覧にのせる情報だけを書きます。

## LPを足す

1. [lp-template](https://github.com/mousou-lp/lp-template)の「Use this template」から、`mousou-lp`の中に自分のLPのリポジトリを作る（名前は`<サービス名>-lp`）
2. LPを作って、Netlifyなどで公開する
3. このリポジトリにブランチを切り、次の2つを足してプルリクエストを出す
   - `lps.json`に1件
   - `public/thumbs/<slug>.webp`にサムネイル（横960px、縦600px、16:10）
4. チェックが通り、だれか1人がよしとしたらマージする。マージすると一覧に出る

`lps.json`の1件はこう書きます。

```json
{
  "slug": "eternal-pet",
  "title": "ETERNAL PET",
  "summary": "60字までの、どんなサービスかの説明。",
  "author": "GitHubのユーザー名",
  "url": "https://公開したURL/",
  "thumbnail": "thumbs/eternal-pet.webp",
  "date": "2026-10-24"
}
```

## 手元で見る

```bash
node build.mjs && npx serve dist
```

`node build.mjs --check`で`lps.json`の書き方だけを確かめられます。同じチェックがプルリクエストでも動きます。

## 決まり

- 架空のサービスなので、どのLPも検索エンジンに載せない（`noindex`）
- 実在する会社や人の名前、ロゴを使わない
- 本物の申し込みや支払いを受け付けない。フォームは送っても何も起きないようにする
- 見た目の決まりは[DESIGN.md](DESIGN.md)
