# 妄想LP ポータル

未来の技術と自分の偏愛から、架空のサービスを妄想する。その未来を考えることで、いまの自分の生き方に干渉して、ポジティブな変化を起こす。

ここは、そうして妄想したサービスのLPを集めた一覧のページです。https://mousou-lp.github.io に出ています。

遊び場なので、だれが何を直してもかまいません。mainに直接入れても、プルリクエストを出してもいいです。mainに入ると、数分で自動で公開されます。

LPそのものはここに置かず、1つのLPにつき1つのリポジトリを作ります。ここには一覧にのせる情報だけを書きます。

## LPを足す

1. [lp-template](https://github.com/mousou-lp/lp-template)の「Use this template」から、`mousou-lp`の中に自分のLPのリポジトリを作る（名前は`<サービス名>-lp`、公開にする）
2. LPを作ってmainに入れる。`https://mousou-lp.github.io/リポジトリ名/`に自動で出る
3. このリポジトリの`lps.json`に1件足し、`public/thumbs/<slug>.webp`にサムネイル（横960px、縦600px、16:10）を置く

`lps.json`の1件はこう書きます。

```json
{
  "slug": "eternal-pet",
  "title": "ETERNAL PET",
  "summary": "60字までの、どんなサービスかの説明。",
  "author": "GitHubのユーザー名",
  "url": "https://mousou-lp.github.io/eternal-pet-lp/",
  "thumbnail": "thumbs/eternal-pet.webp",
  "date": "2026-10-24"
}
```

## LPのリクエスト

LPはまだないけれど、こんなサービスを見てみたい、というときは、ポータルの「リクエストを書く」から書きます。中身はこのリポジトリのIssueで、ラベル`lp-request`が付きます。

- 開いているリクエストは、ポータルの「作る人を待っているリクエスト」に並ぶ。書くと数分で出る
- 作りはじめる人は、そのIssueに一言書く
- LPができたら`lps.json`に足して、Issueを閉じる。閉じると一覧から消える

## 手元で見る

```bash
node build.mjs && python3 -m http.server 5180 -d dist
```

`node build.mjs --check`で`lps.json`の書き方だけを確かめられます。同じチェックがmainに入るときとプルリクエストでも動き、通らないと公開されません。

## 決まり

- 架空のサービスなので、検索エンジンに載せない。`public/robots.txt`が、各LPもふくめてまとめて止めている
- 実在する会社や人の名前、ロゴを使わない
- 本物の申し込みや支払いを受け付けない。フォームは送っても何も起きないようにする
- お金のかかるサービスは使わない。GitHubの無料の範囲で作る
- 見た目の決まりは[DESIGN.md](DESIGN.md)
