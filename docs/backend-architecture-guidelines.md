# TypeScriptバックエンドアーキテクチャガイドライン

この文書は、バックエンドのコードを**各レイヤーでどう書くか**をまとめたものです。参照実装は Salon ドメインで、掲載しているコードはすべて実ファイルからの抜粋です（コメントだけ日本語にしています）。

ほかの文書との分担は次のとおりです。

- [アーキテクチャ概要](./architecture-overview.md): システム全体の説明。パッケージの依存関係、型生成の流れ、リクエストの流れ、実装済みの範囲はそちらにあり、本書では繰り返しません。
- [CLAUDE.md](../CLAUDE.md): 規約とコマンドの正本。Salon ドメインの全レイヤーのシグネチャもそこにまとまっています。本書は規約の適用のしかたと理由を説明します。

バックエンドで実装済みなのは Salon ドメインとシステムエンドポイントだけです。ほかのドメインを実装するときは、Salon のファイルと同じ構成で書いてください。

---

## 依存ルールと禁止事項

アプリケーションコード（`backend/packages` の `api`・`domain`・`infrastructure`・`config`・`utility` と `backend/apps/server`）では、次を守ります。

| ルール | 代わりにどうするか |
|--------|--------------------|
| `any`、型アサーション（`as`）、型ガードを書かない | 外から来た値は Zod スキーマで検証し、分岐は ts-pattern か `type` プロパティの比較で絞り込む |
| `throw` しない | 失敗は `Result<T, E>` で返す |
| `try`/`catch` を新たに書かない | アプリケーションコードの `try`/`catch` は `Result.fromPromise`（`backend/packages/utility/src/result/result.ts`）の1か所だけ。外部ライブラリが投げる例外は、Promise をこれに渡して `Result` に変える。ハンドラーにも書かない（Express 5 は reject された Promise をエラーハンドラーに渡す） |
| `process.env` を読まない | 設定は `parseAppConfig` が一度だけ読み、値として引数で渡す |
| `console` を使わない | リクエスト中は `req.log`、それ以外は注入された `Logger` を使う |
| グローバルを経由して依存を取り出さない | リポジトリなどの依存は起動時に一度作り、引数で渡す |

依存の向きは次のとおりです。

- `domain` は I/O を行うパッケージを import しません。`database` から import するのは型だけです。
- `infrastructure` は `domain` が宣言したリポジトリインターフェースを実装します。
- `api` はユースケースを呼び出し、結果を HTTP に変換するだけです。
- 環境変数を読み、プロセスを終了させるのは `backend/apps/server/src/index.ts` だけです。

データベースのスクリプト（`backend/packages/database/src/scripts`）、シード、テストはサーバーが実行するコードではないので、`throw` や `console` を使ってかまいません。

---

## ディレクトリ構造

種類ごとのディレクトリの下に、ドメインごとのファイルを置きます。`<domain>` は `salon` のようなドメイン名です。

| 書くもの | 置き場所 | Salon の実ファイル |
|----------|----------|--------------------|
| 型（ID・API 型・DB 型） | `domain/src/models/<domain>.ts` | `backend/packages/domain/src/models/salon.ts` |
| リクエストの検証スキーマ | `domain/src/schemas/<domain>.schema.ts` | `backend/packages/domain/src/schemas/salon.schema.ts` |
| API → DB の変換 | `domain/src/mappers/write/<domain>.mapper.ts` | `backend/packages/domain/src/mappers/write/salon.mapper.ts` |
| DB → API の変換 | `domain/src/mappers/read/<domain>.mapper.ts` | `backend/packages/domain/src/mappers/read/salon.mapper.ts` |
| リポジトリのインターフェース | `domain/src/repositories/<domain>.repository.ts` | `backend/packages/domain/src/repositories/salon.repository.ts` |
| ユースケース（1操作1ファイル） | `domain/src/business-logic/<domain>/<action>-<domain>.usecase.ts` | `backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts` ほか4つ |
| ユースケースの依存 | `domain/src/business-logic/<domain>/_shared/dependencies.ts` | `backend/packages/domain/src/business-logic/salon/_shared/dependencies.ts` |
| リポジトリの実装 | `infrastructure/src/repositories/<domain>.repository.impl.ts` | `backend/packages/infrastructure/src/repositories/salon.repository.impl.ts` |
| ハンドラー（1操作1ファイル） | `api/src/routes/<domain>/<action>-<domain>.handler.ts` | `backend/packages/api/src/routes/salon/create-salon.handler.ts` ほか4つ |
| ルーター | `api/src/routes/<domain>/index.ts` | `backend/packages/api/src/routes/salon/index.ts` |
| ルート固有の補助（リンク、クエリの変換、レスポンス型） | `api/src/routes/<domain>/_shared/` | `backend/packages/api/src/routes/salon/_shared` |

