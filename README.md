# DraftMach - ブルーアーカイブ総力戦ドラフト対戦システム (TDD版)

外部サービス不要で、手軽にリアルタイムドラフト対戦ができるシステムです。

## 特徴
- **外部サービス登録不要**: Supabase等の登録なしで、コマンド一つですぐに起動できます。
- **テスト駆動開発 (TDD)**: すべての主要ロジックにテスト（Vitest）を完備しています。
- **リアルタイム同期**: Socket.io を使用したスムーズな双方向通信。

## セットアップと起動

### 1. インストール
```bash
npm install
```

### 2. アプリの起動
```bash
npm run dev
```
`http://localhost:3000` でアプリが開きます。

### 3. テストの実行 (TDD)
```bash
npm test
```

## ルール
- **全6巡**: 1〜4巡目がストライカー、5〜6巡目がスペシャル枠です。
- **同時指名と重複解決**: 全員同時に指名し、被った場合はシステムがランダムに1人を選出。漏れた人は再指名。
- **放棄と再採用**: 獲得した生徒を放棄し、別の生徒を選び直すことができます。

## 技術スタック
- **Frontend**: Next.js 14, Tailwind CSS
- **Backend**: Node.js + Socket.io (Custom Server)
- **Testing**: Vitest, React Testing Library
- **Data**: Google Spreadsheet から最新の生徒情報を自動取得
