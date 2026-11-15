import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/auth.tsp";
import "../models/staff.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("ユーザー登録、ログイン・ログアウト、パスワード再設定、メールアドレス確認、2要素認証、セッション管理を行うAPI操作群です。セッションはランダムに生成した不透明なトークンで表します。")
  @route("/api/v1/auth")
  @tag("Authentication")
  namespace AuthOperations {
    interface AuthCrud {
      @doc("ユーザーアカウントの登録を受け付けます。メールアドレスが登録済みかどうかにかかわらず同じ応答(204)を返し、応答から登録の有無を判別できないようにします。メールアドレスが未登録の場合は、ロール customer、アカウント状態 unverified のユーザーを作成し、確認メールを送信します。メールアドレスの確認が完了するまでログインできません。メールアドレスが未確認のまま登録されている場合は、前回の確認メールから60秒以上たっていれば、パスワードを今回の値に置き換えて確認メールを送り直します(それまでの確認トークンは無効になります)。60秒以内の場合と、確認済みのメールアドレスの場合は、何も変更せず、何も送信しません。セッションは発行しません。")
      @summary("Register a user")
      @route("/register")
      @useAuth(NoAuth)
      @post
      register(@body request: AuthRegisterRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | PublicErrors;

      @doc("メールアドレスとパスワードで認証し、セッションを作成してアクセストークンとリフレッシュトークンを発行します。メールアドレスは大文字と小文字を区別しません。認証に失敗した場合は、原因(メールアドレスが未登録、パスワードの誤り、アカウントのロック、メールアドレス未確認、アカウントの停止)にかかわらず同じ内容の401(コード 1002)を返します。パスワードを連続して5回誤るとアカウントを15分間ロックし、その後も誤るたびに15分間ロックします。ログインに成功すると失敗回数は0に戻ります。2要素認証が有効なアカウントでは、パスワードが正しくても、twoFactorCode がない・誤っている・すでに使われている場合は401(コード 1007)を返します。twoFactorCode には認証アプリのコードかバックアップコードを指定します。誤ったコードはパスワードの誤りと同じ失敗回数に数えます。バックアップコードでログインすると、メールで通知します。")
      @summary("Log in")
      @route("/login")
      @useAuth(NoAuth)
      @post
      login(@body request: AuthLoginRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AuthLoginResponse>;
          }
        | ProblemResponse<400>
        | UnauthenticatedResponse
        | RequestBodyErrors
        | PublicErrors;

      @doc("リフレッシュトークンを検証し、同じセッションに新しいアクセストークンとリフレッシュトークンを発行します。使用したリフレッシュトークンと、それまでのアクセストークンは以後使用できません。セッションの有効期限(refreshExpiresAt)は延びません。リフレッシュトークンが無効または期限切れの場合、およびアカウントが利用できない状態の場合は401(コード 1004)を返します。")
      @summary("Refresh the access token")
      @route("/refresh")
      @useAuth(NoAuth)
      @post
      refreshToken(@body request: AuthTokenRefreshRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AuthLoginResponse>;
          }
        | ProblemResponse<400>
        | UnauthenticatedResponse
        | RequestBodyErrors
        | PublicErrors;

      @doc("現在のセッションを無効にします。このセッションのアクセストークンとリフレッシュトークンは以後使用できません。")
      @summary("Log out")
      @route("/logout")
      @post
      logout():
        | {
            @statusCode statusCode: 204;
          }
        | SessionErrors;

      @doc("ログイン中のユーザーの情報を取得します。")
      @summary("Get the current user")
      @route("/me")
      @get
      getCurrentUser():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserResponse>;
          }
        | SessionErrors;

      @doc("パスワード再設定メールの送信を要求します。アカウントの有無にかかわらず同じ応答(204)を返します。メールを送信するのは、指定したメールアドレスのアカウントが存在し、アカウント状態が active、locked、unverified のいずれかの場合だけです。再設定トークンの有効期間は30分で、1回だけ使用できます。再度要求すると、それまでのトークンは無効になります。同じアカウントへの送信は60秒に1通までで、それより短い間隔の要求では何も送信しません。")
      @summary("Request a password reset")
      @route("/forgot-password")
      @useAuth(NoAuth)
      @post
      forgotPassword(@body request: AuthPasswordForgotRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | PublicErrors;

      @doc("パスワード再設定トークンが有効かどうかを確認します。有効な場合は204を、無効または期限切れの場合は400を返します。トークンがURLやアクセスログに残らないよう、リクエスト本文で受け取ります。")
      @summary("Verify a password reset token")
      @route("/reset-password/verify")
      @useAuth(NoAuth)
      @post
      verifyResetToken(@body request: AuthPasswordResetVerifyRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | PublicErrors;

      @doc("パスワード再設定トークンを使って新しいパスワードを設定します。成功するとトークンは使用できなくなり、そのユーザーのすべてのセッションを無効にします。ログインの失敗回数とアカウントのロックを解除し、メールアドレスが未確認の場合は確認済みにします(トークンをメールで受け取れたことが、メールアドレスの確認になるため)。セッションは発行しません。パスワードが変更されたことをメールで通知します。トークンが無効または期限切れの場合と、新しいパスワードが規則を満たさない場合は400を返します。")
      @summary("Reset the password")
      @route("/reset-password")
      @useAuth(NoAuth)
      @post
      resetPassword(@body request: AuthPasswordResetConfirmRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | PublicErrors;

      @doc("メールアドレス確認メールの送信を要求します。アカウントの有無や確認状態にかかわらず同じ応答(204)を返します。メールを送信するのは、指定したメールアドレスのアカウントが存在し、メールアドレスが未確認の場合だけです。確認トークンの有効期間は24時間で、送信するたびにそれまでのトークンは無効になります。同じアカウントへの送信は60秒に1通までで、それより短い間隔の要求では何も送信しません。メールアドレスが未確認のアカウントはログインできないため、セッションなしで呼び出せます。")
      @summary("Send a verification email")
      @route("/verify-email/send")
      @useAuth(NoAuth)
      @post
      sendEmailVerification(@body request: AuthEmailVerificationSendRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | PublicErrors;

      @doc("メールで受け取った確認トークンを使ってメールアドレスの確認を完了します。emailVerified を true にし、アカウント状態が unverified の場合は active にします。トークンは1回だけ使用できます。トークンが無効または期限切れの場合は400を返します。")
      @summary("Confirm the email address")
      @route("/verify-email/confirm")
      @useAuth(NoAuth)
      @post
      confirmEmailVerification(
        @body request: AuthEmailVerificationConfirmRequest,
      ):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | PublicErrors;

      @doc("メールで受け取ったスタッフへの招待のトークンが使えるかどうかを確認し、招待の内容を返します。パスワードを入力する画面が、入力の前に、招待の宛先(作られるアカウントのメールアドレス)とロールを表示するためのものです。トークンは消費しません。トークンが存在しない、有効期限が切れている、取り消された、新しい招待で置き換えられた、スタッフが招待できる状態でなくなった(削除された、無効になった、アカウントに紐づいた、台帳のメールアドレスが変わった)場合は、理由を区別せずに400を返します。レスポンスの links は、招待の受け方を示します。宛先のメールアドレスにアカウントがない(または、未確認の登録だけがある)場合は accept(パスワードを設定してアカウントを作る)、宛先のメールアドレスに、サロンのロール(owner、manager、staff)を持ち、どのサロンにも属していないアカウントがある場合は join(そのアカウントでログインして参加する)です。宛先のメールアドレスに、それ以外のアカウント(顧客、管理者、サロンに属しているスタッフ)がある場合は409を返します。")
      @summary("Verify a staff invitation token")
      @route("/staff-invitation/verify")
      @useAuth(NoAuth)
      @post
      verifyStaffInvitation(@body request: AuthStaffInvitationVerifyRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<StaffInvitationResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | PublicErrors;

      @doc("メールで受け取ったトークンを使ってスタッフへの招待を受け入れ、ログインアカウントを作ります。アカウントのメールアドレスは招待メールの宛先、ロールは招待のロールで、招待されたスタッフに紐づきます。トークンを受け取れたことがメールアドレスの確認になるので、アカウントは確認済み(active)で作られます。宛先のメールアドレスで登録され、メールアドレスが未確認のままのアカウントがある場合は、そのアカウントを招待のアカウントにします(パスワードを置き換えます)。成功するとトークンは使用できなくなります。セッションは発行しません。トークンが使えない場合と、パスワードが規則を満たさない場合は400を返します。宛先のメールアドレスに、未確認でないアカウントがすでにある場合は409を返し、招待は残ります(招待に参加できるアカウントでも同じです。そのアカウントは、ログインして joinStaffInvitation を使います)。")
      @summary("Accept a staff invitation")
      @route("/staff-invitation/accept")
      @useAuth(NoAuth)
      @post
      acceptStaffInvitation(@body request: AuthStaffInvitationAcceptRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | PublicErrors;

      @doc("ログインしているアカウントで、メールで受け取ったスタッフへの招待に参加します。アカウントを招待されたスタッフに紐づけ、ロールを招待のロールにします。成功するとトークンは使用できなくなります。参加できるのは、サロンのロール(owner、manager、staff)を持ち、どのサロンにも属していないアカウント(紐づけを外された、紐づいているスタッフが削除された・無効になった、そのサロンが削除された)です。顧客と管理者のアカウントには403を返します。サロンに属しているアカウントと、招待の宛先がアカウントのメールアドレスでない場合は409を返し、招待は残ります。トークンが使えない場合は、理由を区別せずに400を返します。")
      @summary("Join a staff invitation with the signed-in account")
      @route("/staff-invitation/join")
      @post
      joinStaffInvitation(@body request: AuthStaffInvitationJoinRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("現在のパスワードで本人確認を行い、新しいパスワードに変更します。成功すると、そのユーザーのほかのセッションを無効にし(このリクエストのセッションは有効なまま)、パスワードが変更されたことをメールで通知します。現在のパスワードの確認には、ログインと同じ失敗回数の制限を適用します(連続5回の誤りでアカウントを15分間ロックし、ロック中は正しいパスワードでも確認に失敗します)。現在のパスワードが誤っている場合、新しいパスワードが現在のパスワードと同じ場合、新しいパスワードが規則を満たさない場合は400を返します。")
      @summary("Change the password")
      @route("/change-password")
      @post
      changePassword(@body request: AuthPasswordChangeRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | SessionErrors;

      @doc("2要素認証の設定を開始します。パスワードで本人確認を行い、TOTPのシークレットとバックアップコード(10個)を発行して返します。シークレットとバックアップコードはこのレスポンスでのみ返します。設定は verifyTwoFactor で認証コードを確認すると有効になり、それまではログインにコードは要りません。設定中に再度呼び出すと、新しいシークレットとバックアップコードを発行します。パスワードが誤っている場合は400を、2要素認証がすでに有効な場合は409を返します。パスワードの誤りは、ログインと同じ失敗回数に数えます。")
      @summary("Start two-factor authentication setup")
      @route("/2fa/enable")
      @post
      enableTwoFactor(@body request: AuthTwoFactorEnableRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AuthTwoFactorSetupResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | SessionErrors;

      @doc("認証アプリが生成したコードを確認し、設定中の2要素認証を有効にします。有効にしたことをメールで通知します。コードが誤っている場合は400を、設定中の2要素認証がない場合は409を返します。誤ったコードは、ログインと同じ失敗回数に数えます。")
      @summary("Confirm two-factor authentication setup")
      @route("/2fa/verify")
      @post
      verifyTwoFactor(@body request: AuthTwoFactorVerifyRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | SessionErrors;

      @doc("パスワードとコード(認証アプリのコード、またはバックアップコード)で本人確認を行い、2要素認証を無効にします。シークレットとバックアップコードは削除し、無効にしたことをメールで通知します。パスワードまたはコードが誤っている場合は400を、2要素認証が有効でない場合は409を返します。誤りは、ログインと同じ失敗回数に数えます。")
      @summary("Disable two-factor authentication")
      @route("/2fa/disable")
      @post
      disableTwoFactor(@body request: AuthTwoFactorDisableRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | SessionErrors;

      @doc("コード(認証アプリのコード、またはバックアップコード)で本人確認を行い、2要素認証のバックアップコード(10個)を再発行します。それまでのバックアップコードは使用できなくなります。新しいバックアップコードはこのレスポンスでのみ返し、再発行したことをメールで通知します。コードが誤っている場合は400を、2要素認証が有効でない場合は409を返します。誤ったコードは、ログインと同じ失敗回数に数えます。")
      @summary("Regenerate backup codes")
      @route("/2fa/backup-codes")
      @post
      generateBackupCodes(@body request: AuthTwoFactorBackupCodesRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AuthTwoFactorBackupCodesResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | SessionErrors;

      @doc("ログイン中のユーザーのすべてのセッション(現在のセッションを含む)を無効にします。")
      @summary("Log out of all sessions")
      @route("/logout-all")
      @post
      logoutAll():
        | {
            @statusCode statusCode: 204;
          }
        | SessionErrors;
    }

    interface SessionCrud {
      @doc("ログイン中のユーザーの終了していないセッションを、新しい順に、ページネーションを指定して一覧取得します。セッションの有効期限(refreshExpiresAt)を過ぎたセッションは含みません。このリクエストを認証したセッションは current が true になります。")
      @summary("List sessions")
      @route("/sessions")
      @get
      getSessions(...SessionSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<SessionResponse>;
          }
        | ProblemResponse<400>
        | SessionErrors;

      @doc("ログイン中のユーザーのセッションを1件無効にします。無効にしたセッションのアクセストークンとリフレッシュトークンは使えなくなります。このリクエストを認証したセッション自身も指定できます(ログアウトと同じ結果になります)。指定したセッションが存在しない場合、ほかのユーザーのセッションの場合、すでに終了している場合は404を返します。")
      @summary("Revoke a session")
      @route("/sessions/{sessionId}")
      @delete
      revokeSession(@path sessionId: SessionId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | SessionErrors;
    }
  }

  @doc("管理者(ロール admin)がユーザーアカウントを参照し、ロックの解除と2要素認証のリセットを行うAPI操作群です。管理者以外が呼び出した場合は403を返します。")
  @route("/api/v1/admin/auth")
  @tag("Admin - Authentication")
  namespace AdminAuthOperations {
    interface AdminAuthCrud {
      @doc("IDを指定してユーザーを1件取得します。削除済みのユーザーは含みません。")
      @summary("Get a user")
      @route("/users/{userId}")
      @get
      getUser(@path userId: UserId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("ロックされたユーザーアカウントのロックを解除します。lockedUntil を null、failedLoginAttempts を0にし、アカウント状態が locked の場合は active に戻します(suspended などほかの状態は変えません)。ロックされていないアカウント(状態が locked でなく、lockedUntil が現在より後でもない)を指定した場合は409を返します。管理者自身のアカウントは指定できません(403)。")
      @summary("Unlock a user account")
      @route("/unlock/{userId}")
      @post
      unlockAccount(@path userId: UserId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("ユーザーの2要素認証を無効にします。認証アプリとバックアップコードの両方を失った利用者が、ログインして設定し直せるようにするための操作です。シークレットとバックアップコードを削除し、利用者にメールで知らせます。利用者のセッションは変更しません。2要素認証が有効でないアカウントを指定した場合は409を返します。管理者自身のアカウントは指定できません(403)。")
      @summary("Reset two-factor authentication of a user")
      @route("/reset-two-factor/{userId}")
      @post
      resetTwoFactor(@path userId: UserId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;
    }
  }
}