ドメインをまたいで使うものは次の場所にあります。

- `backend/packages/domain/src/shared`: `DomainError`、`DomainErrors`、`parseWith`
- `backend/packages/api/src/shared`: `sendProblem`、`responseMeta`、`toProblemDetails`、API バージョン
- `backend/packages/api/src/middleware`: リクエストログ、レート制限、エラーハンドラー
- `backend/packages/utility/src`: `Result`（`success`・`error`・`map`・`mapError`・`flatMap`・`fromPromise`）、`DeepRequired`、`Omit`

`domain` パッケージが外に公開するのは、ユースケース、モデル、リポジトリインターフェース、エラーと検証の共通部品です（`backend/packages/domain/src/index.ts`）。リクエストのスキーマとマッパーはパッケージの中だけで使います。

---

## 実装パターン

下のレイヤーから順に説明します。新しいドメインもこの順で書きます。

### 1. モデル: 型は宣言せず、導出する

```typescript
// backend/packages/domain/src/models/salon.ts（抜粋）
export const salonIdSchema = z.uuid().brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

// API 型: TypeSpec から生成された型
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']

// DB 型: Drizzle スキーマから推論
export type DbSalon = DeepRequired<typeof salons.$inferSelect>

type SalonManagedColumn =
  | 'id'
  | 'rating'
  | 'reviewCount'
  | 'cancellationPolicy'
  | 'bookingPolicy'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewSalon = DeepRequired<
  Omit<typeof salons.$inferInsert, SalonManagedColumn>
>
export type DbSalonChanges = Partial<DbNewSalon>
```

- 型を手で宣言しません。DB 型は Drizzle スキーマから `DeepRequired` で推論し、API 型は生成型から取り出します。テーブルや API 契約が変わると、マッパーが型エラーになって気づけます。
- ID は Zod のブランド付き UUID です。`salonIdSchema` で検証した値だけが `SalonId` になるので、未検証の文字列をリポジトリに渡せません。パスパラメータは `parseSalonId` で検証します。
- リクエストから書き込まない列（DB が採番する列、ほかの機能が更新する列、API に公開していない列）は `SalonManagedColumn` のようにまとめて除外します。同じ列を `backend/packages/database/src/scripts/api-consistency-rules.ts` の `omittedColumns` にも書きます。
- 取りうる状態が複数ある値は Sum 型にします。たとえば更新時の営業日カレンダーは `{ type: 'keep' } | { type: 'replace'; openingHours: DbNewOpeningHours[] }`（`OpeningHoursChange`）です。

型の導出について詳しくは [DB駆動ドメインモデル](./db-driven-domain-model.md) を参照してください。

### 2. バリデーションスキーマ: リクエスト1つにスキーマ1つ

```typescript
// backend/packages/domain/src/schemas/salon.schema.ts（抜粋）
export const salonUpdateRequestSchema = salonCreateRequestSchema
  .exactPartial()
  .check((context) => {
    // 未知のプロパティはそのエラーとして報告し、「空のリクエスト」とは報告しない
    if (
      context.issues.length === 0 &&
      Object.keys(context.value).length === 0
    ) {
      context.issues.push({
        code: 'custom',
        path: [],
        message: 'At least one property must be specified',
        input: context.value,
      })
    }
  }) satisfies z.ZodType<ApiSalonUpdateRequest>
```

