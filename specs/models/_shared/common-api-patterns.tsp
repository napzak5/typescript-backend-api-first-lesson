import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace BeautySalon.Models {
  @doc("エラーの本文。RFC 9457 (Problem Details for HTTP APIs) の形で、どのエラーもこのモデルで返す。")
  model ProblemDetails {
    @doc("エラーの種類を表す URN (`urn:beauty-salon:problem:not-found` など)。")
    type: string;

    @doc("エラーの種類を短く言う文。言語は、レスポンスの Content-Language ヘッダーのとおり。")
    title: string;

    @doc("レスポンスの HTTP ステータスコード。")
    status: int32;

    @doc("今回のエラーを説明する文。言語は、レスポンスの Content-Language ヘッダーのとおり。サーバー内部のエラー (500) など、説明を付けないエラーではnull")
    detail: string | null;

    @doc("リクエストの URL (パスとクエリ)。")
    instance: string | null;

    @doc("エラーの種類を表すコード。画面は、この値で分岐する。")
    code: ErrorCodeType;

    @doc("規則に合わなかった値の一覧。検証エラー (code が 2001) でない場合はnull")
    errors: ValidationError[] | null;

    @doc("リクエストの ID。レスポンスの X-Request-Id ヘッダーと同じ値で、サーバーのログと照合できる。")
    correlationId: string | null;

    @doc("エラーを返した日時 (UTC)。")
    timestamp: utcDateTime;
  }

  @doc("""
    エラーの文の言語区分 - エラーレスポンスの title、detail、errors[].message を書く言語
    
    en: 英語 - Accept-Language ヘッダーがない、または合う言語がないリクエストにも、この言語で答える
    ja: 日本語
    """)
  enum LanguageType {
    en,
    ja,
  }

  // エラーレスポンス。本体は ProblemDetails で、メディアタイプは RFC 9457 が定める application/problem+json。
  // TStatus には HTTP ステータスコードを指定する。
  // @doc を付けないのは、OpenAPI のレスポンスの説明をステータスコードごとの既定の文にするため。
  model ProblemResponse<TStatus> {
    @statusCode statusCode: TStatus;
    @header contentType: "application/problem+json";

    @doc("本体の文の言語。リクエストの Accept-Language ヘッダー (RFC 9110 12.5.4) に合う言語を選ぶ。")
    @header("Content-Language")
    contentLanguage: LanguageType;

    @body error: ProblemDetails;
  }

  @doc("""
    リクエスト数の上限を超えたときのエラーレスポンス (429)。
    クライアントは Retry-After ヘッダーの秒数だけ待ってから再試行する。
    """)
  model RateLimitedResponse {
    ...ProblemResponse<429>;

    @doc("再試行できるようになるまでの秒数。")
    @header("Retry-After")
    retryAfter: int32;
  }

  @doc("サーバー内部のエラー (500)。原因はレスポンスに含めず、correlationId でサーバーのログと照合する。")
  model InternalServerErrorResponse is ProblemResponse<500>;

  @doc("リクエスト本文が 100,000 バイトを超えている (413)。")
  model PayloadTooLargeResponse is ProblemResponse<413>;

  @doc("リクエスト本文が JSON ではない (415)。本文を送るリクエストの Content-Type は application/json にする。")
  model UnsupportedMediaTypeResponse is ProblemResponse<415>;

  @doc("""
    認証されていない (401)。アクセストークンがない、無効、または有効期限切れ。
    ログインとトークン再発行では、資格情報またはリフレッシュトークンが正しくない。
    WWW-Authenticate ヘッダーに Bearer のチャレンジを付ける (RFC 9110 15.5.2、RFC 6750 3)。
    """)
  model UnauthenticatedResponse {
    ...ProblemResponse<401>;

    @doc("Bearer のチャレンジ。アクセストークンが無効または期限切れの場合は error=\"invalid_token\" を含む。")
    @header("WWW-Authenticate")
    wwwAuthenticate: string;
  }

  @doc("認証されているが、この操作を行う権限がない (403)。")
  model PermissionDeniedResponse is ProblemResponse<403>;

  // 認証なしで呼べるオペレーション (@useAuth(NoAuth)) で返りうるエラー
  alias PublicErrors = RateLimitedResponse | InternalServerErrorResponse;

  // ログインしていれば誰でも呼べるオペレーションで返りうるエラー
  alias SessionErrors = UnauthenticatedResponse | PublicErrors;

  // ロールやサロンによる権限の確認があるオペレーションで返りうるエラー
  alias CommonErrors = PermissionDeniedResponse | SessionErrors;

  // リクエスト本文を受け取るオペレーションで返りうるエラー
  alias RequestBodyErrors =
    | PayloadTooLargeResponse
    | UnsupportedMediaTypeResponse;

  @doc("""
    エラーコードタイプ区分 - エラーの種類を表すコード。括弧の中は、そのコードを返すステータスコード
    
    // 認証・認可 (1xxx)
    1001: 認証必須 (401) - アクセストークンがない
    1002: 無効な資格情報 - ログインのメールアドレスかパスワードが正しくない (401)。共有リンクのパスワードがない、または正しくない (403)
    1003: トークン期限切れ (401) - アクセストークンの有効期限が切れている
    1004: トークン無効 (401) - アクセストークンかリフレッシュトークンが無効
    1005: 権限不足 (403) - 操作を行う権限がない
    1007: 2要素認証必須 (401) - ログインに 2 要素認証のコードが要る
    
    // バリデーション (2xxx)
    2001: 検証失敗 (400) - 値が規則に合わない。合わなかった値は errors にある
    2002: 不正な形式 - 本文を JSON として読めない、または URL を読めない (400)。本文が JSON ではない (415)
    2004: 範囲外の値 (413) - 本文が大きすぎる
    
    // ビジネスロジック (3xxx)
    3001: リソース未検出 (404) - 対象がない、または URL に合うオペレーションがない
    3002: リソース既存 (409) - 同じ値を持つものが、すでにある
    3003: 操作不可 (409) - 現在の状態では操作できない
    
    // システム (4xxx)
    4001: 内部サーバーエラー (500) - 予期しない失敗
    4003: データベースエラー (500) - データベースの失敗
    4004: 外部サービスエラー (500) - ファイルの保存先の失敗
    4005: レート制限超過 (429) - リクエスト数の上限を超えた
    """)
  enum ErrorCodeType {
    // 認証・認可 (1xxx)
    AUTHENTICATION_REQUIRED: "1001",

    INVALID_CREDENTIALS: "1002",
    TOKEN_EXPIRED: "1003",
    TOKEN_INVALID: "1004",
    INSUFFICIENT_PERMISSIONS: "1005",
    TWO_FACTOR_REQUIRED: "1007",

    // バリデーション (2xxx)
    VALIDATION_FAILED: "2001",

    INVALID_FORMAT: "2002",
    VALUE_OUT_OF_RANGE: "2004",

    // ビジネスロジック (3xxx)
    RESOURCE_NOT_FOUND: "3001",

    RESOURCE_ALREADY_EXISTS: "3002",
    OPERATION_NOT_ALLOWED: "3003",

    // システム (4xxx)
    INTERNAL_SERVER_ERROR: "4001",

    DATABASE_ERROR: "4003",
    EXTERNAL_SERVICE_ERROR: "4004",
    RATE_LIMIT_EXCEEDED: "4005",
  }

  @doc("規則に合わなかった値 1 件を表すモデル。")
  model ValidationError {
    @doc("値の場所。本文のプロパティは、キーと配列の番号をドットでつないだパス (`details.0.quantity`)。クエリとパスのパラメーターは、その名前。リクエスト全体についての違反では空文字。")
    field: string;

    @doc("合わなかった規則の名前 (`too_big`、`not_found` など)。画面は、field とこの値で分岐する。")
    rule: string;

    @doc("違反を説明する文。言語は、レスポンスの Content-Language ヘッダーのとおり。")
    message: string;

    @doc("常にnull")
    value: unknown | null;

    @doc("常にnull")
    constraint: unknown | null;
  }

  @doc("一覧の 1 ページを表すレスポンスモデル。")
  model CursorPaginationResponse<T> {
    @doc("このページの項目。")
    data: T[];

    @doc("ページの位置と件数。")
    meta: PaginationMeta;

    @doc("このページと、前後のページの URL。")
    links: PaginationLinks;
  }

  @doc("一覧のページの位置と件数を表すモデル。")
  model PaginationMeta {
    @doc("条件に合う項目の、全体の件数。")
    total: int32 | null;

    @doc("1 ページの件数の上限。リクエストの `limit` の値で、指定がなければ 20。")
    limit: int32;

    @doc("次のページがあればtrue。")
    hasMore: boolean;

    @doc("このページを読んだリクエストの `cursor` の値。最初のページの場合はnull")
    cursor: string | null;

    @doc("次のページを読むリクエストの `cursor` に書く値。最後のページの場合はnull")
    nextCursor: string | null;

    @doc("常にnull。一覧は先へだけ進む。")
    prevCursor: string | null;
  }

  @doc("一覧のページの URL を表すモデル。URL は、パスとクエリ。")
  model PaginationLinks {
    @doc("このページの URL。")
    self: string;

    @doc("最初のページの URL。")
    first: string | null;

    @doc("常にnull。一覧は先へだけ進む。")
    last: string | null;

    @doc("次のページの URL。最後のページの場合はnull")
    next: string | null;

    @doc("常にnull。一覧は先へだけ進む。")
    prev: string | null;
  }

  @doc("成功レスポンスの本文を表すモデル。")
  model ApiResponse<T> {
    @doc("オペレーションの結果。")
    data: T;

    @doc("リクエストの ID と、答えた日時。")
    meta: ResponseMeta | null;

    @doc("結果に関連する URL。`self` は、結果そのものの URL。URL のないオペレーションの場合はnull")
    links: Record<string> | null;
  }

  @doc("成功レスポンスが、どのリクエストにいつ答えたものかを表すモデル。")
  model ResponseMeta {
    @doc("リクエストの ID。レスポンスの X-Request-Id ヘッダーと同じ値で、サーバーのログと照合できる。")
    correlationId: string;

    @doc("答えた日時 (UTC)。")
    timestamp: utcDateTime;

    @doc("API の版 (`v1`)。")
    version: string;

    // その他のメタデータ
    ...Record<unknown>;
  }

  @doc("稼働の状態と、依存先ごとの確認の結果を表すモデル。")
  model HealthStatus {
    @doc("全体の状態。`healthy` は、どの依存先も応答した。`unhealthy` は、応答しない依存先がある。")
    status: "healthy" | "degraded" | "unhealthy";

    @doc("API の版 (`v1`)。")
    version: string;

    @doc("確認した日時 (UTC)。")
    timestamp: utcDateTime;

    @doc("依存先ごとの確認の結果。")
    checks: HealthCheck[];

    @doc("常にnull")
    metadata: Record<unknown> | null;
  }

  @doc("リクエストを処理できる状態かどうかを表すモデル。")
  model SystemReadyResponse {
    @doc("リクエストを処理できる状態であればtrue。")
    ready: boolean;

    @doc("応答しない依存先の名前 (`database`)。リクエストを処理できる場合はnull")
    reason: string | null;
  }

  @doc("依存先 1 つの確認の結果を表すモデル。")
  model HealthCheck {
    @doc("依存先の名前 (`database`)。")
    name: string;

    @doc("依存先の状態。`up` は応答した、`down` は応答しなかった。")
    status: "up" | "down" | "degraded";

    @doc("応答を待った時間 (ミリ秒)。")
    responseTime: int32 | null;

    @doc("応答しなかったことの説明。応答した場合はnull")
    error: string | null;

    @doc("常にnull")
    details: Record<unknown> | null;
  }
}
