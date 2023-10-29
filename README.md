# FlightBooksオープンソース版

https://flightbooks.pub/ のビルド環境をローカルに特化して移植しました。

## 技術同人誌を気軽に書くためのPDF生成環境です

FlightBooksは技術書典をはじめとする技術同人誌を、気軽に書くためのツールセットです。
Markdownで章ごとに執筆し、config.ymlを書き換えるだけで、同人印刷所に入稿可能なPDFをビルドできます。
同様の執筆環境にはRe:VIEWやVivliostyleがありますが、Flightbooksの特徴としては、エンジニア（とくにWeb系の方）が細かいことを気にせず最低限の設定で同人誌のデータを作れることを目標としています。そのため、あまり自由なレイアウトを作り上げるには不向きです。

## TODO

- cover / はじめに / おわりに / 奥付の実装
- codeのハイライト、引用、脚注のパーサー調整
- ドキュメントをわかりやすく
- Dockerhubにアップしてみたい

## はじめかた

- 記事をbook配下のNN.mdに書く
- 画像を埋め込む場合はbook/images配下に設置し、相対パスで埋め込む。
  - リモート画像はネットワーク環境により読み込めない（読み込み完了を待たずにPDF生成する）可能性がある
- node generate_html.js を実行する
- node generate_pdf.js を実行する
- build/配下に成果物が出来上がる

## 直接実行とDockerイメージ

直接実行の場合、実行環境にNodeJS 20、適切なフォント*とPlaywright対応の実行環境をインストールする必要があります。

付属のDockerイメージには、これら必要な環境をインストールしてありますので、ぜひご活用ください。

```
docker compose build
docker compose run flightbooks node generate_html.js
docker compose run flightbooks node generate_pdf.js
```

## フォントについて

同人印刷所で印刷可能なPDFを生成するには、フォントをファイル内に埋め込む必要があります。しかしChrome（のSkiaPDFエンジン）の制限により、Noto SansなどOTFフォントに対応していません。Flightbooksではアウトライン化することで対応していましたが、OSS版ではMgen+フォントを利用することで対応しています。template内に再配布の形で含めていますので、詳しくはライセンスファイルとDockerfileをお読みください。

## ライセンスについて

本リポジトリのコードはMITライセンスとします。再配布物に関してはそれぞれのライセンスをご覧ください。