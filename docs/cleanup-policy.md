# クリーンアップ方針

コードベースに不要なコードを残さないための方針と、それを検査するツールをまとめます。方針の出どころは [CLAUDE.md](../CLAUDE.md) の「Clean Code Policy」です。

## 基本原則

**YAGNI（You Aren't Gonna Need It）**: いま使われているコードだけを置きます。「将来使うかもしれない」は残す理由になりません。必要になったときに、そのときの要件で書きます。

## 残さないもの

| 対象 | 対応 |
|------|------|
| どこからも使われていない変数・関数・型・ファイル | 削除する |
| テストからしか使われていない実装コード | 実装が必要としているなら実装から使う。必要としていないなら、テストと一緒に削除する |
| 将来の拡張のためのコード（未使用の引数、使われない選択肢、空の実装） | 削除する |
| コメントアウトされたコード | 削除する。過去の内容は Git の履歴にある |
| チケットのない `TODO` コメント | 書かない。やるべきことは issue にし、コメントに残すなら issue 番号を書く |
| 使われていない依存関係 | `package.json` から削除する |

テスト専用のヘルパーは削除の対象ではありません。`backend/packages/api/src/__tests__/_shared/` や `backend/packages/domain/src/__tests__/fixtures.ts` のように、`__tests__` ディレクトリの中に置きます。

### 例: 依存関係のインターフェース

ユースケースが受け取る依存関係には、実際に使うものだけを書きます。将来足すかもしれない依存関係を、optional なプロパティやコメントで先に書いておくことはしません。

```typescript
// backend/packages/domain/src/business-logic/salon/_shared/dependencies.ts
export interface SalonUseCaseDependencies {
  salonRepository: ISalonRepository
}
```

## 検査するツール

| 検出するもの | ツール | コマンド |
|--------------|--------|----------|
| 未使用の変数と import、`any` | Biome | `pnpm lint` |
| アプリケーションコードの型アサーション、型ガード、`throw`（[型安全性の原則](./type-safety-principles.md)） | Biome のプラグイン（`shared-config/biome/`） | `pnpm lint` |
| 未使用のローカル変数と引数 | TypeScript | `pnpm typecheck` |
| 未使用のファイル・export・依存関係 | knip | `pnpm knip` |
| TypeSpec と食い違っている生成ファイル | `scripts/check-clean.ts` | `pnpm check:generated` |

lint とフォーマットは、どちらも Biome で行います。

### Biome

設定はリポジトリ直下の `biome.json` です。クリーンアップに関係するルールは次のとおりで、どれも error です。

```json
// biome.json（linter.rules の抜粋）
"suspicious": {
  "noExplicitAny": "error"
},
"correctness": {
  "noUnusedVariables": "error",
  "noUnusedImports": "error"
}
```

`pnpm lint` は検査だけを行います。`pnpm format:fix` は、フォーマットと import の整列に加えて、lint の指摘のうち安全に直せるものを修正します。

### TypeScript

`shared-config/tsconfig/base.json` の `noUnusedLocals` と `noUnusedParameters` が、未使用のローカル変数と引数をコンパイルエラーにします。シグネチャの都合で残す引数は `_req` のように `_` で始めます。設定の全体は [TypeScript設定ガイド](./typescript-configuration.md) にあります。

### knip

`pnpm knip` は、どこからも import されていないファイル、使われていない export、`package.json` にあるのに使われていない依存関係を報告します。`pnpm knip:fix` は、そのうち自動で直せるものを修正します。

設定は `knip.json` です。knip が参照を追えない依存関係だけを `ignoreDependencies` に書いています（`.tsp` ファイルから import する TypeSpec のライブラリ、`scripts/dev-watch.ts` がコマンド文字列として実行する `concurrently` など）。報告を消すために項目を足すのではなく、先に本当に使われているかを確かめます。

### 生成ファイル

生成ファイル（`specs/tsp-output`、`backend/packages/generated/src`、`frontend/packages/api-client/src/generated`）はコミットしています。`pnpm check:generated` は `pnpm generate` で生成し直し、コミット済みの内容と差がないことを確かめます。TypeSpec から消したモデルの型が生成ファイルに残ることを防ぎます。

### pre-commit フック

`pnpm install` が husky のフックを入れます。コミット時に lint-staged（設定は `.lintstagedrc.json`）が、ステージされたファイルだけを対象に次を実行します。

- `*.ts`、`*.tsx`、`*.js`、`*.jsx`、`*.json`、`*.jsonc`、`*.css`: `biome check --write`（フォーマット、import の整列、lint。直せないエラーがあるとコミットは失敗する）
- `*.tsp`: `tsp format`

型検査、knip、テストはフックでは実行しません。

### CI

`.github/workflows/ci.yml` の quality ジョブが、プルリクエストごとに `pnpm check:generated`、`pnpm lint`、`pnpm format:check`、`pnpm typecheck`、`pnpm knip` を実行します。これらをローカルでまとめて実行するのが `make ci-check` です。

## ツールが検出しないもの

次のものはツールが報告しないので、レビューで確認します。

- パッケージの入口（`src/index.ts`）が export していて、他のパッケージから使われていないもの。knip は入口の export を公開 API とみなし、報告しません
- テストからだけ使われている実装コード。knip はテストからの参照も使用として数えます
- コメントアウトされたコードと、チケットのない `TODO` コメント
- 「将来のため」に用意された optional な引数やプロパティ

### レビュー時の確認事項

- [ ] 追加した export は、実装のどこかから使われているか
- [ ] 削除したコードだけが使っていた関数・型・依存関係が残っていないか
- [ ] コメントアウトされたコード、チケットのない `TODO` がないか
- [ ] いまの要件に必要のない引数・選択肢・抽象化がないか

## 変更を終えたときに期待される状態

```bash
pnpm lint             # Biome のエラーなし
pnpm format:check     # フォーマット済み
pnpm typecheck        # 型エラーなし（先にビルドが必要）
pnpm knip             # 未使用のファイル・export・依存関係なし
pnpm check:generated  # 生成ファイルが TypeSpec と一致
pnpm test             # 単体テストがすべて成功
pnpm test:integration # 統合テストがすべて成功（Docker が必要）
```

`make ci-check` は、依存関係のインストールから監査（`pnpm audit`）まで、CI の検査を同じ順で実行します。データベースを作り直す `pnpm check:db-schema` だけは含みません。

## 依存関係

- 使われていない依存関係は `pnpm knip` が報告します。`package.json` から削除し、`pnpm install` でロックファイルを更新します
- 実行時に必要なものは `dependencies`、ビルド・テスト・型検査にだけ必要なものは `devDependencies` に置きます
- `pnpm update:check` は、新しいリリースがある依存関係を一覧します（taze を使用。一覧するだけで、ファイルは変更しません）
