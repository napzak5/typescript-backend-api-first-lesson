import { text } from '../../languages/localized-text'

/** What the API says of signing in and the account of a user. */
export const authMessages = {
  invalidSessionId: text({
    en: 'Invalid session ID',
    ja: 'セッションの ID が正しくありません',
  }),
  invalidUserId: text({
    en: 'Invalid user ID',
    ja: 'ユーザーの ID が正しくありません',
  }),
  invalidSessionSearch: text({
    en: 'Invalid session search',
    ja: 'セッションの検索の条件が正しくありません',
  }),
  invalidEmailVerification: text({
    en: 'Invalid email verification',
    ja: 'メールアドレスの確認の内容が正しくありません',
  }),
  invalidEmailVerificationRequest: text({
    en: 'Invalid email verification request',
    ja: 'メールアドレスの確認の依頼の内容が正しくありません',
  }),
  invalidLogin: text({
    en: 'Invalid login',
    ja: 'サインインの内容が正しくありません',
  }),
  invalidPasswordChange: text({
    en: 'Invalid password change',
    ja: 'パスワードの変更の内容が正しくありません',
  }),
  invalidPasswordReset: text({
    en: 'Invalid password reset',
    ja: 'パスワードの再設定の内容が正しくありません',
  }),
  invalidPasswordResetRequest: text({
    en: 'Invalid password reset request',
    ja: 'パスワードの再設定の依頼の内容が正しくありません',
  }),
  invalidPasswordResetToken: text({
    en: 'Invalid password reset token',
    ja: 'パスワードの再設定のトークンが正しくありません',
  }),
  invalidRegistration: text({
    en: 'Invalid registration',
    ja: '登録の内容が正しくありません',
  }),
  invalidRequestForNewBackupCodes: text({
    en: 'Invalid request for new backup codes',
    ja: '新しいバックアップコードの依頼の内容が正しくありません',
  }),
  invalidRequestToDisableTwoFactorAuthentication: text({
    en: 'Invalid request to disable two-factor authentication',
    ja: '2 要素認証を無効にする依頼の内容が正しくありません',
  }),
  invalidTokenRefresh: text({
    en: 'Invalid token refresh',
    ja: 'トークンの再発行の内容が正しくありません',
  }),
  invalidTwoFactorAuthenticationCode: text({
    en: 'Invalid two-factor authentication code',
    ja: '2 要素認証のコードの内容が正しくありません',
  }),
  invalidTwoFactorAuthenticationSetup: text({
    en: 'Invalid two-factor authentication setup',
    ja: '2 要素認証の設定の内容が正しくありません',
  }),
}
