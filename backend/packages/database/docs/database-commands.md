# Database Commands Guide

データベース操作のコマンドをまとめます。どれもリポジトリのルートから実行します。接続先は `DATABASE_URL` です。環境変数に設定されていればその値、なければ `.env`(それもなければ `NODE_ENV` に対応する `.env.<環境名>`、`NODE_ENV` が未指定なら `.env.localhost`)の値を使います。

| コマンド | 内容 | 既存データ |
|---|---|---|
| `pnpm db:migrate` | スキーマを最新にする | 保持 |
| `pnpm db:seed` | サンプルデータを投入する(ログインできるアカウントを含む。本番環境では実行を拒否する) | 空の DB が前提 |
| `pnpm db:truncate` | 全テーブルのデータを消す | 削除 |
| `pnpm db:fresh` | すべて削除してスキーマを作り直す | 削除 |
| `pnpm db:introspect` | DB から `schema.ts` / `relations.ts` を生成する | 読み取りのみ |
| `pnpm db:generate-sql` | `schema.ts` から `sql/setup.sql` を生成する | DB に接続しない |

## 1. マイグレーション

```bash
pnpm db:migrate
```

- **空の DB**: `sql/setup.sql`(全マイグレーション適用済みのスキーマ)から作成し、`sql/migrations/` の全ファイルを適用済みとして記録します。
- **それ以外**: 未適用のファイルだけを、ファイル名の順に 1 ファイル 1 トランザクションで適用します。失敗したファイルは丸ごとロールバックされ、以降は実行されません。
- 適用済みの一覧は `migration_history.applied_migrations` に記録されます(`public` とは別のスキーマなので、`db:introspect` や `db:truncate` の対象になりません)。
- 同時に実行しても直列化され、同じマイグレーションが 2 回適用されることはありません。毎回のデプロイで実行して安全です。

**一度どこかに適用したマイグレーションは編集しません。** 変更は新しいファイルとして追加します。

### ファイル名

```
sql/migrations/
├── 202509211049_add_salon_columns.sql
└── 202611140900_salon_list_columns_not_null.sql
```

`YYYYMMDDHHMM_description.sql`(作成日時 + スネークケースの説明)。この名前の順に適用されます。

### 書いている途中のマイグレーションを試す

```bash
pnpm db:migrate ./sql/migrations/202601011200_add_column.sql
```

パス(`backend/packages/database` からの相対パス、または絶対パス)を渡すと、そのファイルだけを実行します。適用済みとしては**記録しません**。

## 2. シード

```bash
pnpm db:seed              # サンプルデータを投入し、テーブルごとの件数を表示
pnpm db:seed --reset      # 全テーブルを空にしてから投入
pnpm db:seed --if-empty   # データがある DB には何もしない
pnpm db:truncate          # 全テーブルのデータを削除
```

シードは決まった行を入れるので、データがあるところへ足すことはできません。データがある DB にオプションなしで実行すると、何も書き込まずに、理由と 2 つの選択肢(`--reset`、`--if-empty`)を表示して、終了コード 1 で終わります。「データがある」は、サロンが 1 件以上あることです(`src/scripts/seed-plan.ts` の `planSeed`)。入れ直すときは `--reset` を使います。件数の表は、`public` スキーマのすべてのテーブルを数えます。

シードはログインできるアカウント(`admin@beautysalon.jp`、`owner@beautysalon.jp` など)を作ります。パスワードはすべて同じで、`src/seeds/seed-data/users.ts` の `SEED_PASSWORD` です。リポジトリで公開されているパスワードなので、`NODE_ENV=production` のときは、オプションにかかわらず `pnpm db:seed` は何もせずにエラーで終了します。アカウントの一覧とロールは [認証と認可](../../../../docs/authentication.md#シードのアカウント) にあります。

## 3. 作り直し

```bash
pnpm db:fresh
```

全テーブル・型・適用履歴を削除し、`sql/setup.sql` からスキーマを作り直します。データは投入しません(必要なら続けて `pnpm db:seed`)。**データがすべて消えるので、開発用の DB 以外では実行しません。**

## 4. スキーマ定義の生成

```bash
pnpm db:introspect     # DB → src/schema.ts, src/relations.ts
pnpm db:generate-sql   # src/schema.ts → sql/setup.sql
```

`schema.ts`・`relations.ts`・`sql/setup.sql` は生成物です。手で編集せず、DB を変更してからこの 2 つのコマンドで作り直します。出力は並び順が固定されているので、変更がなければ差分は出ません。

## 典型的なワークフロー

### 開発を始めるとき

```bash
pnpm db:migrate   # 空の DB ならスキーマを作成
pnpm db:seed --if-empty
```

### スキーマを変更するとき

1. `backend/packages/database/sql/migrations/` に SQL ファイルを追加する
2. 適用して、生成物を更新する

   ```bash
   pnpm db:migrate
   pnpm db:introspect
   pnpm db:generate-sql
   ```

3. マイグレーション・`schema.ts`・`relations.ts`・`sql/setup.sql` を一緒にコミットする
4. API のモデルを合わせる(`pnpm check:api-db` が API と DB の食い違いを検出します)

### CI での確認

```bash
pnpm check:db-schema
```

`db:fresh` → `db:introspect` → `db:generate-sql` を実行し、コミットされている生成物と差分がないことを確認します。接続先の DB を作り直すので、消えて困るデータがある DB には実行しません。