- スキーマの末尾に `satisfies z.ZodType<生成された API 型>` を付けます。スキーマと API 契約がずれるとコンパイルエラーになります。
- オブジェクトは `z.strictObject` で定義し、未知のプロパティを拒否します。
- 文字数の上限は DB の列の長さに、`.nullable()` は DB の NULL 許可に合わせます。
- Create は全プロパティ必須です（値は `null` でもよい）。Update は Create のスキーマに `.exactPartial()` を付けて全プロパティを省略可能にします。Search の絞り込み条件は `.exactOptional()` で省略可能にします。
- 複数の項目にまたがるルールは `.check()` に書き、`context.issues.push` で項目のパスを付けて報告します。
- スキーマが扱うのは、入力だけで判定できるルールです。DB を見ないと分からないこと（メールアドレスの重複）は、一意制約に任せてリポジトリが報告します。

検証は `parseWith` で実行します。破られたルールはすべて `ValidationIssue`（`field`・`rule`・`message`）になり、`validation` エラーとして返ります。

```typescript
// backend/packages/domain/src/shared/validation.ts（シグネチャ）
export const parseWith = <T>(
  schema: z.ZodType<T>,
  input: unknown,
  message: string,
): Result<T, DomainError>
```

### 3. マッパー: プロパティ名は変えず、表現だけを変える

```typescript
// backend/packages/domain/src/mappers/write/salon.mapper.ts（抜粋）
const toNumeric = (value: number): string => String(value)

export const SalonWriteMapper = {
  fromCreateRequest(request: ApiSalonCreateRequest): {
    salon: DbNewSalon
    openingHours: DbNewOpeningHours[]
  } {
    const { openingHours, latitude, longitude, taxRate, ...columns } = request

    return {
      salon: {
        ...columns,
        latitude: latitude === null ? null : toNumeric(latitude),
        longitude: longitude === null ? null : toNumeric(longitude),
        taxRate: toNumeric(taxRate),
      },
      openingHours: toDbOpeningHours(openingHours),
    }
  },
}
```

```typescript
// backend/packages/domain/src/mappers/read/salon.mapper.ts（抜粋）
const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: z.array(storedBusinessHoursSchema).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiSalon = (
  salon: DbSalon,
  openingHours: DbOpeningHours[],
): Result<ApiSalonResponse, DomainError> => {
  const { deletedAt, cancellationPolicy, bookingPolicy, ...columns } = salon

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
      (converted) => ({
        ...columns,
        ...converted,
        openingHours: openingHours.map(toApiOpeningHours),
      }),
    ),
    // リクエストは正しい。壊れているのは保存されている行のほう
    (error) =>
      DomainErrors.database(
        `Stored salon ${salon.id} does not match the API model`,
        error,
      ),
  )
}
```

- API のプロパティ名は DB の列名と同じなので、大半の項目はスプレッドでそのまま渡ります。マッパーで名前を付け替えません。
- 変換するのは表現だけです。`numeric` 列はドライバーが文字列で読み書きするので number と相互に変換し、`timestamptz` は ISO 8601 に直し、`jsonb` は API モデルのスキーマで検査します。
- `null` を空文字や既定値に置き換えません。
- Read マッパーは `Result` を返します。保存されているデータが API モデルに合わない場合は、クライアントの誤りではないので `validation` ではなく `database` エラーにします。
- Update では、リクエストに存在するプロパティだけを変更にします（`fromUpdateRequest`）。プロパティがなければその列に触れず、`null` なら列を NULL にします。

### 4. リポジトリインターフェース: DB 型と Result で宣言する

インターフェースの全体は `backend/packages/domain/src/repositories/salon.repository.ts` と [CLAUDE.md](../CLAUDE.md) にあります。書くときの決まりは次のとおりです。

- 引数と戻り値は DB 型（`DbNewSalon`、`SalonWithOpeningHours` など）です。API 型は使いません。
- すべてのメソッドが `Promise<Result<T, DomainError>>` を返します。
- 「見つからない」はエラーにせず、`null`（`findById`・`update`）や `false`（`delete`）で返します。それを `notFound` にするのはユースケースです。
- 一覧の条件は `SalonListCriteria` のように専用の型で受け取り、「`null` は絞り込まない」ことを型で表します。
- 論理削除された行（`deletedAt`）は、どのメソッドからも見えません。書き込みは原子的で、サロンと営業日カレンダーは同時に変わるか、どちらも変わりません。

### 5. ユースケース: 検証して、変換して、保存する

