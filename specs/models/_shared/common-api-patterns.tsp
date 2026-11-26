import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace BeautySalon.Models {
  @doc("""
    RFC 9457 (Problem Details for HTTP APIs) に準拠した標準エラーレスポンスモデル。
    美容サロン予約システム全体で一貫したエラー情報を提供し、顧客・スタッフ双方の操作ログと連携する。
    """)
  model ProblemDetails {
    @doc("エラー種別を特定するための URI。参照することで関連ドキュメントに誘導できる。")
    type: string;

    @doc("ユーザーに短く要点を伝えるエラー概要メッセージ。言語は、レスポンスの Content-Language ヘッダーのとおり。")
    title: string;

    @doc("レスポンスに付与される HTTP ステータスコード。")
    status: int32;

    @doc("今回の発生状況に固有の詳細説明。サポート対応時の一次情報となる。言語は、レスポンスの Content-Language ヘッダーのとおり。詳細が不要な場合はnull")
    detail: string | null;

    @doc("この事象を一意に識別するための URI。監査ログやダッシュボードと連携する。URIが不要な場合はnull")
    instance: string | null;

    @doc("システム全体で共有する機械判読可能なエラーコード。画面表示や分岐処理に使用する。")
    code: ErrorCodeType;

    @doc("フィールド単位の検証エラーなど、追加のエラー詳細情報一覧。検証エラーがない場合はnull")
    errors: ValidationError[] | null;

    @doc("障害調査や問い合わせで利用する相関 ID。リクエスト単位で一意。相関IDが不要な場合はnull")
    correlationId: string | null;

    @doc("エラー発生日時 (UTC)。サーバーログの検索キーとして使用する。")
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

  @doc("リクエスト本文がサイズ上限を超えている (413)。")
  model PayloadTooLargeResponse is ProblemResponse<413>;

  @doc("リクエスト本文が、オペレーションの受け付ける形式ではない (415)。JSON を受け取るオペレーションでは UTF-8 の JSON、ファイルのアップロードでは multipart/form-data だけを受け付ける。")
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

  @doc("""
    入力検証での失敗内容を表すモデル。
    画面入力フォームやAPI連携時のフィールド単位のエラー詳細を格納し、顧客やスタッフへのフィードバックに利用する。
    """)
  model ValidationError {
    @doc("検証に失敗したフィールドパス。ネストしたキーをドット記法で表現する。")
    field: string;

    @doc("違反した検証ルール名またはコード。")
    rule: string;

    @doc("ユーザーに提示する具体的なエラーメッセージ。言語は、レスポンスの Content-Language ヘッダーのとおり。")
    message: string;

    @doc("検証対象となった実際の値。セキュリティ観点で出力が許容される場合のみ利用する。出力不可の場合はnull")
    value: unknown | null;

    @doc("期待される値や制約条件。入力補助やUI表示のガイダンスに使用する。制約が明示不要な場合はnull")
    constraint: unknown | null;
  }

  @doc("""
    カーソル方式のページネーションレスポンスモデル。
    `CursorPaginationParams` を受けたAPIが検索結果とページング状態をまとめて返却する際に利用する。
    """)
  model CursorPaginationResponse<T> {
    @doc("現在ページで取得したデータ配列。サロン一覧や予約履歴の実データを格納する。")
    data: T[];

    @doc("ページング状態を示すメタ情報。次ページの有無やカーソル値を含む。")
    meta: PaginationMeta;

    @doc("関連するページ遷移リンク。HATEOAS 連携や外部連携向けに利用する。")
    links: PaginationLinks;
  }

  @doc("""
    ページネーションに関する統計情報モデル。
    総件数やカーソル位置を保持し、フロントエンドの続き取得や無限スクロールの制御に利用する。
    """)
  model PaginationMeta {
    @doc("取得対象全体の総件数。件数計測ができない場合はnull")
    total: int32 | null;

    @doc("1ページあたりの取得件数。クエリパラメータ `limit` と一致する。")
    limit: int32;

    @doc("次ページが存在するかを示すフラグ。無限スクロールの継続判定に使用。")
    hasMore: boolean;

    @doc("現在ページのカーソル値。次リクエストで `cursor` に指定することで同位置から再開できる。初回ページの場合はnull")
    cursor: string | null;

    @doc("次ページを取得するためのカーソル値。最終ページの場合はnull")
    nextCursor: string | null;

    @doc("前ページへ戻るためのカーソル値。初回ページまたは戻り操作が不要な場合はnull")
    prevCursor: string | null;
  }

  @doc("""
    ページ遷移に利用するリンク情報モデル。
    API クライアントや外部連携がRESTフローで次・前のリソースを辿る際に利用する。
    """)
  model PaginationLinks {
    @doc("現在ページを指すリンク。")
    self: string;

    @doc("最初のページへのリンク。総件数が確定しない場合はnull")
    first: string | null;

    @doc("最後のページへのリンク。カーソル算出ができない場合はnull")
    last: string | null;

    @doc("次ページへのリンク。最終ページの場合はnull")
    next: string | null;

    @doc("前ページへのリンク。初回ページまたは戻り操作が不要な場合はnull")
    prev: string | null;
  }

  @doc("""
    API 成功レスポンスの共通ラッパーモデル。
    サロン検索や予約登録など多様なユースケースで応答形式を統一し、クライアント実装を簡潔に保つ。
    """)
  model ApiResponse<T> {
    @doc("レスポンスの主体となるビジネスデータ。")
    data: T;

    @doc("リクエスト識別子やバージョン情報など共通メタデータ。メタ情報が不要な場合はnull")
    meta: ResponseMeta | null;

    @doc("関連リソースや次アクションへのリンク情報。リンクがない場合はnull")
    links: Record<string> | null;
  }

  @doc("""
    レスポンス共通メタデータモデル。
    問い合わせ対応やロギングで必要となる識別情報を保持する。
    """)
  model ResponseMeta {
    @doc("リクエストを一意に紐づける相関 ID。ログ横断調査に使用する。")
    correlationId: string;

    @doc("レスポンス生成日時 (UTC)。障害時のタイムライン整理に利用。")
    timestamp: utcDateTime;

    @doc("レスポンスを返却した API バージョン。")
    version: string;

    // その他のメタデータ
    ...Record<unknown>;
  }

  @doc("""
    API ヘルスチェック結果モデル。
    監視基盤や運用ダッシュボードにシステム状態を提供し、早期異常検知を実現する。
    """)
  model HealthStatus {
    @doc("システム全体の稼働状態。`healthy` は正常、`degraded` は性能低下、`unhealthy` は停止を表す。")
    status: "healthy" | "degraded" | "unhealthy";

    @doc("稼働中の API バージョン。運用チームのバージョン管理に利用。")
    version: string;

    @doc("判定実行時点のサーバー時刻 (UTC)。")
    timestamp: utcDateTime;

    @doc("各内部サービスや依存コンポーネントのヘルスチェック結果一覧。")
    checks: HealthCheck[];

    @doc("監視環境固有の追加メタ情報。必要に応じてキーを拡張する。追加情報がない場合はnull")
    metadata: Record<unknown> | null;
  }

  @doc("""
    準備完了チェックの結果モデル。
    オーケストレーターやロードバランサーが、トラフィックを振り分けてよいかを判断するために利用する。
    """)
  model SystemReadyResponse {
    @doc("リクエストを処理できる状態であればtrue。")
    ready: boolean;

    @doc("準備ができていない原因となっている依存コンポーネント名 (例: `database`)。準備完了時はnull")
    reason: string | null;
  }

  @doc("""
    個別サービスのヘルスチェック結果モデル。
    外部サービス連携や内部マイクロサービスごとの状態を把握する。
    """)
  model HealthCheck {
    @doc("対象サービス名またはコンポーネント識別子。")
    name: string;

    @doc("対象サービスの稼働状態。`up` は正常、`down` は停止、`degraded` は部分的な性能低下を示す。")
    status: "up" | "down" | "degraded";

    @doc("ヘルスチェックに要した時間 (ミリ秒)。応答遅延の指標。測定不可の場合はnull")
    responseTime: int32 | null;

    @doc("停止時のエラーメッセージや原因メモ。正常時はnull")
    error: string | null;

    @doc("監視対象固有の追加詳細。再試行回数や依存サービス名などを含める。追加情報がない場合はnull")
    details: Record<unknown> | null;
  }
}
