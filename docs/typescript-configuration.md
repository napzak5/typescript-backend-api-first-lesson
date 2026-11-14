# TypeScript設定ガイド

このリポジトリの TypeScript 設定がどのファイルにあり、何を設定していて、ビルドや型検査とどう関係するかを説明します。型の書き方の規則は [型安全性の原則](./type-safety-principles.md) にあります。

## バージョン

- TypeScript 7（`^7.0.2`）を使います。`tsc` を実行するパッケージは、それぞれ自分の `package.json` に `typescript` を持っています
- `backend/packages/generated` だけは TypeScript `5.9.3` に固定しています。型生成に使う `openapi-typescript` が TypeScript 5 のコンパイラ API を必要とするためです。このパッケージの `typescript` は上げません
- Node.js は `.node-version` の 26.13.1 です

## 設定ファイルの構成

共通設定は `shared-config/tsconfig/` にあり、`@beauty-salon-shared/config` パッケージとして各パッケージから `extends` で参照します。

| ファイル | 内容 |
|----------|------|
| `shared-config/tsconfig/base.json` | すべての基本。型検査のオプションはここで決める |
| `shared-config/tsconfig/backend.json` | base + Node 向け（`types: ["node"]`） |
| `shared-config/tsconfig/frontend.json` | base + ブラウザ向け（`lib` に DOM、`jsx: react-jsx`、`types: ["vite/client"]`） |
| `shared-config/tsconfig/tsconfig.lib.json` | base + ライブラリパッケージ用（`src` を対象にし、`dist` に出力） |
| `shared-config/tsconfig/tsconfig.app.json` | base + `tsc` で JavaScript を出力するアプリ用 |

各 `tsconfig` がどれを継承しているかは次のとおりです。

| tsconfig | 継承元 |
|----------|--------|
| `tsconfig.json`（リポジトリ直下。`scripts/**/*.ts` 用） | `base.json` |
| `backend/packages/{api,config,infrastructure,utility}/tsconfig.json` | `tsconfig.lib.json` |
| `backend/packages/domain/tsconfig.json` | `backend.json` |
| `backend/packages/{database,generated}/tsconfig.json` | `base.json` |
| `backend/apps/server/tsconfig.json` | `tsconfig.app.json` |
| `backend/packages/*/tsconfig.build.json`、`backend/apps/server/tsconfig.build.json`、`frontend/packages/*/tsconfig.build.json` | 同じディレクトリの `tsconfig.json`（ビルド用。テストを除外） |
| `frontend/packages/*/tsconfig.json` | `tsconfig.lib.json` |
| `frontend/apps/*/tsconfig.app.json`、`tsconfig.node.json` | `frontend.json` |

## 基本設定（base.json）

```json
// shared-config/tsconfig/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ESNEXT",
    "lib": ["ESNEXT"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false,
    "removeComments": true,
    "newLine": "lf",
    "allowSyntheticDefaultImports": true,
    "composite": false,
    "incremental": true
  }
}
```

### 型検査のオプション

| オプション | 効果 |
|------------|------|
| `strict` | `strictNullChecks` などの厳格な検査をまとめて有効にする |
| `noUncheckedIndexedAccess` | 添字や分割代入で取り出した要素の型に `undefined` を加える。書き方は [型安全性の原則](./type-safety-principles.md) を参照 |
| `exactOptionalPropertyTypes` | 省略可能なプロパティ（`name?: string`）に `undefined` を明示的に代入することをエラーにする。「ない」と「`undefined` が入っている」を区別する |
| `noPropertyAccessFromIndexSignature` | インデックスシグネチャから来るプロパティ（`process.env` や HTTP ヘッダーなど）をドットで読むことをエラーにする。分割代入（`const { NODE_ENV } = process.env`）か、ブラケット（`headers['location']`）で読む |
| `noUnusedLocals` / `noUnusedParameters` | 未使用のローカル変数と引数をエラーにする。使わない引数は `_req` のように `_` で始める |
| `noFallthroughCasesInSwitch` | `switch` の `case` が次へ抜けるのをエラーにする |

[CLAUDE.md](../CLAUDE.md) の「TypeScript Configuration」が挙げる 4 つ（`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noPropertyAccessFromIndexSignature`）は、すべて `base.json` で有効で、`base.json` を継承するすべての `tsconfig` に効きます。

`noPropertyAccessFromIndexSignature` はブラケットでの参照を求めるので、それをドットに書き換えさせる Biome のルール `useLiteralKeys` は `biome.json` で無効にしています。

### モジュールのオプション

- `module: "ESNext"` と `moduleResolution: "bundler"`: すべてのパッケージが ES モジュール（`"type": "module"`）で、`package.json` の `exports` を解決に使う
- `isolatedModules`: ファイル単位で変換できる書き方だけを許す。型だけの import は `import type`（または `import { type X }`）で書く。Biome の `useImportType` / `useExportType` も同じことを検査する

### 出力のオプション

`base.json` は `noEmit: true` です。出力が必要なパッケージが、自分の `tsconfig.json` で `noEmit: false`、`declaration: true`、`outDir`、`rootDir` を設定します。

## パッケージごとの設定とビルド

| 対象 | JavaScript の出力 | 型定義（`.d.ts`）の出力 |
|------|-------------------|-------------------------|
| `backend/packages/{api,config,database,domain,infrastructure,utility}` | rslib（`dist/index.js` に束ねる） | `tsc --emitDeclarationOnly --project tsconfig.build.json` |
| `backend/packages/generated` | rslib | rslib（`dts: true`） |
| `backend/apps/server` | `tsc --project tsconfig.build.json` | 同左 |
| `frontend/packages/*` | rslib | rslib（`dts: true`。`tsconfig.build.json` を使う） |
| `frontend/apps/*` | Vite | 出力しない |