```typescript
// backend/packages/domain/src/business-logic/salon/get-salon.usecase.ts
export class GetSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  async execute(id: unknown): Promise<Result<ApiSalonResponse, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
    }

    const found = await this.dependencies.salonRepository.findById(salonId.data)
    if (found.type === 'error') {
      return found
    }
    if (found.data === null) {
      return Result.error(DomainErrors.notFound('Salon', salonId.data))
    }

    return SalonReadMapper.toApiSalon(found.data.salon, found.data.openingHours)
  }
}
```

- 1操作につき1クラスです。基底クラスは作りません。依存は `SalonUseCaseDependencies` のオブジェクト1つをコンストラクタで受け取ります。引数の順序に依存せず、テストで1つだけ差し替えられます。
- `execute` の入力は `unknown` です。検証はここで一度だけ行います（本文は `parseWith`、ID は `parseSalonId`）。
- 書き込みの手順は「検証 → API から DB への変換 → 保存 → DB から API への変換」です（`create-salon.usecase.ts`）。
- 失敗した `Result` は `result.type === 'error'` で絞り込み、そのまま返します。
- 戻り値は API モデルか `DomainError` です。HTTP ステータスはユースケースでは決めません。
- 一意制約で検出できる重複を、事前の検索で確かめません。リポジトリが `alreadyExists` を返します。

### 6. リポジトリの実装: 例外を Result に変える

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts（抜粋）
const attempt = async <T>(
  message: string,
  email: string | null,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, email),
  )

const notDeleted = isNull(salons.deletedAt)

export class SalonRepository implements ISalonRepository {
  constructor(private readonly db: Database) {}

