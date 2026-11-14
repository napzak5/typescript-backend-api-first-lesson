# @beauty-salon-frontend/ui

3つのフロントエンドアプリが共有する React コンポーネントのパッケージです。コンポーネントは shadcn/ui の形（Radix UI + class-variance-authority + Tailwind CSS）で書かれています。

## コンポーネント

`src/index.ts` がエクスポートしているもの:

| エクスポート | ファイル | 内容 |
|--------------|----------|------|
| `Button`、`buttonVariants`、`ButtonProps` | `src/components/button.tsx` | `variant`: `default` / `destructive` / `outline` / `secondary` / `ghost` / `link`。`size`: `default` / `sm` / `lg` / `icon`。`asChild` で子要素にスタイルを渡せる |
| `Card`、`CardHeader`、`CardTitle`、`CardDescription`、`CardContent`、`CardFooter` | `src/components/card.tsx` | カードとその構成要素 |
| `EnvironmentBanner`、`EnvironmentBannerProps` | `src/components/environment-banner.tsx` | 実行環境を示す左上のリボン。`production` では何も描画しない |
| `cn` | `src/lib/utils.ts` | `clsx` と `tailwind-merge` でクラス名を結合する |

`src/components/tailwind-test.tsx` と `src/components/test-tailwind.tsx` は Storybook で Tailwind の動作を確かめるためのもので、エクスポートされていません。

```tsx
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@beauty-salon-frontend/ui'

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>予約</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant='outline' size='sm'>
          変更する
        </Button>
      </CardContent>
    </Card>
  )
}
```

## 構造

```
.storybook/         # Storybook の設定
src/
├── components/     # コンポーネントと、その *.test.tsx / *.stories.tsx
├── lib/utils.ts    # cn()
├── styles/index.css
└── index.ts        # パッケージの入口
components.json     # shadcn/ui の設定
rslib.config.ts     # ビルド設定
```

## コマンド

リポジトリのルートから実行します。

```bash
pnpm --filter @beauty-salon-frontend/ui run build:dev    # dist/ にビルド（build:test / build:stg / build:prod もある）
pnpm --filter @beauty-salon-frontend/ui run build:watch  # 変更を監視してビルド
pnpm --filter @beauty-salon-frontend/ui run typecheck    # 型検査
pnpm --filter @beauty-salon-frontend/ui run test         # 単体テスト（Vitest）
pnpm --filter @beauty-salon-frontend/ui run test:watch   # テストを監視実行
pnpm --filter @beauty-salon-frontend/ui run storybook    # Storybook を http://localhost:6006 で起動
pnpm --filter @beauty-salon-frontend/ui run build-storybook
```

- ビルドは rslib です。`dist/index.js` と型定義を出力し、`src/styles` を `dist/styles` にコピーします。
- アプリは `dist/` を参照します。コンポーネントを変えたらビルドし直すか、`pnpm dev`（このパッケージの監視ビルドを含む）を動かしておきます。
- リントとフォーマットは Biome で、リポジトリ全体に対してルートから実行します（`pnpm lint`、`pnpm format:fix`）。

## スタイル（Tailwind CSS 4）

- `src/styles/index.css` は `@beauty-salon-frontend/theme` の `styles/base`（CSS 変数とテーマ定義）を読み込み、続けて `@import "tailwindcss"` します。このパッケージに `tailwind.config.js` はありません。
- 色は theme の CSS 変数を参照するユーティリティ（`bg-primary`、`text-muted-foreground` など）で指定します。
- アプリで使うときは、アプリ側の Tailwind がクラスを生成します。各アプリの `src/index.css` が theme の `styles/base` と `tailwindcss` を読み込み、アプリの `tailwind.config.js` の `content` と theme の `@source` がこのパッケージの `src` を走査します。
- Storybook は `.storybook/main.ts` で `@tailwindcss/vite` を組み込み、`.storybook/preview.tsx` で `src/styles/index.css` を読み込みます。

## テスト

テストはコンポーネントの隣に `*.test.tsx` として置きます。DOM が必要なファイルは先頭に `// @vitest-environment jsdom` を書き、`react-dom/server` の `renderToStaticMarkup` で描画した結果を検証します（`src/components/button.test.tsx` を参照）。

## コンポーネントを追加する

1. `src/components/<name>.tsx` を作る。クラス名の結合は `../lib/utils` の `cn`、バリアントは `cva` を使う（`button.tsx` と同じ形）
2. `src/index.ts` からエクスポートする
3. `<name>.test.tsx` と `<name>.stories.tsx` を同じディレクトリに置く

shadcn/ui のコンポーネントを取り込む場合の注意: `components.json` は残っていますが、参照している `tailwind.config.js` はこのパッケージになく、エイリアス（`@/components`、`@/lib/utils`）も `tsconfig.json` の `paths` に定義されていません。現在の設定のまま `shadcn` の CLI でコンポーネントを追加できることは確認していません。取り込んだコードは、既存のコンポーネントと同じく相対パスの import（`../lib/utils`）に直してください。

## トラブルシューティング

| 問題 | 確認すること |
|------|--------------|
| アプリでスタイルが当たらない | アプリの `src/index.css` が theme の `styles/base` と `tailwindcss` を読み込んでいるか。アプリの `tailwind.config.js` の `content` にこのパッケージの `src` が含まれているか |
| アプリに変更が反映されない | このパッケージをビルドし直したか（アプリは `dist/` を参照する） |
| 型エラー | `pnpm --filter @beauty-salon-frontend/ui run typecheck` |

## リンク

- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
