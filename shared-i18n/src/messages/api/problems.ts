import { text } from '../../languages/localized-text'

/**
 * What the API says of a problem whatever the request was: the title of
 * each kind of error, and the detail of those whose detail the HTTP layer
 * writes. The detail of the other kinds is written where the error is made.
 */
export const problemMessages = {
  validation: {
    title: text({
      en: 'Validation failed',
      ja: '入力の内容が正しくありません',
    }),
  },
  authenticationRequired: {
    title: text({
      en: 'Authentication required',
      ja: '認証が必要です',
    }),
    detail: text({
      en: 'Send the access token in the Authorization header as a Bearer token',
      ja: 'アクセストークンを、Authorization ヘッダーに Bearer トークンとして送ってください',
    }),
  },
  invalidToken: {
    title: text({
      en: 'Invalid token',
      ja: 'トークンが無効です',
    }),
    detail: text({
      en: 'The token cannot be used; sign in again',
      ja: 'このトークンは使えません。もう一度サインインしてください',
    }),
  },
  tokenExpired: {
    title: text({
      en: 'Token expired',
      ja: 'トークンの有効期限が切れています',
    }),
    detail: text({
      en: 'The access token has expired; get a new one with the refresh token',
      ja: 'アクセストークンの有効期限が切れています。リフレッシュトークンで、新しいトークンを受け取ってください',
    }),
  },
  invalidCredentials: {
    title: text({
      en: 'Login failed',
      ja: 'サインインできませんでした',
    }),
    detail: text({
      en: 'Invalid email or password',
      ja: 'メールアドレスかパスワードが正しくありません',
    }),
  },
  twoFactorRequired: {
    title: text({
      en: 'Two-factor authentication required',
      ja: '2 要素認証が必要です',
    }),
    detail: text({
      en: 'Send a valid code of the authenticator app, or a backup code, as twoFactorCode',
      ja: '認証アプリの有効なコードかバックアップコードを、twoFactorCode として送ってください',
    }),
  },
  forbidden: {
    title: text({
      en: 'Forbidden',
      ja: '許可されていません',
    }),
    detail: text({
      en: 'This account is not allowed to do this',
      ja: 'このアカウントでは、この操作はできません',
    }),
  },
  passwordRequired: {
    title: text({
      en: 'Password required',
      ja: 'パスワードが必要です',
    }),
    detail: text({
      en: 'Send the password of the share link; one that was sent was not accepted',
      ja: '共有リンクのパスワードを送ってください。送られたパスワードは、受け付けられませんでした',
    }),
  },
  notFound: {
    title: text({
      en: 'Resource not found',
      ja: 'リソースが見つかりません',
    }),
  },
  alreadyExists: {
    title: text({
      en: 'Resource already exists',
      ja: 'リソースがすでにあります',
    }),
  },
  conflict: {
    title: text({
      en: 'Operation not allowed',
      ja: 'この操作はできません',
    }),
  },
  internal: {
    title: text({
      en: 'Internal server error',
      ja: 'サーバーでエラーが起きました',
    }),
  },
  routeNotFound: {
    title: text({
      en: 'Route not found',
      ja: 'ルートが見つかりません',
    }),
    detail: (method: string, path: string) =>
      text({
        en: `${method} ${path} is not part of the API`,
        ja: `${method} ${path} は、この API にありません`,
      }),
  },
  malformedBody: {
    title: text({
      en: 'Malformed request body',
      ja: 'リクエストの本文を読めません',
    }),
    detail: text({
      en: 'The request body is not valid JSON',
      ja: 'リクエストの本文が、正しい JSON ではありません',
    }),
  },
  unsupportedMediaType: {
    title: text({
      en: 'Unsupported media type',
      ja: '受け付けていないメディアタイプです',
    }),
    detail: text({
      en: 'The request body must be application/json in UTF-8',
      ja: 'リクエストの本文は、UTF-8 の application/json にしてください',
    }),
  },
  bodyTooLarge: {
    title: text({
      en: 'Request body too large',
      ja: 'リクエストの本文が大きすぎます',
    }),
    detail: (limitBytes: number) =>
      text({
        en: `The request body exceeds ${limitBytes} bytes`,
        ja: `リクエストの本文が ${limitBytes} バイトを超えています`,
      }),
  },
  badRequest: {
    title: text({
      en: 'Bad request',
      ja: 'リクエストが正しくありません',
    }),
  },
  rateLimited: {
    title: text({
      en: 'Too many requests',
      ja: 'リクエストが多すぎます',
    }),
    detail: text({
      en: 'Wait for the time in the Retry-After header before retrying',
      ja: 'Retry-After ヘッダーの時間だけ待ってから、もう一度送ってください',
    }),
  },
}
