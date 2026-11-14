# 認証と認可

API の利用者をどう特定し、何を許可するかをまとめます。コントラクトは `specs/operations/auth-operations.tsp`、実装は各層の `auth` 以下にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| `POST /api/v1/auth/login`、`/refresh`、`/logout`、`/logout-all`、`GET /api/v1/auth/me` | 実装済み |
| ユーザー登録、メールアドレスの確認、パスワードの再設定・変更 | 未実装（コントラクトのみ） |
| 2 要素認証 | 未実装（コントラクトのみ）。2 要素認証が有効なアカウントはログインできない |
| セッションの一覧・無効化、管理者の操作（`/api/v1/admin/auth`） | 未実装（コントラクトのみ） |

ユーザーを作成する API がまだないので、ユーザーはシード（`pnpm db:seed`）か SQL で作ります。

## セッション

セッションはサーバー側（`sessions` テーブル）に持ちます。JWT は使いません。

| 項目 | 決まり |
|---|---|
| トークン | アクセストークンとリフレッシュトークン。どちらも CSPRNG で生成した 256 ビットを base64url にした不透明な文字列で、クライアントは内容を解釈しない |
| 保存 | DB にはトークンの SHA-256 ハッシュだけを保存する（`tokenHash`、`refreshTokenHash`）。DB を読まれてもトークンは使えない |
| アクセストークンの有効期間 | 15 分（`expiresAt`）。セッションの終了が先に来る場合はそこまで |
| セッションの終了 | ログインから 8 時間後、`rememberMe: true` なら 30 日後（`refreshExpiresAt`）。トークンを再発行しても延びない |
| 再発行 | 両方のトークンを置き換える。使ったリフレッシュトークンと、それまでのアクセストークンは使えなくなる。同じリフレッシュトークンで同時に 2 回要求しても、成功するのは 1 回 |
| ログアウト | セッションの行を削除する。終了したセッションの行は、そのユーザーが次にログインしたときに削除する |
| `lastActivityAt` | 最後にトークンを発行した（ログインまたは再発行した）日時。リクエストごとには更新しない |

根拠: セッション ID のエントロピーと、検証用の値だけを保存することは OWASP Session Management Cheat Sheet。不透明なトークンは長くランダムなので、保存に必要なのは SHA-256 で、パスワード用のハッシュは要りません。

## パスワード

- Argon2id、メモリ 19 MiB（19456 KiB）・反復 2・並列度 1（OWASP Password Storage Cheat Sheet の最小構成）。Node.js 組み込みの `crypto.argon2` を使う（`backend/packages/infrastructure/src/security/argon2-password-hasher.ts`）
- 保存形式は PHC 文字列（`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`）。ハッシュがパラメーターを持つので、構成を強くしたあとも古いハッシュは検証でき、次にログインに成功した時点で新しい構成のハッシュに置き換わる
- Argon2id の PHC 文字列でない値（以前のシードにあった bcrypt など）は、どのパスワードとも一致しない

## ログイン

- 失敗は原因を区別せず、同じ 401（コード `1002`）を返す。未登録のメールアドレス、パスワードの誤り、ロック中、メールアドレス未確認、停止中、2 要素認証が有効、のどれでも同じ
- 未登録のメールアドレスでもパスワードのハッシュを 1 回計算し、応答時間で登録の有無が分からないようにする
- メールアドレスは小文字で保存し、小文字にそろえて照合する
- パスワードを連続して 5 回誤ると、アカウントを 15 分ロックする（`status = locked`、`lockedUntil`）。ロック中の試行は数えず、正しいパスワードでも失敗する。ロックが明けたあとは、誤るたびに 15 分ロックする。成功すると失敗回数は 0 に戻り、`status` は `active` に戻る。回数の加算は 1 つの UPDATE で行うので、並行した試行も数え漏らさない
- ロックは新しいログインだけを止める。すでにあるセッションは使い続けられる（他人の失敗でログイン中の利用者を締め出さないため）
- ログインと既存のセッションの利用ができるのは、`status` が `active` または `locked`（ロックは上のとおり新しいログインだけを止める）で、削除されていない（`deletedAt` が NULL の）ユーザーだけ。`unverified`、`inactive`、`suspended`、`deleted` のユーザーは、どちらもできない

## リクエストの認証

`Authorization: Bearer <アクセストークン>` を検証します（RFC 6750 2.1）。

| 状況 | ステータス | コード | `WWW-Authenticate` |
|---|---|---|---|
| ヘッダーがない、Bearer 以外のスキーム | 401 | `1001` | `Bearer realm="beauty-salon-api"` |
| トークンに対応するセッションがない、ユーザーが利用できない | 401 | `1004` | `Bearer realm="beauty-salon-api", error="invalid_token"` |
| アクセストークンの有効期限切れ（リフレッシュトークンで再発行できる） | 401 | `1003` | 同上 |
| 認証されているが権限がない | 403 | `1005` | なし |