  async findById(
    id: SalonId,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>> {
    return attempt('Failed to find salon', null, async () => {
      const [salon] = await this.db
        .select()
        .from(salons)
        .where(and(eq(salons.id, id), notDeleted))
        .limit(1)

      return salon === undefined ? null : withOpeningHours(this.db, salon)
    })
  }
}
```

- クエリは `attempt` で包みます。ドライバーが投げた例外は `Result.fromPromise` が `Result` に変え、`toDomainError` が `DomainError` に変えます。リポジトリ自身は `try`/`catch` を書きません。
- 想定している失敗だけを個別のエラーにします。Salon では `email` の一意制約違反が `alreadyExists` になり、それ以外はすべて `database` です。
- `database` エラーの `cause` には `describeDatabaseError`（`backend/packages/infrastructure/src/database/failure.ts`）の結果を入れます。SQL 文と SQLSTATE は残し、バインドされた値は残しません。顧客のデータがログに出ないようにするためです。
- 複数のテーブルに書き込むときは `this.db.transaction` を使います（`create`・`update`）。
- 配列の先頭は `const [row] = ...` で取り出し、`row === undefined` を確認します。
- 一覧はキーセットページネーションです。`(createdAt, id)` の降順に並べ、`limit + 1` 件を取得して次のページがあるかを判定します。
- 削除は論理削除です。`deletedAt` を設定し、すべてのクエリに `notDeleted` の条件を付けます。

### 7. ハンドラーとルーター: 依存を受け取り、結果を HTTP に変換する

```typescript
// backend/packages/api/src/routes/salon/get-salon.handler.ts
export const getSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<{ id: string }, GetSalonResponse | ProblemDetails> => {
  const useCase = new GetSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: salonLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
```

- ハンドラーは、依存を受け取って `RequestHandler` を返す関数です。ユースケースは最初に一度だけ生成します。
- `RequestHandler` の型引数で、パスパラメータとレスポンス本文の型を決めます。レスポンスの型は `_shared/types.ts` で生成型の `operations` から取り出します。リクエスト本文の型は `unknown` です。
- ハンドラーは検証しません。`req.body` と `req.params.id` をそのままユースケースに渡します。
- クエリ文字列だけは例外です。文字列しか運べないので、一覧のハンドラーは `decodeSalonSearchQuery`（`_shared/query.ts`）で数値・真偽値・配列に直してから渡します。値のルールを判定するのはユースケースです。
- 結果は `match(result)…exhaustive()` で分岐します。成功は `{ data, meta: responseMeta(req), links }`、失敗は必ず `sendProblem(req, res, error)` です。ハンドラーでステータスコードとエラーの対応を書きません。
- リンクは `req.baseUrl` から組み立てます。マウント先のパスをハンドラーに書きません。
- ルーターは `createSalonRouter(dependencies)` のように依存を受け取り、各ハンドラーに渡します。

ファイルの分け方について詳しくは [API Route Modular Structure](./api-route-modular-structure.md) を参照してください。

### 8. アプリケーションへの組み込み

```typescript
// backend/packages/api/src/index.ts（抜粋）
app.use(
  `${API_BASE_PATH}/salons`,
  createSalonRouter({ salonRepository: new SalonRepository(database) }),
)
```

- リポジトリは `createApp` の中で一度だけ生成し、ルーターに渡します。
- 新しいルーターは `express.json` の後、`notFoundHandler` の前にマウントします。ミドルウェアの順序とその理由は [アーキテクチャ概要](./architecture-overview.md) にあります。
- `api` パッケージは `config` に依存しません。新しい設定値が必要なときは `AppSettings`（`backend/packages/api/src/settings.ts`）に追加し、`backend/apps/server/src/server.ts` の `startServer` で `AppConfig` から渡します。

---

## エラー処理

- ユースケースが返すエラーは `DomainError` の4種類（`validation`・`notFound`・`alreadyExists`・`database`）です。`DomainErrors.*` で作ります（`backend/packages/domain/src/shared/errors.ts`）。
- ユースケースの外で起きる失敗（存在しないルート、読めない本文、レート制限、想定外の例外）は API 層の `HttpError` です。
- どちらも `sendProblem` を通り、RFC 9457 の problem details になります。エラーの種類と HTTP ステータス・エラーコードの対応は、`backend/packages/api/src/shared/problem-details.ts` の `toProblemDetails` の1か所にあります。
- `database` エラーの `cause` と想定外の例外の内容は、レスポンスに含めません。ログに記録します。

エラーの種類を増やすときは、`DomainError`（または `HttpError`）に追加し、`problem-details.ts` の `match` に分岐を足します。`exhaustive()` なので、足し忘れるとコンパイルエラーになります。

---

## ロギング

- リクエストの処理中は `req.log` を使います。リクエスト ID が自動的に付きます。それ以外の場所では、引数で受け取った `Logger` を使います。
- リクエスト ID（`req.id`）は自分で作りません。レスポンスへの記載は `responseMeta(req)` と `sendProblem` が行います。
- 値は文字列に連結せず、オブジェクトで渡します。

  ```typescript
  // backend/packages/api/src/shared/responses.ts（抜粋）
  if (error.type === 'database') {
    req.log.error({ cause: error.cause }, error.message)
  }
  ```

- ヘッダー、リクエスト本文、SQL にバインドされた値はログに出しません。認証情報や顧客の個人情報が含まれるためです。

---

## 設定

- 環境変数は `parseAppConfig`（`backend/packages/config/src/app-config.ts`）が起動時に一度だけ検証し、`AppConfig` として返します。不足や形式の誤りがあれば、サーバーは起動しません。
- 変数を追加するときは、`app-config.ts` のスキーマと `AppConfig` に追加し、すべての `.env.*` ファイルと [README](../README.md) の変数表にも追加します。

---

## テスト戦略

| 対象 | 種類 | 場所 |
|------|------|------|
| スキーマ、マッパー、ユースケース | ユニット（`pnpm test`） | `backend/packages/domain/src/__tests__` |
| クエリの変換、リンク、problem details、ミドルウェア | ユニット（`pnpm test`） | `backend/packages/api/src` の各 `__tests__` |
| エンドポイント（リポジトリの実装を含む） | 統合（`pnpm test:integration`） | `backend/packages/api/src/__tests__/salon.integration.test.ts` |
| リクエスト ID、エラー応答、CORS、レート制限、プローブ | 統合（`pnpm test:integration`） | `backend/packages/api/src/__tests__/app.integration.test.ts` |
| 起動と停止 | 統合（`pnpm test:integration`） | `backend/apps/server/src/__tests__/server.integration.test.ts` |

- ユースケースのテストでは、リポジトリを `ISalonRepository` を満たすオブジェクトに差し替えます。DB は使いません。
- リポジトリの実装は、エンドポイントの統合テストで実際の PostgreSQL に対して検証します。テストごとに専用のスキーマを作り、本番と同じ `createApp` を使います（`backend/packages/api/src/__tests__/_shared/test-helpers.ts` の `createTestApp`）。
- エンドポイントごとに、エラーのシナリオを5つ以上テストします。

詳しくは [Testing Requirements](./testing-requirements.md) と [API Testing Guide](./api-testing-guide.md) を参照してください。

---

## 新しいドメインを実装する手順

1. **API 契約**: `specs/models/<domain>.tsp` と `specs/operations/<domain>-operations.tsp` を確認し、必要なら直して `pnpm generate` を実行します。モデル名や nullable の決まりは [TypeSpec API型定義ルール](./typespec-api-type-rules.md) にあります。
2. **データベース**: テーブルを変える必要があれば SQL マイグレーションを書き、`pnpm db:migrate`、`pnpm db:introspect`、`pnpm db:generate-sql` の順に実行します。
3. **API と DB の整合**: `backend/packages/database/src/scripts/api-consistency-rules.ts` にモデルを `omittedColumns` 付きで登録し、`backend/packages/database/api-consistency-baseline.json` からそのドメインの項目がなくなるまで、API か DB を直します。差分を直したら `pnpm check:api-db --update-baseline` でベースラインを更新します。
4. **domain**: モデル、スキーマ、マッパー、リポジトリインターフェース、ユースケースの順に書き、ユニットテストを付けます。公開するものを `backend/packages/domain/src/index.ts` に追加します。
5. **infrastructure**: リポジトリを実装し、`backend/packages/infrastructure/src/index.ts` から公開します。
6. **api**: ハンドラーとルーターを書き、`createApp` にマウントして、統合テストを付けます。
7. **確認**: `make ci-check` を実行します。

各ステップの詳しい説明は [Domain Implementation Reference](./domain-implementation-reference.md) にあります。

---

## 実装チェックリスト

- [ ] TypeSpec を変更したら `pnpm generate` を実行し、生成ファイルを一緒にコミットした
- [ ] 型を手で宣言していない（DB 型は Drizzle スキーマから、API 型は生成型から取っている）
- [ ] スキーマに `satisfies z.ZodType<…>` を付け、検証はユースケースで一度だけ行っている
- [ ] ハンドラーは本文を `unknown` のままユースケースに渡している
- [ ] マッパーでプロパティ名を変えていない。`null` を別の値に置き換えていない
- [ ] 失敗はすべて `Result` で返している。`throw`、`any`、`as` がなく、`try`/`catch` を新たに書いていない（外部の例外は `Result.fromPromise` で受けている）
- [ ] `match(...).exhaustive()` で分岐している
- [ ] エラー応答は `sendProblem` だけが返している
- [ ] `console` と `process.env` を使っていない
- [ ] 複数テーブルへの書き込みはトランザクションで行っている
- [ ] 論理削除された行が、どのクエリからも見えない
- [ ] ユニットテストと、エンドポイントごとに5つ以上のエラーシナリオを含む統合テストがある

---

## 参考資料

- [`CLAUDE.md`](../CLAUDE.md) - 規約、コマンド、Salon ドメインの全レイヤー
- [`docs/architecture-overview.md`](./architecture-overview.md) - システム全体の構成
- [`docs/domain-implementation-reference.md`](./domain-implementation-reference.md) - ドメイン実装リファレンス
- [`docs/api-route-modular-structure.md`](./api-route-modular-structure.md) - ルートのファイル構成
- [`docs/uniform-implementation-guide.md`](./uniform-implementation-guide.md) - 統一実装パターン
- [`docs/db-driven-domain-model.md`](./db-driven-domain-model.md) - DB駆動ドメインモデル
- [`docs/sum-types-pattern-matching.md`](./sum-types-pattern-matching.md) - Sum型とパターンマッチング
- [`docs/type-safety-principles.md`](./type-safety-principles.md) - 型安全性の原則
- [`docs/type-generation-system.md`](./type-generation-system.md) - 型生成システム
- [`docs/testing-requirements.md`](./testing-requirements.md) - テスト要件