### バックエンドのパッケージ

```json
// backend/packages/api/tsconfig.json
{
  "extends": "@beauty-salon-shared/config/tsconfig.lib.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "types": ["vitest/globals", "node"]
  },
  "references": [
    { "path": "../domain" },
    { "path": "../generated" },
    { "path": "../infrastructure" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

ビルドスクリプトは `rslib build && tsc --emitDeclarationOnly --project tsconfig.build.json` です。rslib（設定は各パッケージの `rslib.config.ts`）が JavaScript を出力し、`tsc` が型定義だけを `dist` に出力します。`tsconfig.build.json` はこの `tsconfig.json` を継承し、`src/**/__tests__/**` を除外するだけのファイルです（テストの型定義を `dist` に出さないため）。型検査（`pnpm typecheck`）は `tsconfig.json` を使うので、テストも検査されます。

### サーバーアプリ

`backend/apps/server` は rslib を使わず、`tsc` だけでビルドします。

```json
// backend/apps/server/tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules",
    "dist",
    "src/**/__tests__/**"
  ]
}
```

`tsc` は import の指定子を書き換えず、出力された `dist/index.js` は Node.js がそのまま実行します。Node.js は相対 import の拡張子を補わないので、サーバーアプリの相対 import には `.js` を付けます。

```typescript
// backend/apps/server/src/index.ts
import { startServer } from './server.js'
```

付け忘れても型検査は通り（`moduleResolution: "bundler"` は拡張子なしを許すため）、`pnpm start:backend` で起動したときに初めて失敗します。rslib が1ファイルに束ねるパッケージと、Vitest が実行するテストでは、拡張子は付けません。

### ワークスペースパッケージの解決（`@beauty-salon-backend/source`）

バックエンドの各パッケージは、`exports` に独自の条件を1つ持っています。

```json
// backend/packages/domain/package.json
"exports": {
  ".": {
    "@beauty-salon-backend/source": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

この条件を指定した実行だけが、他のパッケージをビルドせずにソースから読み込みます。

| 実行 | 条件の指定 | 読み込まれるもの |
|------|------------|------------------|
| `pnpm dev:backend` | `tsx watch --conditions=@beauty-salon-backend/source` | `src/index.ts` |
| `pnpm test`、`pnpm test:integration`（api、config、database、domain、infrastructure、server） | 各 `vitest.config.ts` / `vitest.integration.config.ts` の `ssr.resolve.conditions` | `src/index.ts` |
| DB スクリプト（`pnpm db:migrate` など） | `tsx --conditions=@beauty-salon-backend/source` | `src/index.ts` |
| `pnpm typecheck`、各パッケージの `tsc` | なし | `dist/index.d.ts` |
| `pnpm start:backend` | なし | `dist/index.js` |

`tsc` は条件を指定していないので、依存するパッケージの型をビルド成果物から読みます。そのため `pnpm typecheck` の前にビルドが必要です（`make ci-check` と CI は `pnpm build:prod` の後に実行しています）。依存先のパッケージを変更したのに型エラーが古いままのときは、ビルドし直してください。

### フロントエンド

- アプリ（`frontend/apps/*`）の `tsconfig.json` は `references` だけを持ち、`tsconfig.app.json`（`src` 用。`@/*` を `./src/*` に対応させる `paths` を持つ）と `tsconfig.node.json`（`vite.config.ts` 用）に分かれています。型検査は `tsc --build`、ビルドは Vite です
- パッケージ（`frontend/packages/*`）は `tsconfig.lib.json` を継承し、必要に応じて `lib` に DOM、`jsx: "react-jsx"` を足しています。rslib は `tsconfig.build.json`（`*.test.ts(x)` と `*.stories.tsx` を除外）で型定義を出力するので、テストの型定義は `dist` に入りません。型検査（`pnpm typecheck`）は `tsconfig.json` を使い、テストも検査します

### Node.js が直接実行するスクリプト

`scripts/*.ts` は、ビルドせずに `node ./scripts/check-versions.ts` のように実行します。リポジトリ直下の `tsconfig.json` は、そのための2つのオプションを足しています。

- `erasableSyntaxOnly`: 型を取り除くだけで実行できる構文に限る（`enum` などを禁止する）
- `verbatimModuleSyntax`: 型だけの import / export に `type` を必須にする

## コマンド

| コマンド | 内容 |
|----------|------|
| `pnpm typecheck` | リポジトリ直下の `tsconfig.json` を検査し、続けて各パッケージの `typecheck` スクリプト（`tsc --noEmit`、フロントエンドのアプリは `tsc --build`）を実行する。先にビルドが必要 |
| `pnpm build:dev`、`build:test`、`build:stg`、`build:prod` | 各パッケージを上の表の方法でビルドする |
| `pnpm dev:backend` | サーバーをソースから起動し、変更のたびに再起動する |

## TypeScript 7 での注意点

TypeScript 5 までの設定例をそのまま使うとエラーになるものです。

- **`types` は明示する**: `@types/*` は自動では読み込まれません。Node.js の型を使うパッケージは `"types": ["node"]` を、Vitest のグローバルを使うパッケージは `"vitest/globals"` を指定しています。指定がないと `Cannot find name 'process'` のようなエラーになります
- **`baseUrl` と `moduleResolution: "node"` は削除された**: 指定すると `tsc` がエラーにします。`paths` は `baseUrl` なしで、`tsconfig` からの相対パス（`"@/*": ["./src/*"]`）で書きます
