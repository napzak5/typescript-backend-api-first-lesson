import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;

namespace BeautySalon.Models {
  @doc("""
    ユーザーロール区分 - システム内でのユーザーの役割と権限レベル
    
    customer: 顧客 - サービスの予約・利用が可能なユーザー
    staff: スタッフ - 施術を提供するサロン従業員
    manager: マネージャー - サロンの管理業務を担当する管理者
    admin: 管理者 - システム全体の管理権限を持つユーザー
    owner: オーナー - サロンの所有者、最高権限を保持
    """)
  enum UserRoleType {
    customer,
    staff,
    manager,
    admin,
    owner,
  }

  @doc("""
    ユーザーアカウントステータス区分 - アカウントの利用可否状態
    
    active: アクティブ - 正常に利用可能なアカウント
    unverified: メール未確認 - メールアドレスが確認されていないアカウント
    inactive: 非アクティブ - 利用が休止されているアカウント
    locked: ロック - ログイン失敗回数超過によりロックされたアカウント
    suspended: 停止 - 管理者によって停止されたアカウント
    deleted: 削除済み - 削除されたアカウント
    """)
  enum UserAccountStatusType {
    active,
    unverified,
    inactive,
    locked,
    suspended,
    deleted,
  }

  @doc("""
    2要素認証ステータス区分 - 2要素認証の設定状態
    
    disabled: 無効 - 2要素認証が設定されていない状態
    pending: 設定中 - 2要素認証の設定が進行中の状態
    enabled: 有効 - 2要素認証が有効化されている状態
    """)
  enum TwoFactorStatusType {
    disabled,
    pending,
    enabled,
  }

  @doc("""
    ユーザーレスポンス - users テーブルの公開カラムを返す。
    パスワードハッシュ、2要素認証のシークレット・バックアップコード・最後に受け付けたコードの時間ステップ、
    メールアドレス確認とパスワード再設定のトークンのハッシュ(とその有効期限)は返さない。
    プロパティ名と null 許可は DB カラムと一致させている。
    """)
  model UserResponse {
    @doc("ユーザーを一意に識別するID。")
    id: UserId;

    @doc("ログインに利用するメールアドレス。小文字で保存する。削除されていないユーザーの間で一意。")
    email: string;

    @doc("認証システム上での役割区分。")
    role: UserRoleType;

    @doc("アカウントの稼働状態。")
    status: UserAccountStatusType;

    @doc("メールアドレスが確認済みかどうか。")
    emailVerified: boolean;

    @doc("最後にパスワードを変更した日時。パスワード変更履歴がない場合はnull。")
    lastPasswordChange: utcDateTime | null;

    @doc("2要素認証の設定状態。enabled のとき、ログインにコードが必要。")
    twoFactorStatus: TwoFactorStatusType;

    @doc("連続したログイン失敗回数。")
    failedLoginAttempts: int32;

    @doc("アカウントロックの解除予定日時。アカウントがロックされていない場合はnull。")
    lockedUntil: utcDateTime | null;

    @doc("直近のログイン日時。一度もログインしていない場合はnull。")
    lastLoginAt: utcDateTime | null;

    @doc("直近ログイン時のIPアドレス。ログイン履歴がない場合はnull。")
    lastLoginIp: string | null;

    @doc("ユーザーが顧客の場合の顧客プロファイルID。顧客以外の役割の場合、または顧客プロファイルと紐づいていない場合はnull。")
    customerId: CustomerId | null;

    @doc("ユーザーがスタッフの場合のスタッフプロファイルID。スタッフ以外の役割の場合、またはスタッフプロファイルと紐づいていない場合はnull。")
    staffId: StaffId | null;

    @doc("ユーザーアカウント作成日時。")
    createdAt: utcDateTime;

    @doc("ユーザー情報の最終更新日時。")
    updatedAt: utcDateTime;
  }

  @doc("""
    セッションレスポンス - sessions テーブルの公開カラムと、計算値 current を返す。
    トークンのハッシュは返さない。サーバーはトークンそのものを保存しないので、
    トークンは発行したログイン・トークン再発行のレスポンスでのみ返す。
    current 以外のプロパティ名と null 許可は DB カラムと一致させている。
    """)
  model SessionResponse {
    @doc("セッションを一意に識別するID。")
    id: SessionId;

    @doc("セッション所有者のユーザーID。")
    userId: UserId;

    @doc("ログインしたときの接続元IPアドレス。取得できなかった場合はnull")
    ipAddress: string | null;

    @doc("ログインしたときの User-Agent ヘッダーの値。ヘッダーがなかった場合はnull")
    userAgent: string | null;

    @doc("現在のアクセストークンの有効期限。発行から15分。")
    expiresAt: utcDateTime;

    @doc("セッションそのものの有効期限。ログイン時に決まり(通常は8時間後、rememberMe を指定した場合は30日後)、トークンを再発行しても延びない。この日時を過ぎると再発行できない。")
    refreshExpiresAt: utcDateTime;

    @doc("最後にトークンを発行した(ログインまたは再発行した)日時。")
    lastActivityAt: utcDateTime;

    @doc("セッション作成日時(ログインした日時)。")
    createdAt: utcDateTime;

    @doc("このリクエストを認証したセッションかどうか。DB のカラムではなく、リクエストごとに決まる。")
    current: boolean;
  }

