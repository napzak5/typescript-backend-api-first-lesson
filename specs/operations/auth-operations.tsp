import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/auth.tsp";
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
      @doc("新しいユーザーアカウントを登録します。ロールは customer、アカウント状態は unverified で作成し、登録したメールアドレスに確認メールを送信します。メールアドレスの確認が完了するまでログインできません。セッションは発行しません。メールアドレスが既存のユーザー(削除済みを含む)と重複する場合は409を返します。")
      @summary("Register a user")
      @route("/register")
      @useAuth(NoAuth)
      @post
      register(@body request: AuthRegisterRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<UserResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("メールアドレスとパスワードで認証し、セッションを作成してアクセストークンとリフレッシュトークンを発行します。2要素認証が有効なアカウントでは twoFactorCode も検証します。認証に失敗した場合は、原因(メールアドレスが未登録、パスワードや2要素認証コードの誤り、アカウントのロック、メールアドレス未確認など)にかかわらず同じ内容の401を返します。")
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
        | ProblemResponse<401>
        | RequestBodyErrors
        | CommonErrors;

      @doc("リフレッシュトークンを検証し、新しいアクセストークンとリフレッシュトークンを発行します。使用したリフレッシュトークンは以後使用できません。リフレッシュトークンが無効または期限切れの場合は401を返します。")
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
        | ProblemResponse<401>
        | RequestBodyErrors
        | CommonErrors;

      @doc("現在のセッションを無効にします。")
      @summary("Log out")
      @route("/logout")
      @post
      logout():
        | {
            @statusCode statusCode: 204;
          }
        | CommonErrors;

      @doc("ログイン中のユーザーの情報を取得します。")
      @summary("Get the current user")
      @route("/me")
      @get
      getCurrentUser():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserResponse>;
          }
        | CommonErrors;

      @doc("パスワード再設定メールの送信を要求します。指定したメールアドレスのアカウントが存在する場合にだけ再設定トークンを記載したメールを送信しますが、アカウントの有無にかかわらず同じ応答(204)を返します。")
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
        | CommonErrors;

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
        | CommonErrors;

      @doc("パスワード再設定トークンを使って新しいパスワードを設定します。成功するとトークンは使用できなくなり、そのユーザーのすべてのセッションを無効にします。トークンが無効または期限切れの場合は400を返します。")
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
        | CommonErrors;

      @doc("メールアドレス確認メールの送信を要求します。指定したメールアドレスのアカウントが存在し、メールアドレスが未確認の場合にだけ確認メールを送信しますが、アカウントの有無や確認状態にかかわらず同じ応答(204)を返します。メールアドレスが未確認のアカウントはログインできないため、セッションなしで呼び出せます。")
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
        | CommonErrors;

      @doc("メールで受け取った確認トークンを使ってメールアドレスの確認を完了します。emailVerified を true にし、アカウント状態が unverified の場合は active にします。トークンが無効または期限切れの場合は400を返します。")
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
        | CommonErrors;

      @doc("現在のパスワードで本人確認を行い、新しいパスワードに変更します。現在のパスワードが誤っている場合は400を返します。")
      @summary("Change the password")
      @route("/change-password")
      @post
      changePassword(@body request: AuthPasswordChangeRequest):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("2要素認証の設定を開始します。パスワードで本人確認を行い、TOTPのシークレットとバックアップコードを発行して返します。シークレットとバックアップコードはこのレスポンスでのみ返します。設定は verifyTwoFactor で認証コードを確認すると有効になります。設定中に再度呼び出すと、新しいシークレットとバックアップコードを発行します。パスワードが誤っている場合は400を、2要素認証がすでに有効な場合は409を返します。")
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
        | CommonErrors;

      @doc("認証アプリが生成したコードを確認し、設定中の2要素認証を有効にします。コードが誤っている場合は400を、設定中の2要素認証がない場合は409を返します。")
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
        | CommonErrors;

      @doc("パスワードと認証コードで本人確認を行い、2要素認証を無効にします。シークレットとバックアップコードは削除します。パスワードまたはコードが誤っている場合は400を、2要素認証が有効でない場合は409を返します。")
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
        | CommonErrors;

      @doc("認証コードで本人確認を行い、2要素認証のバックアップコードを再発行します。それまでのバックアップコードは使用できなくなります。新しいバックアップコードはこのレスポンスでのみ返します。コードが誤っている場合は400を、2要素認証が有効でない場合は409を返します。")
      @summary("Regenerate backup codes")
      @route("/2fa/backup-codes")
      @post
      generateBackupCodes(@body request: AuthTwoFactorVerifyRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AuthTwoFactorBackupCodesResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ログイン中のユーザーのすべてのセッション(現在のセッションを含む)を無効にします。")
      @summary("Log out of all sessions")
      @route("/logout-all")
      @post
      logoutAll():
        | {
            @statusCode statusCode: 204;
          }
        | CommonErrors;
    }

    interface SessionCrud {
      @doc("ログイン中のユーザーの有効なセッションを、ページネーションを指定して一覧取得します。有効期限切れのセッションは含みません。")
      @summary("List sessions")
      @route("/sessions")
      @get
      getSessions(...SessionSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<SessionResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("ログイン中のユーザーのセッションを1件無効にします。指定したセッションが存在しない場合、またはほかのユーザーのセッションの場合は404を返します。")
      @summary("Revoke a session")
      @route("/sessions/{sessionId}")
      @delete
      revokeSession(@path sessionId: SessionId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }

  @doc("管理者がユーザーアカウントを参照し、ロックの解除や信頼済みIPアドレスの管理を行うAPI操作群です。")
  @route("/api/v1/admin/auth")
  @tag("Admin - Authentication")
  namespace AdminAuthOperations {
    interface AdminAuthCrud {
      @doc("IDを指定してユーザーを1件取得します。ユーザー登録のレスポンスの Location ヘッダーはこのURLを指します。削除済みのユーザーは含みません。")
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

      @doc("ロックされたユーザーアカウントのロックを解除します。アカウント状態を active に戻し、lockedUntil を null、failedLoginAttempts を0にします。ロックされていないアカウントを指定した場合は409を返します。")
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

      @doc("ユーザーの信頼済みIPアドレスを追加します。すでに登録されているIPアドレスを指定した場合は409を返します。")
      @summary("Add a trusted IP address")
      @route("/trusted-ip/{userId}")
      @post
      addTrustedIp(
        @path userId: UserId,
        @body request: AuthTrustedIpAddRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<UserResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("ユーザーの信頼済みIPアドレスを削除します。ユーザーが存在しない場合、または指定したIPアドレスが登録されていない場合は404を返します。")
      @summary("Remove a trusted IP address")
      @route("/trusted-ip/{userId}")
      @delete
      removeTrustedIp(
        @path userId: UserId,

        @doc("削除するIPアドレス。IPv4 または IPv6 の表記で指定する。")
        @query
        @minLength(1)
        @maxLength(50)
        ipAddress: string,
      ):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }
}
