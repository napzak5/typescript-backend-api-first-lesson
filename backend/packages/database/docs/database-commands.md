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

シードは決まった行を入れるので、データがあるところへ足すことはできません。データがある DB にオプションなしで実行すると、何も書き込まずに、理由と 2 つの選択肢(`--reset`、`--if-empty`)を表示して、終了コード 1 で終わります。「データがある」は、サロンが 1 件以上あることです(`src/scripts/seed-plan.ts` の `planSeed`)。入れ直すときは `--reset` を使います。`--reset` と `pnpm db:truncate` は、`public` スキーマのすべてのテーブルを、カタログから読んで空にします(`src/scripts/tables.ts` の `truncateAll`。`pnpm db:reset` が消すテーブルと同じ読み方です)。適用履歴(`migration_history` スキーマ)は残ります。件数の表は、`public` スキーマのすべてのテーブルを数えます。

シードはログインできるアカウント(`admin@beautysalon.jp`、`owner@beautysalon.jp` など)を作ります。パスワードはすべて同じで、`src/seeds/seed-data/users.ts` の `SEED_PASSWORD` です。リポジトリで公開されているパスワードなので、`NODE_ENV=production` のときは、オプションにかかわらず `pnpm db:seed` は何もせずにエラーで終了します。アカウントの一覧とロールは [認証と認可](../../../../docs/authentication.md#シードのアカウント) にあります。

### シードの作り

- `src/seeds/seed.ts` の `seed` が、行が指す行の順に、`src/seeds/seed-data/` の段を 1 つずつ実行し、段ごとに、進み具合をコマンドの出力(`say`)に書きます。API のテストのサーバーは、何も書かない `seedDatabase` で、テンプレートのデータベースに入れます。
- シードは、入れるどの行にも ID を決め(`randomUUID()`。シードのたびに変わります)、あとの段が指す行に名前を付けて渡します。サロンは `tokyo` と `osaka`、顧客は `first`、`second`、`third`、`vip`、スタッフはサロンとコード(`STF001` など)、サービスはサロンと名前、商品はサロンとコード、済んだ来店は顧客と内容(`firstCutAndTreatment` など)です。入れた行を読み返して、位置で指すことはありません。
- 予約の型は、そのサロンのスタッフのコードとサービスの名前しか書けません。サロンの違うスタッフやサービスを書いた予約は、コンパイルできません。
- シードのサービスは、どれも税込み(型が `taxIncluded: true`)なので、予約の消費税は 0 です。日本の店頭の価格は、税込みで示します(総額表示)。

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

## コマンドの作り

`pnpm db:*` と `pnpm check:api-db` は、どれも同じ入口 `src/scripts/main.ts` を、コマンドの名前を付けて実行します(`backend/packages/database/package.json`。`db:fresh` は `db:reset` と `db:setup` を続けて実行します)。

- コマンドは `src/scripts/commands/` に 1 つずつあり、一覧は `src/scripts/commands/index.ts` の `COMMANDS` です。
- `src/scripts/command.ts` の `runCommand` が、名前でコマンドを選び、環境変数ファイルを読み込み、接続先を決め(`databaseUrlOf`)、実行して、その終了コードで終わります。コマンドが失敗したときは、ここで 1 回だけ受け止め、理由を表示して終了コード 1 で終わります。
- どのコマンドも `--help`(`-h`)で使い方を表示し、何も実行しません。知らない名前には、コマンドの一覧を表示して終了コード 1 で終わります。
- コマンドは、出力を `say`(標準出力)と `complain`(標準エラー出力)で書き、パッケージのファイルの場所(`paths`)を受け取ります。テストは、出力を集め、書き出す先を一時フォルダーにして、コマンドを実行します(`src/scripts/commands/__tests__/`。テストごとに作るデータベースで実行します)。
- `db:introspect` は、drizzle-kit に一時フォルダーへ書かせ(`drizzle.config.ts` の `INTROSPECTION_DIRECTORY`)、正規化して、使わない import を除き(drizzle-kit は、使わなくても `sql` を import し、関係のないスキーマでは `relations` を import します)、Biome でリポジトリの設定のとおりに整形して(標準入力から)、`src/` に書きます。