  @doc("""
    セッション一覧リクエスト - ページネーションを指定する。対象はログイン中のユーザーの有効なセッションに限る
    """)
  model SessionSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル")
    cursor?: string;
  }

  @doc("""
    新規ユーザー登録リクエスト - 全項目のキーが必須。
    登録したユーザーのロールは customer になる。ロールはリクエストで指定できない
    """)
  model AuthRegisterRequest {
    @doc("登録に使用するメールアドレス。大文字と小文字を区別せず、小文字で保存する")
    @maxLength(255)
    email: string;

    @doc("""
      設定するパスワード。15文字以上128文字以下(Unicode のコードポイントで数える)で、文字種の組み合わせは要求しない。NFC に正規化して扱う。
      推測されやすいパスワードは拒否する(rule は blocklisted): メールアドレスまたはその @ より前と同じもの、同じ文字や短い並びの繰り返し、連続した文字の並び、よく知られたパスワード。
      NIST SP 800-63B と OWASP Authentication Cheat Sheet に従い、パスワードが唯一の認証要素となる場合の最小長を15文字とし、64文字以上のパスワードも受け付ける
      """)
    @minLength(15)
    @maxLength(128)
    password: string;
  }

  @doc("""
    ログインリクエスト - 全項目のキーが必須。2要素認証が無効なアカウントでは twoFactorCode に null を指定する
    """)
  model AuthLoginRequest {
    @doc("ログインに使用するメールアドレス。")
    @maxLength(255)
    email: string;

    @doc("""
      ログイン用パスワード。128文字以下。
      最小文字数(15文字)はパスワードを設定するとき(登録・再設定・変更)に検証し、ログインでは検証しない
      """)
    @minLength(1)
    @maxLength(128)
    password: string;

    @doc("セッションを長く保つかどうか。false の場合はログインから8時間、true の場合は30日でセッションが切れる。")
    rememberMe: boolean;

    @doc("2要素認証が有効な場合に入力するワンタイムコード。認証アプリが生成したTOTPコード、またはバックアップコードを指定する。2要素認証が無効なアカウントではnull")
    @minLength(1)
    @maxLength(64)
    twoFactorCode: string | null;
  }

  @doc("""
    ログインレスポンス - ログインとトークン再発行で発行したトークンと、ユーザー情報を返す。
    トークンはこのレスポンスでのみ返し、ほかのレスポンスには含めない
    """)
  model AuthLoginResponse {
    @doc("API呼び出しに利用するアクセストークン。Authorization ヘッダーに Bearer として指定する。ランダムに生成した不透明な値で、クライアントは内容を解釈しない")
    accessToken: string;

    @doc("アクセストークン再発行に使用するリフレッシュトークン。不透明な値で、再発行に使用すると以後は使用できない")
    refreshToken: string;

    @doc("トークン種別。常にBearer。")
    token: "Bearer";

    @doc("アクセストークンが有効な残り時間(秒)。通常は900(15分)で、セッションの有効期限が先に来る場合はそれまでの秒数。")
    expiresIn: int32;

    @doc("ログインしたユーザーの情報。")
    user: UserResponse;
  }

  @doc("アクセストークンを再発行するためのリクエスト。")
  model AuthTokenRefreshRequest {
    @doc("ログインまたは前回の再発行で受け取ったリフレッシュトークン。")
    @minLength(1)
    @maxLength(255)
    refreshToken: string;
  }

  @doc("""
    パスワード再設定メールの送信を要求するリクエスト。
    アカウントの有無にかかわらず同じ応答を返す
    """)
  model AuthPasswordForgotRequest {
    @doc("対象アカウントのメールアドレス。")
    @maxLength(255)
    email: string;
  }

  @doc("パスワード再設定トークンが有効かどうかを確認するリクエスト。")
  model AuthPasswordResetVerifyRequest {
    @doc("メールで受け取った再設定トークン。")
    @minLength(1)
    @maxLength(255)
    token: string;
  }

  @doc("パスワード再設定を確定するためのリクエスト。")
  model AuthPasswordResetConfirmRequest {
    @doc("メールで受け取った再設定トークン。")
    @minLength(1)
    @maxLength(255)
    token: string;

    @doc("新しいパスワード。規則は登録時のパスワード(AuthRegisterRequest.password)と同じ")
    @minLength(15)
    @maxLength(128)
    newPassword: string;
  }

  @doc("スタッフへの招待のトークンが使えるかどうかを確認するリクエスト。")
  model AuthStaffInvitationVerifyRequest {
    @doc("メールで受け取った招待トークン。")
    @minLength(1)
    @maxLength(255)
    token: string;
  }

  @doc("ログインしているアカウントで、スタッフへの招待に参加するためのリクエスト。")
  model AuthStaffInvitationJoinRequest {
    @doc("メールで受け取った招待トークン。")
    @minLength(1)
    @maxLength(255)
    token: string;
  }

  @doc("スタッフへの招待を受け入れて、ログインアカウントを作るためのリクエスト。")
  model AuthStaffInvitationAcceptRequest {
    @doc("メールで受け取った招待トークン。")
    @minLength(1)
    @maxLength(255)
    token: string;

    @doc("設定するパスワード。規則は登録時のパスワード(AuthRegisterRequest.password)と同じ")
    @minLength(15)
    @maxLength(128)
    password: string;
  }

  @doc("""
    メールアドレス確認メールの送信を要求するリクエスト。
    アカウントの有無やメールアドレスの確認状態にかかわらず同じ応答を返す
    """)
  model AuthEmailVerificationSendRequest {
    @doc("確認メールの送信先となるアカウントのメールアドレス。")
    @maxLength(255)
    email: string;
  }

  @doc("メールアドレス確認を完了させるリクエスト。")
  model AuthEmailVerificationConfirmRequest {
    @doc("メールに記載された確認トークン。")
    @minLength(1)
    @maxLength(255)
    token: string;
  }

  @doc("ログイン中ユーザーがパスワードを変更するためのリクエスト。")
  model AuthPasswordChangeRequest {
    @doc("本人確認のための現在パスワード。128文字以下。")
    @minLength(1)
    @maxLength(128)
    currentPassword: string;

    @doc("変更後の新しいパスワード。規則は登録時のパスワード(AuthRegisterRequest.password)と同じ。現在のパスワードと同じ値は指定できない")
    @minLength(15)
    @maxLength(128)
    newPassword: string;
  }

  @doc("2要素認証を有効化する際の認証リクエスト。")
  model AuthTwoFactorEnableRequest {
    @doc("本人確認のための現在パスワード。128文字以下。")
    @minLength(1)
    @maxLength(128)
    password: string;
  }

  @doc("""
    2要素認証の設定情報を返すレスポンス。
    シークレットとバックアップコードはこのレスポンスでのみ返し、ほかのレスポンスには含めない
    """)
  model AuthTwoFactorSetupResponse {
    @doc("認証アプリに登録するための otpauth:// URI。QRコードにして表示する。シークレットを含む。")
    qrCodeUrl: string;

    @doc("手動登録用のシークレットキー(Base32)。")
    secret: string;

    @doc("復旧用バックアップコード一覧(10個)。認証アプリのコードの代わりに、それぞれ1回だけ使える。")
    backupCodes: string[];
  }

  @doc("2要素認証の設定を確定するリクエスト。")
  model AuthTwoFactorVerifyRequest {
    @doc("認証アプリが生成したTOTPコード(6桁の数字)。バックアップコードは指定できない。")
    @pattern("^[0-9]{6}$")
    code: string;
  }

  @doc("バックアップコードを再発行する際の確認リクエスト。")
  model AuthTwoFactorBackupCodesRequest {
    @doc("認証アプリが生成したTOTPコード(6桁の数字)、またはバックアップコード。")
    @minLength(1)
    @maxLength(64)
    code: string;
  }

  @doc("2要素認証を無効化する際の確認リクエスト。")
  model AuthTwoFactorDisableRequest {
    @doc("本人確認のための現在パスワード。128文字以下。")
    @minLength(1)
    @maxLength(128)
    password: string;

    @doc("認証アプリが生成したTOTPコード(6桁の数字)、またはバックアップコード。")
    @minLength(1)
    @maxLength(64)
    code: string;
  }

  @doc("""
    バックアップコード再発行のレスポンス。
    バックアップコードはこのレスポンスでのみ返し、ほかのレスポンスには含めない
    """)
  model AuthTwoFactorBackupCodesResponse {
    @doc("新しく発行した復旧用バックアップコード一覧(10個)。それまでのバックアップコードは使用できない。")
    backupCodes: string[];
  }
}