401 には必ず `WWW-Authenticate` を付けます（RFC 9110 15.5.2）。`/api/v1/auth` 以下のレスポンスには `Cache-Control: no-store` を付けます。

## 認可

認可は**ユースケースで判定**します。HTTP 層はトークンから操作者（`Actor`）を特定してユースケースに渡すだけで、ロールの判定はしません。

操作者の範囲（`ActorScope`）は、`users.role` と、ユーザーに紐づくレコードから決まります。

| 範囲 | 対象 | 届くもの |
|---|---|---|
| `platform` | `admin` | すべてのサロン |
| `salon` | `owner`、`manager`、`staff`。`users.staffId` が指すスタッフが有効（`isActive`、未削除）で、そのサロンが未削除であること | そのサロン。範囲はロール・サロン ID・スタッフ ID を持つ |
| `customer` | `customer`。`users.customerId` があること | 自分の顧客情報 |
| `none` | 上のどれにも当たらない（スタッフ情報が削除された `staff` など） | 範囲を必要とするものには届かない。ログインはできる |

- ロールは `users.role` の固定 5 種。`users.permissions` は保存しているだけで、判定には使わない
- 1 人のユーザーが属するサロンは 1 つ（`users.staffId` が 1 つのため）

### Salon API の権限

| オペレーション | 許可 |
|---|---|
| 一覧、1 件の取得 | 認証なし（予約前に閲覧できるようにする） |
| 作成 | `admin` |
| 更新 | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `admin`、そのサロンの `owner` |

権限は、リクエストの本文を検証する前、対象を検索する前に判定します。ほかのサロンの `owner` が更新しようとすると、そのサロンが存在しなくても 403 です（サロンは公開情報なので、存在を隠す必要がない）。

## 新しいオペレーションを保護する

1. TypeSpec のエラーを、呼び出し方に合うエイリアスにする: 認証なしは `@useAuth(NoAuth)` と `PublicErrors`、ログインしていれば誰でも呼べるものは `SessionErrors`、権限の確認があるものは `CommonErrors`
2. ユースケースの `execute` の第 1 引数に `actor: Actor` を取り、最初に権限を判定して `DomainErrors.forbidden()` を返す。判定は `business-logic/<domain>/_shared/authorization.ts` に純粋な関数として置く（例: `business-logic/salon/_shared/authorization.ts`）
3. ハンドラーを `authenticated(...)` で包む（`backend/packages/api/src/shared/authentication.ts`）。包まれたハンドラーだけが `actor` を受け取るので、認証を付け忘れたハンドラーは権限を判定するユースケースを呼べない

```typescript
export const updateSalonHandler = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<{ id: string }, UpdateSalonResponse | ProblemDetails, unknown> => {
  const useCase = new UpdateSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)
    // match(result) ...
  })
}
```

サロンに属するデータ（顧客、予約、スタッフなど）を実装するときは、操作者のサロンと対象のサロンを必ず比べます。ほかのサロンのデータは、存在を知らせないよう 404 にします（公開情報であるサロンそのものだけが 403）。

## シードのアカウント

`pnpm db:seed` は、次のアカウントを同じパスワードで作ります。パスワードは `backend/packages/database/src/seeds/seed-data/users.ts` の `SEED_PASSWORD` です。公開されているパスワードなので、`pnpm db:seed` は本番環境（`NODE_ENV=production`）では実行を拒否します。

| メールアドレス | ロール | 範囲 |
|---|---|---|
| `admin@beautysalon.jp` | `admin` | すべてのサロン |
| `owner@beautysalon.jp` | `owner` | 1 つ目のサロン |
| `manager@beautysalon.jp` | `manager` | 1 つ目のサロン |
| `stylist1@beautysalon.jp`、`stylist2@beautysalon.jp` | `staff` | 1 つ目のサロン |
| `therapist@beautysalon.jp` | `staff` | 2 つ目のサロン |
| `customer1@example.com` 〜 `customer3@example.com`、`vip.customer@example.com` | `customer` | 自分の顧客情報 |

```bash
curl -s http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@beautysalon.jp","password":"<SEED_PASSWORD>","rememberMe":false,"twoFactorCode":null}'
```

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/auth.tsp`、`specs/operations/auth-operations.tsp`、`specs/models/_shared/common-api-patterns.tsp`（`UnauthenticatedResponse`、`PermissionDeniedResponse`、エラーのエイリアス） |
| ドメイン | `backend/packages/domain/src/models/auth.ts`（`Actor`）、`business-logic/auth/`、`repositories/{user,session}.repository.ts`、`services/` |
| インフラ | `backend/packages/infrastructure/src/security/`、`repositories/{user,session}.repository.impl.ts` |
| API | `backend/packages/api/src/shared/authentication.ts`、`routes/auth/` |
