# フロントエンドAPI統合ガイド（Orval）

このドキュメントは、フロントエンドが API とつながるために現在リポジトリにあるものと、まだないものを説明します。コードは実ファイルからの抜粋で、コメントは省いています。

## 現状

**3つのフロントエンドアプリにある画面は、サインインと、portal-app のアカウントの画面（登録、メールアドレスの確認、パスワードの再設定、スタッフの招待の受け入れ）、サロンの画面（サロンを探す、サロンの詳細）、予約の画面（予約する、予約の一覧、予約の内容とキャンセル、日時の変更）、マイページの画面（会員の情報とお客様の情報、その登録と変更、好みの設定）、レビューの画面（来店についてのレビューを書く、自分のレビューを見て、変更し、削除する。サロンの詳細で、ほかの人のレビューが参考になったと伝え、通報する）、共有リンクの画面（サロンが共有したファイルを、アカウントのない人が見て、保存する）、3 つのアプリのアカウントの安全の画面（パスワードの変更、サインインしている端末とそのサインアウト、2 要素認証の設定とバックアップコードの発行し直しと無効化）、admin-app の予約台帳の画面（サロンを選ぶ、その日の予約の一覧、予約の内容とステータスの操作、予約を入れる、記録を変える、日時と担当を変える、施術明細を足して外す、予約を削除する）、admin-app の売上の画面（予約から会計を入れる、売上台帳、売上の内容、支払いの記録、レシート、売上を直す、返金、売上の取り消し）、admin-app の顧客台帳の画面（顧客台帳、お客様を登録する、お客様の台帳と好み設定とこのサロンでの利用、台帳を直す、紹介元を選ぶ、好み設定を直す、台帳からの削除と台帳に戻すこと、変更履歴、台帳の版、ポイントの残高と履歴、ポイントを記録する、CSV ファイルのお客様をまとめて登録する、台帳で選んだお客様にまとめてタグを付けて外し、台帳から削除する、同じお客様の 2 つの記録を 1 つにまとめる、台帳を CSV ファイルに、お客様のデータを JSON ファイルに出力する、お客様のデータの消去の依頼を受け付けて取り消す）、admin-app のカルテの画面（カルテとアレルギー、カルテを作る、カルテを直す、カルテを探す、アレルギーを記録する、アレルギーの記録を直す）、admin-app の施術記録の画面（施術記録の一覧、施術記録の内容と削除、予約から施術記録を書く、施術記録を直す、施術写真を足して外す、施術の統計）、admin-app のスタッフ台帳の画面（スタッフ台帳、スタッフを登録する、スタッフの内容と削除、スタッフ情報を直す）、admin-app のシフトの画面（その週のシフト、スタッフの勤務スケジュール、勤務スケジュールを直す）、admin-app のスタッフのログインアカウントの画面（招待、ロールの変更、紐づけの解除）、admin-app の自分のプロフィールの画面（お客様に見せるプロフィールと、自分を紹介する項目を直す）、admin-app のメニューの画面（メニュー、サービスの内容、サービスとカテゴリーを足す、直す、削除する、サービスをまとめて変える）、admin-app のサロンの設定の画面（サロンの情報、営業時間、営業日カレンダー、サロンの情報と営業時間を直す）、admin-app の支払い方法の画面（支払い方法の一覧と内容、足す、直す、削除する）、admin-app の商品台帳の画面（商品台帳を探す、商品の内容、足す、直す、削除する）、admin-app の在庫の画面（在庫の見かた、在庫の行の内容、足す、直す、削除する、在庫の移動を記録する、その履歴、棚卸し、在庫評価額、在庫のアラートとその確認）、admin-app の発注の画面（発注を探す、発注の内容とそのステータス、発注を作る、納品予定日とメモを直す、入荷を記録する、発注の提案とそこから作る発注）、admin-app の店舗のレビューの画面（レビューと評価のまとめ、レビューの内容、サロンからの返信を書いて直す、返信の取り下げ、運営への通報）、admin-app のサロンのファイルの画面（ファイルの一覧とアップロード、ファイルを開く、保存する、削除する、共有リンクを発行し、一覧し、取り消す）、dashboard-app の売上レポートの画面（売上レポートを開くサロンを選ぶ、期間の売上の集計と、その CSV への出力、日、週、月ごとの売上の推移、1 日の売上）と、アプリの枠です。** そのほかの業務の画面（スタッフ別、区分別のレポートと、運営者の操作）は、まだありません。API を呼ぶための土台（生成クライアント、fetch ラッパー、セッション）はあります。`src/App.tsx` が、共有の枠（`ui` の `AppShell`。アプリ名とアカウント欄のヘッダー、本文へ移動するリンク、本文）の中に、画面と、存在しないパスのためのページを持ち、サインインしていない人にはサインインの画面を出します（[画面とサインイン](#画面とサインイン)）。dashboard-app のトップページは、オーナーとマネージャーを自分のサロンの売上レポートへ送り、管理者には、売上レポートを開くサロンを選ばせます（admin-app のトップページと同じ、`salon-screens` の `StartScreen`）。portal-app には、そのほかにアカウントの画面があります（[アカウントの画面](#アカウントの画面)）。

あるもの:

- OpenAPI ドキュメントから Orval が生成した API クライアント（`@beauty-salon-frontend/api-client`）。型、fetch 関数、TanStack Query のフックを含む
- そのクライアントが HTTP 呼び出しに使う fetch ラッパー（`@beauty-salon-frontend/io` の `customInstance`）。生成コードが期待するとおりに動くことを、テストと実際のサーバーへの呼び出しで確認している
- セッション: ブラウザーに保存したトークンをリクエストに付け、期限が切れたら再発行して送り直す仕組み（`io`）と、サインインしているのがだれかを返すフック、サインインとサインアウト、サインインの画面、サインインが要る画面の出し分け、ヘッダーのアカウント欄（`@beauty-salon-frontend/session`）。[セッション](#セッション)を参照
- 各アプリの TanStack Query の初期設定（`QueryClientProvider`）
- UI の土台: デザイントークン（`@beauty-salon-frontend/theme`）、CSS Modules で書いた共有コンポーネントとそのカタログ（`@beauty-salon-frontend/ui`、Storybook）、テストが共有する道具（`@beauty-salon-frontend/testing`）。[UI とテストの規則](#ui-とテストの規則)を参照
- アカウントの画面（portal-app の `src/account/`）: 登録、メールアドレスの確認、パスワードの再設定、スタッフの招待の受け入れ。[アカウントの画面](#アカウントの画面)を参照
- サロンの画面（portal-app の `src/salons/`）: サロンを探す画面（`/`）と、サロンの詳細の画面（`/salons/:salonId`）。[サロンの画面](#サロンの画面)を参照
- 予約の画面（portal-app の `src/bookings/`）: 予約する画面（`/salons/:salonId/services/:serviceId/booking`）、予約の一覧の画面（`/bookings`）、予約の内容の画面（`/bookings/:bookingId`。キャンセルも、ここで行う）、日時の変更の画面（`/bookings/:bookingId/reschedule`）。顧客のアカウントでサインインして使う。[予約の画面](#予約の画面)を参照
- マイページの画面（portal-app の `src/profile/`）: マイページ（`/mypage`。会員の情報と、お客様の情報）と、お客様の情報の登録と変更の画面（`/mypage/profile`）。顧客のアカウントでサインインして使う。[マイページの画面](#マイページの画面)を参照
- 好みの設定の画面（portal-app の `src/preferences/`）: マイページの「好みの設定」の部分と、好みの設定を変更する画面（`/mypage/preferences`）。顧客のアカウントでサインインして使う。[好みの設定の画面](#好みの設定の画面)を参照
- レビューの画面（portal-app の `src/reviews/`）: 来店が済んだ予約の内容の画面の「レビュー」の部分、レビューを書く画面（`/bookings/:bookingId/review`）、自分のレビューの一覧（`/mypage/reviews`。削除も、ここで行う）、レビューを変更する画面（`/mypage/reviews/:reviewId`）。顧客のアカウントでサインインして使う。サロンの詳細の画面では、顧客が、ほかの人のレビューが参考になったと伝え、通報する。[レビューの画面](#レビューの画面)を参照
- 共有リンクの画面（portal-app の `src/share/`）: 共有されたファイル（`/share#token=<トークン>`）。共有リンクを受け取った人が、サインインせずに使う。[共有リンクの画面](#共有リンクの画面)を参照
- アカウントの安全の画面（`session` の `src/security/`）: パスワード、2 要素認証（バックアップコードの発行し直しと無効化を含む）、サインインしている端末と、そのサインアウトの画面と、パスワードを変更する画面と、2 要素認証を設定する画面。portal-app はマイページの下（`/mypage/security`）に、admin-app と dashboard-app は `/account/security` に置き、ヘッダーからリンクする。[アカウントの安全の画面](#アカウントの安全の画面)を参照
- 予約台帳の画面（admin-app の `src/salons/` と `src/bookings/`）: サロンを選ぶ画面（`/`。`admin` だけ。サロンのメンバーは、自分のサロンのその日の予約の一覧へ移る）、その日の予約の一覧（`/salons/:salonId/bookings`）、予約の内容とステータスの操作（`/salons/:salonId/bookings/:bookingId`）。サロンで働く人（`owner`、`manager`、`staff`）と `admin` のアカウントでサインインして使う。[予約台帳の画面](#予約台帳の画面)を参照
- 売上の画面（admin-app の `src/sales/`）: 予約から会計を入れる画面（`/salons/:salonId/bookings/:bookingId/checkout`）、売上台帳（`/salons/:salonId/sales`）、売上の内容（`/salons/:salonId/sales/:saleId`）、支払いを記録する画面（`…/payments/new`）、レシート（`…/receipt`）、売上を直す画面（`…/edit`）、返金する画面（`…/payments/:paymentId/refund`）。予約台帳と同じアカウントで使う（返金と取り消しは、`owner`、`manager`、`admin`）。[売上の画面](#売上の画面)を参照
- 顧客台帳の画面（admin-app の `src/customers/`）: 顧客台帳（`/salons/:salonId/customers`。CSV ファイルへの出力も）、お客様を登録する画面（`…/customers/new`）、CSV から登録する画面（`…/customers/import`）、お客様の台帳（`…/customers/:customerId`）、台帳を直す画面（`…/edit`）、好み設定を直す画面（`…/preferences`）、変更履歴（`…/history`）、台帳の版（`…/history/:version`）、ポイント（`…/points`）、ポイントを記録する画面（`…/points/new`）、ほかのお客様とまとめる画面（`…/merge`）。予約台帳と同じアカウントで使う。[顧客台帳の画面](#顧客台帳の画面)を参照
- カルテの画面（admin-app の `src/charts/`）: カルテ（`/salons/:salonId/customers/:customerId/chart`）、カルテを作る画面と直す画面（`…/chart/new`、`…/chart/edit`）、アレルギーを記録する画面と直す画面（`…/chart/allergies/new`、`…/chart/allergies/:allergyId/edit`）、カルテを探す画面（`/salons/:salonId/customers/charts`）。顧客台帳と同じアカウントで使う。[カルテの画面](#カルテの画面)を参照
- 施術記録の画面（admin-app の `src/treatments/`）: 施術記録の一覧（`/salons/:salonId/treatments`）、施術記録の内容（`…/treatments/:treatmentId`。削除も、ここで行う）、予約から施術記録を書く画面（`/salons/:salonId/bookings/:bookingId/treatment/new`）、施術記録を直す画面（`…/treatments/:treatmentId/edit`）、施術写真を足す画面（`…/treatments/:treatmentId/photos/new`）、施術の統計（`/salons/:salonId/treatments/statistics`）。予約台帳と同じアカウントで使う（削除は、`owner`、`manager`、`admin`）。[施術記録の画面](#施術記録の画面)を参照
- スタッフ台帳の画面（admin-app の `src/staff/`）: スタッフ台帳（`/salons/:salonId/staff`）、スタッフを登録する画面（`…/staff/new`）、スタッフの内容（`…/staff/:staffId`。削除も、ここで行う）、スタッフ情報を直す画面（`…/staff/:staffId/edit`）。サロンの `owner` と `admin` のアカウントで使う。[スタッフ台帳の画面](#スタッフ台帳の画面)を参照
- シフトの画面（admin-app の `src/shifts/`）: その週のシフト（`/salons/:salonId/shifts`）、スタッフの勤務スケジュール（`…/shifts/:staffId`）、勤務スケジュールを直す画面（`…/shifts/:staffId/edit`）。サロンの 4 つのロールで見て（`staff` は自分のものだけ）、`owner`、`manager`、`admin` が直す。[シフトの画面](#シフトの画面)を参照
- スタッフのログインアカウントの画面（admin-app の `src/staff-accounts/`）: スタッフのログインアカウントと招待（`/salons/:salonId/staff/:staffId/account`）。サロンの `owner` と `admin` のアカウントで使う。[スタッフのログインアカウントの画面](#スタッフのログインアカウントの画面)を参照
- 自分のプロフィールの画面（admin-app の `src/own-profile/`）: お客様に見せる自分のプロフィールと、それを直すフォーム（`/account/profile`）。サロンの `owner`、`manager`、`staff` のアカウントで使い、ヘッダーからリンクする。[自分のプロフィールの画面](#自分のプロフィールの画面)を参照
- メニューの画面（admin-app の `src/menu/`）: メニュー（`/salons/:salonId/menu`）、サービスの内容（`…/menu/services/:serviceId`）、サービスを足す画面（`…/menu/services/new`）、サービスを直す画面（`…/menu/services/:serviceId/edit`。削除も、ここで行う）、カテゴリーを足す画面（`…/menu/categories/new`）、カテゴリーを直す画面（`…/menu/categories/:categoryId/edit`。削除も、ここで行う）、サービスをまとめて変える画面（`…/menu/services/bulk`）。サロンの 4 つのロールと `admin` で見て、`owner`、`manager`、`admin` が変える。[メニューの画面](#メニューの画面)を参照
- サロンの設定の画面（admin-app の `src/settings/`）: サロンの設定（`/salons/:salonId/settings`）、サロンの情報を直す画面（`…/settings/edit`）、営業時間を直す画面（`…/settings/hours`）。サロンの 4 つのロールと `admin` で見て、`owner`、`manager`、`admin` が直す。[サロンの設定の画面](#サロンの設定の画面)を参照
- 支払い方法の画面（admin-app の `src/payment-methods/`）: 支払い方法（`/salons/:salonId/settings/payment-methods`）、支払い方法を足す画面（`…/payment-methods/new`）、支払い方法の内容（`…/payment-methods/:paymentMethodId`）、支払い方法を直す画面（`…/payment-methods/:paymentMethodId/edit`。削除も、ここで行う）。サロンの 4 つのロールと `admin` で見て、`owner`、`manager`、`admin` が変える。[支払い方法の画面](#支払い方法の画面)を参照
- 商品台帳の画面（admin-app の `src/products/`）: 商品台帳（`/salons/:salonId/products`）、商品を足す画面（`…/products/new`）、商品の内容（`…/products/:productId`）、商品を直す画面（`…/products/:productId/edit`。削除も、ここで行う）。サロンの 4 つのロールと `admin` で見て、`owner`、`manager`、`admin` が変える。[商品台帳の画面](#商品台帳の画面)を参照
- 在庫の画面（admin-app の `src/inventory/`）: 在庫（`/salons/:salonId/inventory`。すべて、在庫僅少、期限切れ間近）、在庫の行を足す画面（`…/inventory/new`）、在庫の行の内容（`…/inventory/:inventoryId`）、在庫の行を直す画面（`…/inventory/:inventoryId/edit`。削除も、ここで行う）。サロンの 4 つのロールと `admin` で見て、`owner`、`manager`、`admin` が変える。[在庫の画面](#在庫の画面)を参照
- 在庫の移動の画面（admin-app の `src/inventory/`）: 在庫の移動の履歴（`…/inventory/:inventoryId/movements`）、在庫の移動を記録する画面（`…/inventory/:inventoryId/movements/new`）。サロンの 4 つのロールと `admin` で見て、記録する（在庫の調整、廃棄、サロン間の移動は、`owner`、`manager`、`admin`）。[在庫の移動の画面](#在庫の移動の画面)を参照
- 棚卸しと在庫評価額の画面（admin-app の `src/inventory/`）: 棚卸し（`…/inventory/count`）、在庫評価額（`…/inventory/value`）。`owner`、`manager`、`admin` が使う。[棚卸しと在庫評価額の画面](#棚卸しと在庫評価額の画面)を参照
- 在庫のアラートの画面（admin-app の `src/inventory/`）: 在庫のアラート（`…/inventory/alerts`）。サロンの `owner`、`manager`、`staff` と `admin` が見て、確認済みにする。[在庫のアラートの画面](#在庫のアラートの画面)を参照
- 発注の画面（admin-app の `src/purchase-orders/`）: 発注（`/salons/:salonId/purchase-orders`）、発注を作る画面（`…/purchase-orders/new`）、発注の内容（`…/purchase-orders/:purchaseOrderId`）とそのステータス、納品予定日とメモを直す画面（`…/purchase-orders/:purchaseOrderId/edit`）、入荷を記録する画面（`…/purchase-orders/:purchaseOrderId/receive`）、発注の提案（`…/purchase-orders/suggestions`）。サロンの `owner`、`manager`、`staff` と `admin` が探して見て、作り、ステータスを進めて直し、入荷を記録する。承認と取り消しは `owner`、`manager`、`admin`。[発注の画面](#発注の画面)を参照
- 店舗のレビューの画面（admin-app の `src/reviews/`）: レビュー（`/salons/:salonId/reviews`）、レビューの内容（`…/reviews/:reviewId`）、レビューに返信する画面（`…/reviews/:reviewId/response`）。サロンのだれもが読む。返信を書いて直し、運営に通報するのは `owner` と `manager`、返信を取り下げるのは `owner`、`manager` と `admin`。[店舗のレビューの画面](#店舗のレビューの画面)を参照
- サロンのファイルの画面（admin-app の `src/attachments/`）: ファイル（`/salons/:salonId/files`）と、ファイル（`…/files/:attachmentId`）。サロンのだれもが見て、アップロードする。削除するのは `owner`、`manager`、`admin` と、アップロードした本人。[サロンのファイルの画面](#サロンのファイルの画面)を参照
- 共有リンクの発行と管理の画面（admin-app の `src/share-links/`）: ファイルの画面の下の共有リンクと、共有リンクを発行する（`…/files/:attachmentId/share-links/new`）、共有リンク（`…/files/:attachmentId/share-links/:shareLinkId`）。発行し、一覧し、取り消すのは `owner`、`manager`、`admin`。[共有リンクの発行と管理の画面](#共有リンクの発行と管理の画面)を参照
- 売上レポートの画面（dashboard-app の `src/reports/`）: 売上レポート（`/salons/:salonId/reports`）、売上の推移（`/salons/:salonId/reports/trends`）、1 日の売上（`/salons/:salonId/reports/daily`）と、トップページのサロンを選ぶ画面（管理者）。サロンの `owner`、`manager` と `admin` が、期間の売上を集計して、CSV に出力し、日、週、月ごとの売上の推移と、1 日の売上を見る。[売上レポートの画面](#売上レポートの画面)を参照
- 環境変数 `VITE_BACKEND_BASE_URL`（API サーバーのオリジン）と、ほかのアプリのオリジン（`VITE_ADMIN_APP_URL`、`VITE_PORTAL_APP_URL`）

ないもの:

- admin-app の予約台帳、売上、顧客台帳、カルテ、施術記録、スタッフ台帳、シフト、スタッフのログインアカウント、自分のプロフィール、メニュー、サロンの設定、支払い方法、商品台帳、在庫、発注、店舗のレビュー、サロンのファイルのほかの業務の画面と、dashboard-app の売上レポートのほかの業務の画面（いま API を呼ぶ画面は、サインイン、サインアウト、アカウントの画面、サロンの画面、予約の画面、マイページの画面、好みの設定の画面、レビューの画面、共有リンクの画面、アカウントの安全の画面、予約台帳の画面、売上の画面、顧客台帳の画面、カルテの画面、施術記録の画面、スタッフ台帳の画面、シフトの画面、スタッフのログインアカウントの画面、自分のプロフィールの画面、メニューの画面、サロンの設定の画面、支払い方法の画面、商品台帳の画面、在庫の画面、発注の画面、店舗のレビューの画面、サロンのファイルの画面、共有リンクの発行と管理の画面、売上レポートの画面）
- API のモックサーバー（画面のテストは、jsdom からも、実際のブラウザーからも、実際の API を呼ぶ。[テスト](#実際の-api-と-db-を使うテストpnpm-testintegration)）

## 構成

### アプリ

| アプリ | ディレクトリ | 開発サーバーのポート |
|--------|--------------|----------------------|
| portal-app | `frontend/apps/portal-app` | 3001 |
| admin-app | `frontend/apps/admin-app` | 3002 |
| dashboard-app | `frontend/apps/dashboard-app` | 3003 |

いずれも Vite 8 + React 19 + react-router 8 の SPA です。ワークスペースのパッケージで依存しているのは `@beauty-salon-frontend/ui`、`@beauty-salon-frontend/theme`、`@beauty-salon-frontend/session`、それにテストのための `@beauty-salon-frontend/testing` です。portal-app と admin-app は、`@beauty-salon-frontend/api-client` と `@beauty-salon-frontend/preferences` にも依存しています（画面が、生成された関数を呼び、好み設定のフォームを共有します）。admin-app は、ファイルを保存するために `@beauty-salon-frontend/io` に、サロンの画面が共有するもの（API の応答の読み方、続きのある一覧とその表、キーワードの検索、サロンの時刻、サロンを探して読むこと、サロンを選ぶ画面、アドレスのサロンの `WithSalon`、集計する期間とそのフォーム、フォームの値の読み方、金額と支払い方法とメニューの区分の言葉）のために `@beauty-salon-frontend/salon-screens` にも依存しています。dashboard-app は、売上レポートの画面のために、`@beauty-salon-frontend/api-client`、`@beauty-salon-frontend/io`（CSV を保存する）と `@beauty-salon-frontend/salon-screens` に依存しています。

### 共有パッケージ（`frontend/packages/`）

| パッケージ | 役割 | 使っているもの |
|------------|------|----------------|
| `api-client` | Orval の生成物（`src/generated/`）と、その再エクスポート | `session`、portal-app、admin-app |
| `io` | fetch ラッパー `customInstance`、ブラウザーに保存するセッション `sessionStore`、API が返したファイルの名前を読む `fileNameOf` と、画面が持つファイルをブラウザーに保存させる `saveFile` | `api-client`、`session`、admin-app |
| `session` | アプリのセッション: 状態を返すフック `useSession`、`signIn`、`signOut`、ユーザーが替わったときに取得済みのデータを消す `keepQueriesOfOneUser`、サインインが要る画面を囲む `RequireSession`（サインインの画面を含む）、ヘッダーのアカウント欄 `SessionAccount`、アカウントの安全の画面（`AccountSecurityScreen`、`PasswordChangeScreen`、`TwoFactorSetupScreen`）と、選ぶパスワードの規則（`PASSWORD_RULE` など）、サインインしている人の所属するサロン（`useOwnSalon`）と、どのサロンにも属していないアカウントへの知らせ（`NoSalonNotice`） | 3つのアプリ（`src/main.tsx`、`src/App.tsx`、portal-app の `src/account/` と `src/security/`） |
| `config` | `import.meta.env` を読む `env` オブジェクトと、モード判定関数（`isProductionMode` など） | `io`、`ui`（型のみ） |
| `theme` | デザイントークン（`src/tokens.css`）、リセットと素の要素のスタイル、スタイルの規則の検査（`src/style-rules.ts`） | 3つのアプリ、`ui`（カタログとテスト） |
| `ui` | 共有コンポーネント（`Button`、フォームの部品 `TextField`・`TextArea`・`Select`・`RadioGroup`・`Checkbox`、メッセージの `Alert`、画面の骨組みの部品 `AppShell`・`Navigation`・`PageHeader`・`Card`・`DescriptionList`・`Badge`・`Table`・`EmptyState`・`LoadingIndicator`・`Dialog`、読めなかったことの知らせの `UnreadNotice`、QR コードの `QrCode`、評価の星の `Rating`、言葉の一覧の `TagList`、リンクの `LinkProvider`・`Link`・`ButtonLink`、通知の `NotificationProvider`・`useNotifications`、`EnvironmentBanner`）、クラス名をつなぐ `classNames`、カタログ（Storybook。`session` と、アプリのストーリーも表示する） | 3つのアプリ、`session` |
| `testing` | テストが共有するもの: jest-dom のマッチャー、jsdom にない `dialog` 要素のメソッド（`showModal`・`close`）と、画面が保存したファイル（`savedFiles`）、アクセシビリティの検査（axe-core）、ストーリーごとにその検査を宣言する関数、実際の API を使うテストの仕組み（`testing/api`） | `ui`、`io`、`session`、3つのアプリのテスト、`frontend/e2e` |
| `preferences` | 好み設定のフォーム（`PreferencesForm`、時間帯の行の `TimeSlotFields`）、フォームの読み取り（`readPreferencesChange`）と断られたときの言葉（`afterPreferencesChange`）、選べるスタッフの並びと名前（`staffChoicesOf`、`staffLabelOf`）、1 行に 1 つずつ書く一覧の読み取り（`linesOf`）。お客様がポータルで書くものと、サロンが台帳で書くものは、同じ好み設定 | portal-app（`src/preferences/`、`src/reviews/`）、admin-app（`src/customers/`） |
| `assets` | 画像アセット | なし |

アプリが直接使っているのは `ui`、`theme`、`session` と、3 つのアプリの `api-client`、portal-app と admin-app の `preferences`、admin-app と dashboard-app の `io` と `salon-screens` です（`ui` は `config` から型を1つ借りています）。portal-app は、`io` を `api-client` と `session` を通して使っています。

実際のブラウザーで通すテスト（`@beauty-salon-frontend/e2e`）は、`frontend/e2e` にあります。`testing` から、テスト用のサーバーを呼ぶコードと、アクセシビリティの検査の規則を使います。

アプリのビルド（`vite build`）は、`api-client`、`io`、`session`、`config`、`ui`、`preferences`、`assets` を、rslib でビルドした `dist/` を通して参照します。`theme` と `testing` はビルドせず、ソースのまま参照されます。`ui` のコンポーネントは自分のスタイルシートを自分で読み込むので、アプリが読み込むスタイルシートは `theme` の 1 つだけです（`src/main.tsx`）。アプリの開発サーバーとテストは、エクスポート条件 `@beauty-salon-frontend/source` を持つパッケージ（`ui`、`io`、`config`、`api-client`、`session`、`preferences`）をソースから読みます。コンポーネントの変更は、パッケージのビルドを待たずに画面に出ます。`pnpm dev` は最初にフロントエンドのパッケージをビルドしてから、各パッケージの監視ビルドと各アプリの開発サーバー（とバックエンド）を起動します。テストはビルドを必要としません（[テスト](#テスト)）。

## 型の流れ（TypeSpec からコンポーネントまで）

```
specs/models/salon.tsp                       model SalonResponse
    │  pnpm generate:spec
    ▼
specs/tsp-output/@typespec/openapi3/generated/openapi.yaml
                                             components.schemas["Models.SalonResponse"]
    │  pnpm generate:api（orval）
    ▼
frontend/packages/api-client/src/generated/
    models/modelsSalonResponse.ts            interface ModelsSalonResponse
    endpoints/salons/salons.ts               useSalonCrudList() など
    │  import { ... } from '@beauty-salon-frontend/api-client'
    ▼
アプリの画面（portal-app の src/salons/salons-api.ts など）
```

生成の手順、生成物がコミット対象であること、`pnpm check:generated` による検査は [Type Generation System](./type-generation-system.md) にまとめてあります。バックエンドは同じ OpenAPI ドキュメントから別の型（`@beauty-salon-backend/generated`）を生成します。

## 生成クライアント（Orval）

設定は `frontend/packages/api-client/orval.config.ts` です。

| 設定 | 値 | 意味 |
|------|-----|------|
| `input.target` | `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml`（相対パスで指定） | 入力の OpenAPI ドキュメント |
| `output.mode` | `tags-split` | OpenAPI のタグごとにファイルを分ける |
| `output.target` / `output.schemas` | `./src/generated/endpoints` / `./src/generated/models` | 出力先 |
| `output.client` | `react-query` | TanStack Query 5 のフックを生成する |
| `output.httpClient` | `fetch` | fetch ベースの関数を生成する |
| `output.mock` | `false` | モックは生成しない |
| `output.clean` | `true` | 生成前に出力先を消す |
| `output.override.mutator` | `./src/mutator.ts` の `customInstance` | HTTP 呼び出しをこの関数に任せる |

`frontend/packages/api-client/src/mutator.ts` は `@beauty-salon-frontend/io` の `customInstance` を再エクスポートしているだけです。

### 生成されるもの（Salon の例）

`frontend/packages/api-client/src/generated/endpoints/salons/salons.ts` には、`SalonCrud` の操作ごとに次のものがあります。

| 操作 | fetch 関数 | フック | そのほか（主なもの） |
|------|------------|--------|----------|
| `GET /api/v1/salons` | `salonCrudList(params?)` | `useSalonCrudList(params?)` | `getSalonCrudListUrl`、`getSalonCrudListQueryKey`、`getSalonCrudListQueryOptions` |
| `POST /api/v1/salons` | `salonCrudCreate(body)` | `useSalonCrudCreate()` | `getSalonCrudCreateMutationOptions` |
| `GET /api/v1/salons/{id}` | `salonCrudGet(id)` | `useSalonCrudGet(id)` | `getSalonCrudGetQueryKey`、`getSalonCrudGetQueryOptions` |
| `PATCH /api/v1/salons/{id}` | `salonCrudUpdate(id, body)` | `useSalonCrudUpdate()` | `getSalonCrudUpdateMutationOptions` |
| `DELETE /api/v1/salons/{id}` | `salonCrudDelete(id)` | `useSalonCrudDelete()` | `getSalonCrudDeleteMutationOptions` |

型は `frontend/packages/api-client/src/generated/models/` にあります。

| 型 | 元になる定義 |
|----|--------------|
| `ModelsSalonResponse`、`ModelsSalonCreateRequest`、`ModelsSalonUpdateRequest` | TypeSpec の同名モデル（`Models.` 名前空間が接頭辞 `Models` になる） |
| `SalonCrudListParams` | 一覧のクエリパラメータ（`limit`、`cursor`、`keyword` など） |
| `SalonCrudList200`、`SalonCrudCreate201`、`SalonCrudGet200`、`SalonCrudUpdate200` | 成功レスポンスの本体（`data`、`meta`、`links`） |
| `ModelsProblemDetails` | エラーレスポンスの本体（RFC 9457 problem details） |
| `ModelsSalonId` | `string` の別名（ブランド型ではない） |

パッケージの入口は `.` だけです（`frontend/packages/api-client/src/index.ts` が endpoints と models をすべて再エクスポートする）。`generated/` 以下を直接 import するパスは公開されていません。

fetch 関数の戻り値の型は、ステータスコードで判別できるユニオンです。API のエラーは例外ではなく値として表されています。サーバーがどのルートでも返す 429 と 500、本文を受け取るオペレーションの 413 と 415、認証が必要なオペレーション（登録・更新・削除）の 401 と 403 もユニオンに含まれます（`salons.ts` より）。

```typescript
export type salonCrudListResponse200 = {
  data: SalonCrudList200
  status: 200
}

export type salonCrudListResponse400 = {
  data: ModelsProblemDetails
  status: 400
}
```

一覧はキーセット方式のページネーションです。次のページは `SalonCrudList200` の `meta.nextCursor` を `cursor` に渡して取得します。

## fetch ラッパー（`customInstance`）

実装は `frontend/packages/io/src/libs/fetcher/fetcher.ts` です。生成コードは、すべてのリクエストでこの関数を呼びます。

```typescript
// frontend/packages/io/src/libs/fetcher/fetcher.ts
export function customInstance<T>(url: string, options: RequestInit): Promise<T>
```

リクエスト:

- URL は `VITE_BACKEND_BASE_URL`（API サーバーのオリジン）に、生成コードのパス（`/api/v1/salons` など）をつなげたもの
- メソッド、ヘッダー、本文は生成コードが渡したものをそのまま送る。本文は生成コードが JSON にしているので、ここでは変換しない
- セッションが保存されていれば、`Authorization: Bearer <アクセストークン>` を付ける。期限切れの 401 には、セッションを再発行して、同じリクエストを 1 回だけ送り直す（[セッション](#セッション)）
- タイムアウトは 30 秒。呼び出し側が渡した `signal` があれば、それとタイムアウトのどちらでも中断される

レスポンス:

- **どの HTTP ステータスでも** `{ data, status, headers }` で resolve する。API のエラー応答は reject ではなく値で、呼び出し側が `status` で分岐する
- `data` は、`Content-Type` が `application/json` か `+json`（エラーの `application/problem+json`）なら JSON として読んだ値、本文が空（204）なら `undefined`、それ以外は文字列
- reject するのは、返すレスポンスがないときだけ: ネットワークの失敗、`signal` またはタイムアウトによる中断、`Content-Type` が JSON なのに本文が JSON として読めない、`VITE_BACKEND_BASE_URL` が設定されていない

知っておくべき制約:

- 型引数 `T` は生成コードがその操作について指定するレスポンスの型で、**実行時に本文を `T` と照合してはいません**。クライアントとサーバーが同じ OpenAPI ドキュメントから生成されていることが、型と実際の値が一致する根拠です
- JSON 以外の本文は文字列で返します。ファイルを返す操作のうち、売上レポートと台帳の CSV は文字列、顧客のデータの出力は JSON として読んだ値です。本文は `response.text()` で読むので、台帳の CSV の先頭の BOM は取り除かれます。ファイルとして保存させるときは、BOM を付け直します。ファイル名は `Content-Disposition` にありますが、`data` には入りません。`headers` から `fileNameOf` で読みます（`attachment; filename=customers-2026-11-20.csv`。ASCII の名前は引用符なしで来ます）。画面は API と別のオリジンにあるので、API は CORS で `Content-Disposition` を見せています（`Access-Control-Expose-Headers`）。保存は `saveFile({ name, type, content })` で、画面が持つファイルへのリンク（`download` に名前）を押させ、ブラウザーのダウンロードとして保存させます。バイナリを返す操作はありません
- `Authorization` ヘッダーは、この関数が付けます。呼び出し側が渡すものではありません。サインインしている間は、認証なしのオペレーション（サロンの一覧など）にも付きます。送り先は、いつも `VITE_BACKEND_BASE_URL` の API です

## セッション

サーバーのセッションは、アクセストークン（15 分）とリフレッシュトークンです（[認証と認可](./authentication.md#セッション)）。この節は、ブラウザーの側の決まりです。

### 保存（`io` の `sessionStore`）

実装は `frontend/packages/io/src/libs/session/stored-session.ts` です。

- 2 つのトークンと、その持ち主のユーザーの ID を、`localStorage` の 1 つのキー（`beauty-salon:session`）に、1 つの値として保存する。別々のキーに書くと、ほかのタブが、片方だけ新しい状態を読むことがあるため
- 値の形はクエリ文字列で、`URLSearchParams` で読む（読めない値に例外を投げないパーサー）。3 つの値がそろっていなければ、セッションがないものとして扱う
- `subscribe` で変更を購読できる。同じタブでの変更と、ほかのタブでの変更（`storage` イベント）の両方が伝わる。あるタブでサインアウトすると、ほかのタブもサインアウトの状態になる
- ブラウザーが `localStorage` へのアクセスを拒むとき（サイトのデータを保存させない設定の訪問者）は、セッションがないものとして扱う。サインインの要らない呼び出しは、そのまま行える。保存はできないので、その訪問者はサインインできない

`localStorage` に置く理由: API は、トークンを本文で受け渡しします（Cookie は使いません）。ページを読み込み直してもサインインが続くには、リフレッシュトークンを、スクリプトから読める場所に置く必要があります。そこに置く以上、アクセストークンをメモリだけに置いても、守れるものは増えません。備えは、トークンの側にあります。アクセストークンは 15 分で切れ、リフレッシュトークンは 1 回しか使えず、セッションは一覧から無効にできます。`rememberMe` で保存先を変えることはしません。セッションの長さは、サーバーが決めます。

### 401 の扱い（`io` の `customInstance`）

| API の応答 | すること |
|---|---|
| 401、コード `1003`（アクセストークンの期限切れ） | セッションを再発行し、同じリクエストを、新しいトークンで 1 回だけ送り直す。呼び出し側に返るのは、送り直した結果 |
| 401、コード `1004`（トークンに対応するセッションがない） | 保存されているトークンが、送ったものと同じなら、セッションを消す（サインアウトの状態になる）。違っていれば、送ったあとに再発行で替わったトークンなので、新しいトークンで 1 回だけ送り直す |
| そのほかの 401（ヘッダーなしの `1001`、サインインの失敗の `1002`、2 要素認証のコードの要求の `1007` など） | そのまま返す |

再発行（`frontend/packages/io/src/libs/session/renew-session.ts`）:

- **同時に 1 つだけ行う。** API は、リフレッシュトークンを 1 回しか受け付けず、再発行すると、それまでのトークンは使えなくなるため。同じページの中では、期限切れを受け取ったリクエストが、1 つの再発行を共有する。タブの間では、Web Locks API（`navigator.locks`）で順番に行う
- 再発行の前に、保存されているセッションを読み直す。ほかのリクエストやタブがすでに替えていれば、通信せずにそれを使う
- API が断ったら（401）、セッションを消す。呼び出し側には、元の 401 が返る。ただし、その時点で、保存されているセッションが別のものに替わっていれば（Web Locks のないブラウザーで、ほかのタブが先に再発行した）、消さずに、それで送り直す
- 通信の失敗、401 以外のステータス、読めない応答では、セッションを消さない。呼び出し側には、元の 401 が返る。次のリクエストが、もう一度再発行を試みる
- 期限の前に、先回りして再発行することはしない。期限切れの 401 を受けてから行う
- 再発行のリクエストは、`customInstance` が自分で送る（生成クライアントが `customInstance` を呼ぶので、その逆はできない）。再発行のパスと、2 つのエラーコードは `io` が持ち、`api-client` の `src/session.test.ts` が、生成されたものと同じであることを確かめる
- 応答から読むのは、エラーコードと、再発行の応答の 2 つのトークンとユーザーの ID だけ。形は `zod/mini` で確かめる（`zod` の全体は、アプリのバンドルに入れない）

### アプリのセッション（`@beauty-salon-frontend/session`）

```typescript
// frontend/packages/session/src/use-session.ts
export type Session =
  | { type: 'loading' }
  | { type: 'signedOut' }
  | { type: 'signedIn'; user: ModelsUserResponse }
  | { type: 'unavailable'; retry: () => void }

export const useSession = (): Session
```

- **サインインしているかどうか**は、保存されているセッションから決まる。どのタブでも同じになる
- **だれであるか**は、`GET /api/v1/auth/me` に尋ねる。尋ねるのは、ユーザーごと・ページの読み込みごとに 1 回で、フックを使うコンポーネントがいくつあっても変わらない。結果は古くならない（`staleTime` は無限）ので、あとから起きた一時的な失敗で、表示中の画面が消えることはない。ユーザーの内容を変える操作のあとは、`getAuthCrudGetCurrentUserQueryKey()` のクエリを無効にする。画面を保ったまま、取得し直す
- `unavailable` は、セッションはあるのに、API がだれのものかを答えなかった状態（応答がない、500、429 など）。`retry` で尋ね直す
- `signIn(request)` は、API が受け付けたら（200）セッションを保存する。戻り値は、画面が分岐するための直和型 `SignInOutcome` で、`signedIn`、`wrongCredentials`（401 の `1002`）、`twoFactorCodeRequired`（401 の `1007`）、`invalid`（400。`fields` に、API が受け付けなかった項目の名前）、`tooManyAttempts`（429）、`notStored`（API は受け付けたが、ブラウザーが保存を拒んだ。サインインしていない状態のまま）、`failed`（応答がない、500 など）のどれか
- `signOut()` は、API にセッションの終了を伝えてから、ブラウザーのセッションを消す。API がエラーを返しても、届かなくても、消す（共用のパソコンでサインアウトした人が、通信の失敗でサインインしたままにならないように）。そのとき、サーバーのセッションは期限まで残る
- `keepQueriesOfOneUser(queryClient)` は、保存されているユーザーが替わったとき（サインアウト、別の人のサインイン。ほかのタブでのものを含む）に、取得済みのデータをすべて消す。次にサインインした人に、前の人のデータを見せないため。同じユーザーのトークンの再発行では消さない。3つのアプリの `src/main.tsx` が、`QueryClient` を作ったところで呼んでいる

### 画面とサインイン

サインインに関わる画面の部品は、`session` パッケージにあります。3つのアプリの `src/App.tsx` が使います。

```tsx
// frontend/apps/admin-app/src/App.tsx
const ROLES: RequireSessionProps['roles'] = ['owner', 'manager', 'staff', 'admin']

<NotificationProvider>
  <AppShell title={import.meta.env.VITE_APP_TITLE} account={<SessionAccount />}>
    <RequireSession roles={ROLES}>
      <Routes>…</Routes>
    </RequireSession>
  </AppShell>
</NotificationProvider>
```

`RequireSession` は、囲んだ画面を、`roles` のどれかのロールでサインインしている人にだけ見せます。

| セッションの状態 | 表示 |
|---|---|
| サインインしていない | サインインの画面。**アドレスは変えない**（リダイレクトしない）ので、サインインすると、開こうとしていた画面がそのまま出る |
| だれであるかを確かめている | 「サインインを確認しています」 |
| サインインしていて、ロールが `roles` にある | 囲んだ画面 |
| サインインしていて、ロールが `roles` にない | 「このアプリケーションは利用できません」と、サインアウトのボタン |
| API がだれであるかを答えなかった | 「サインインを確認できません」と、「もう一度試す」のボタン |

| アプリ | 使えるロール |
|---|---|
| portal-app | サインインなしで見られる（いまあるのは、[サロンの画面](#サロンの画面)（トップページが、サロンを探す画面）、[アカウントの画面](#アカウントの画面)、存在しないパスのページ）。サインインの画面は `/sign-in` にあり、どのロールでもサインインできる。サインインすると、トップページへ移る。アドレスが、戻る先を持っていれば（`/sign-in?from=/salons/…`。サロンの詳細のレビューにある「サインイン」のリンクが、そのページを書く）、そこへ移る。戻る先として受け付けるのは、このアプリのパス（英数字、`-`、`_` の区切りだけ）で、ほかのサイトのアドレスなどは、トップページにする（`src/sign-in-path.ts`）。顧客だけの画面（[予約の画面](#予約の画面)）は、その画面を `RequireSession roles={CUSTOMERS}`（`src/roles.ts`）で囲む。サインインしていない人には、そのアドレスのまま、サインインの画面が出る。ロール `customer` でサインインしている間は、ヘッダーの下に「サロンを探す」と「予約の一覧」のリンクが出る（`src/navigation.ts` の `navigationFor`）。サインインしていない人と、ほかのロールのアカウントには、出ない |
| admin-app | `owner`、`manager`、`staff`、`admin`。すべての画面にサインインが要る |
| dashboard-app | `owner`、`manager`、`admin`。すべての画面にサインインが要る |

これは、画面を見せるかどうかの決まりです。操作を許すかどうかは、リクエストごとに API が決めます（[認可](./authentication.md#認可)）。

- **サインインの画面**（`SignInScreen`、フォームは `SignInForm`）は 2 段階。メールアドレスとパスワードを送り、API が 2 要素認証のコードを求めたら（401 の `1007`）、コードの入力に替わる（認証アプリの 6 桁のコードか、バックアップコード）。「30 日間サインインしたままにする」は `rememberMe` で、セッションの長さを決めるのはサーバー
- **断られたとき**は、メールアドレスとパスワードのどちらが誤っているかを言わない（API が区別しないため）。5 回続けて誤ると 15 分ロックされることを、同じメッセージで伝える。コードが誤っていたときは、コードの欄にそう表示する
- **フォームの値**は、ブラウザーが持つ（`value` を React の状態にしない）。送信のときに `FormData` として読み、純粋な関数 `readAttempt`（`sign-in-screen/sign-in-flow.ts`）が確かめる。空の欄と、メールアドレスの形でない値は、API に送らずに、その欄にメッセージを出す。API の応答からフォームの状態を決めるのも、純粋な関数 `afterAttempt`。送信は TanStack Query の `useMutation` で、送信中はボタンが `aria-busy` になり、2 回目の送信は無視する
- **メッセージ**は、欄のものは欄の下に（`aria-describedby`、`aria-invalid`）、試行の全体についてのものはフォームの先頭に `Alert` で出す。ブラウザーの検証の吹き出しは使わない（`noValidate`）。フォーカスは、誤りのある最初の欄へ移る
- **`SessionAccount`** は、ヘッダーのアカウント欄。サインインしている人のメールアドレスと、サインアウトのボタンを出す。狭い画面ではメールアドレスを隠す（読み上げには残る）。`signInHref` を渡すと、サインインしていない人にサインインの画面へのリンクを出す（portal-app）。`securityHref` を渡すと、サインアウトのボタンの前に「アカウントの安全」のリンクを出す（admin-app と dashboard-app。どちらにも、マイページがない）
- **サインアウト**すると、「サインアウトしました。」と通知し、サインインが要る画面はサインインの画面に替わる。ほかのタブも同じ状態になる
- **画面が替わったとき**は、`ui` の `AppShell` と `PageHeader` が、文書のタイトルを「画面の名前 | アプリの名前」にし、フォーカスを画面の見出し（`h1`）へ移す。サインインのあとも、サインアウトのあとも、ルートの移動でも同じ。ページを読み込んだ直後の最初の画面では、フォーカスを動かさない

### アカウントの画面

portal-app の `src/account/` に、サインインしていない人が使う、アカウントの画面があります。スタッフと管理者のアカウントも、パスワードの再設定は portal-app で行います（メールのリンクが指すのは、`PUBLIC_APP_URL` の 1 つのアプリだけのため）。admin-app と dashboard-app のサインインの画面は、portal-app の `/forgot-password` へのリンクを出します。

| パス | 画面 | 呼ぶ API（`/api/v1/auth` の下） |
|---|---|---|
| `/register` | アカウントの登録（メールアドレスとパスワード）。送ったあとは、確認メールの案内と、再送のボタン | `/register`、`/verify-email/send` |
| `/verify-email` | 確認メールのリンク先。「メールアドレスを確認する」のボタンを押すと、確認が済む。リンクが使えないとき、リンクなしで開いたときは、確認メールをもう一度送るフォーム | `/verify-email/confirm`、`/verify-email/send` |
| `/forgot-password` | 再設定のメールの要求（メールアドレス） | `/forgot-password` |
| `/reset-password` | 再設定のメールのリンク先。リンクが使えることを確かめてから、新しいパスワードを尋ねる | `/reset-password/verify`、`/reset-password` |
| `/accept-staff-invitation` | 招待のメールのリンク先。招待の内容（メールアドレス、役割、期限）を示し、アカウントのない人にはパスワードを尋ね、スタッフのアカウントを持つ人にはサインインを求める | `/staff-invitation/verify`、`/staff-invitation/accept`、`/staff-invitation/join` |

- **トークン**は、アドレスのフラグメント（`#token=`）から 1 回だけ読み、すぐにアドレスから取り除く（`useMailedToken`。履歴にも残さない）。読み込み直したページにはトークンがないので、メールのリンクから開くよう案内する
- **リンクを開いただけでは、何も変えない。** トークンを消費するリクエストは、ボタンを押したときに送る。メールのリンクを利用者より先に開くソフトウェア（スキャナー、プレビュー）が、リンクを使い切らないようにするため。消費しない確認（`/reset-password/verify`、`/staff-invitation/verify`）だけは、画面を開いたときに送る
- **アカウントがあるかどうかを、画面は言わない。** 登録と、メールの要求には、API がどちらの場合も同じ応答を返すので、そのあとの画面も同じことを言う
- **パスワード**は `ui` の `PasswordField`。「パスワードを表示する」で見られるので、確認のための 2 つ目の欄はない。送る前に確かめるのは、長さ（15〜128 文字。API と同じく、NFC に正規化したコードポイントで数える）だけ。推測されやすいパスワードは API が断り（`errors[].rule` が `blocklisted`）、その欄にそう表示する
- **使えないリンク**（期限切れ、使用済み、取り消し）を、API は区別しない。画面も理由を 1 つに決めず、次にできること（メールをもう一度送る、招待したサロンに伝える）を示す
- **API を呼ぶ関数**は `account-api.ts` にある。どれも reject せず、画面が区別する結果の直和型を返す（`accepted`、`tokenRefused`、`accountExists`、`invalid`、`tooManyAttempts`、`failed` など）。フォームの値の確かめと、応答からフォームの表示を決めるのは、`account-flow.ts` の純粋な関数。フォームは `ui` の `Form`
- **招待を受けたあと**は、admin-app へのリンクを出す（`VITE_ADMIN_APP_URL`）。セッションはアプリ（オリジン）ごとなので、admin-app ではあらためてサインインする
- プロフィール（氏名、電話番号）の登録は、ここにはない。はじめて予約するときに、[予約の画面](#予約の画面)が尋ねる。そのほかの項目の登録と、変更は、[マイページの画面](#マイページの画面)にある

### サロンの画面

portal-app の `src/salons/` に、サインインなしで見られる、サロンの画面があります。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/` | サロンを探す。キーワード（名前と紹介文）、都道府県、市区町村、評価（3.0 以上から 4.5 以上まで）で絞り込み、20 件ずつ表示する（「さらに表示」）。探すのは、予約を受け付けているサロンだけ（`isActive=true`） | `GET /salons` |
| `/salons/:salonId` | サロンの詳細。サロンについて（紹介文、住所、電話番号、メールアドレス、ウェブサイト、特徴）、営業時間（曜日ごとと、日付ごと）、メニュー（カテゴリーごとのサービス、所要時間、料金）、スタッフ、レビュー（評価のまとめと、10 件ずつの一覧。並び順は、新しい順、評価の高い順、参考になった順）。スタッフには、スタッフごとの評価（平均と件数）が出る。サインインしている顧客には、レビューごとに、「参考になった」と「通報する」のボタンが出る（自分のレビューには、「レビューを変更する」のリンク） | `GET /salons/{id}`、`GET /salons/{salonId}/service-categories`、`GET /salons/{salonId}/services`、`GET /staff-profiles`、`GET /salons/{salonId}/reviews/summary`、`GET /reviews`、スタッフごとに `GET /staff/{staffId}/reviews/summary`、顧客なら `GET /customers/me`、`POST /reviews/{id}/helpful`、`POST /reviews/{id}/report` |

- **検索条件は、アドレスのクエリにある**（`/?keyword=cut&prefecture=東京都&minRating=4`）。読み込み直しても、サロンの画面から戻っても、アドレスを人に渡しても、同じ検索になる。API が受け付けない値（選べない評価、長すぎる文字列）と、条件でないパラメーターは、エラーにせずに捨てる（`salon-search.ts` の `conditionsIn`）。都道府県と市区町村は、API が完全一致で探すので、サロンが登録した表記と同じものを入れる
- **API を呼ぶ関数**は `salons-api.ts` にある。どれも reject せず、画面が区別する結果の直和型を返す（`found`、`notFound`、`tooManyRequests`、`failed`）。クエリは必ず値で終わるので、画面は `isError` を見ずに、その値で分岐する。読めなかったときは、何が読めなかったかの知らせと、「もう一度読み込む」のボタンを出す
- **一覧の続き**は `useInfiniteQuery` で読む（API のカーソルが、ページのパラメーター）。足した分の先頭へ、フォーカスを移す。続きを読めなかったときは、読めた分を残して、その下に知らせと「もう一度読み込む」を出す
- **サロンの詳細の画面は、部分ごとに読む。** サロン、メニュー、スタッフ、評価のまとめ、レビューの一覧は、別々のクエリ。1 つが読めなくても、ほかの部分は表示される。メニューとスタッフは、最後まで読む（100 件ずつ、10 ページまで）
- **見せないもの**: 予約を受け付けていないサロンは、検索に出ない。アドレスを知っていれば詳細は開き、「このサロンは、現在、予約を受け付けていません。」と出る。メニューに出すのは、有効（`isActive`）で、提供中（`serviceStatus` が `active`）のサービスだけ。スタッフは、API が公開するプロフィール（`/staff-profiles`）のとおり。写真は出さない
- **日付と時刻、金額**は、ブラウザーの設定ではなく、サロンのタイムゾーン（`timezone`）と通貨（`currency`）で表示する（`salon-format.ts`）。日付ごとの営業時間は、サロンの今日からのものを、近い順に 14 件まで
- **存在しないサロン**（ID の形でないアドレス、どのサロンのものでもない ID、削除されたサロン）は、「サロンが見つかりません」の画面になる。ID の形でないものは、API に送らない
- **表示するだけの部品**（`components/`）は、API のモデルを props で受け取り、状態ごとのストーリーとテストを持つ。`ui` のカタログに、`Portal/Salons/…` として並ぶ。評価の星（`Rating`）、言葉の一覧（`TagList`）、文中のリンク（`Link`）は、`ui` にある
- **スタッフごとの評価**（`salons-api.ts` の `readStaffRatings`）: API の集計は、スタッフ 1 人ごと（`GET /staff/{staffId}/reviews/summary`）なので、スタッフを読んだあとに、その人数ぶんを、ひとまとまりで読む。クエリのキーは、スタッフを読んだ時刻を持ち、スタッフを読み直すと、評価も読み直す。名前の下に、平均と件数（`Rating`）、レビューのない人には「レビューは、まだありません」を出す。1 人ぶんでも読めなければ、スタッフの部分の中で、1 回だけ伝え（「スタッフの評価を読み込めませんでした」と「もう一度読み込む」）、紹介は、そのまま出る。その間に削除された人（404）には、何も出さない。サロンの詳細を開くたびに、リクエストが、スタッフの人数ぶん増える（`RATE_LIMIT_MAX_REQUESTS` を決めるときに、数に入れる）
- **レビューを読む人にできること**は、3 とおり（`src/reviews/reader-flow.ts` の `readerOf`）。サインインしていない人には、レビューの一覧の上に、サインインすると、参考になったと伝えたり、通報したりできることを、1 行で伝える（サインインへのリンク。サインインすると、このページへ戻る）。プロフィールのある顧客には、レビューごとに、「参考になった」と「通報する」のボタンを、自分のレビューには、「レビューを変更する」のリンク（`/mypage/reviews/:reviewId`）を出す。そのほか（サロンのアカウント、`admin`、プロフィールのないアカウント、プロフィールを読めなかったとき）には、何も足さない。レビューは、だれでも読める。ボタンの動きは、[レビューの画面](#レビューの画面)にある

### 予約の画面

portal-app の `src/bookings/` に、顧客が予約を入れ、自分の予約を見て、日時を変え、キャンセルする画面があります。ロール `customer` のアカウントでサインインして使います。サインインしていない人には、そのアドレスのまま、サインインの画面が出ます（「予約するには、サインインしてください。」）。サインインすると、開こうとした画面が出ます。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/services/:serviceId/booking` | 予約する。サロンの詳細のメニューにある「予約する」から開く。スタッフ（指名しない、または、そのサービスを担当できるスタッフ）と日付を選ぶと、その日の空いている開始時刻が出る。時刻を選び、要望を書いて、予約を入れる | `GET /salons/{id}`、`GET /salons/{salonId}/services/{id}`、`GET /staff-profiles`、`GET /customers/me`、`POST /customers/me`、`GET /salons/{salonId}/available-slots`、`POST /customers/me/bookings` |
| `/bookings` | 予約の一覧。これからの予約（今日からの予約）と、これまでの予約（`/bookings?when=past`。昨日までの予約）を、20 件ずつ表示する（「さらに表示」）。行は、日時、サロン、メニュー、状態で、日時が、予約の内容へのリンク | `GET /customers/me/bookings`、`GET /salons/{id}`、`GET /salons/{salonId}/services/{id}` |
| `/bookings/:bookingId` | 予約の内容。予約番号、状態、サロン、メニュー、担当、日時、料金、要望。始まる前の予約には、「日時を変更する」のリンクと、「予約をキャンセルする」のボタンが出る。来店が済んだ予約（`completed`）には、その下に、[レビュー](#レビューの画面)の部分が出る | `GET /customers/me/bookings/{id}`、`GET /salons/{id}`、`GET /salons/{salonId}/services/{id}`、`GET /staff-profiles`、`POST /customers/me/bookings/{id}/cancel`（レビューの部分が呼ぶものは、[レビューの画面](#レビューの画面)） |
| `/bookings/:bookingId/reschedule` | 日時の変更。いまの予約の内容の下に、予約するときと同じフォーム（スタッフ、日付、空いている開始時刻）が出る。要望の欄はない | `GET /customers/me/bookings/{id}`、`GET /salons/{id}`、`GET /salons/{salonId}/services/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/available-slots`、`POST /customers/me/bookings/{id}/reschedule` |

- **「予約する」のリンク**は、サロンの詳細のメニューの、オンラインで予約できるサービス（`allowOnlineBooking`）に出る。予約を受け付けていないサロン（`isActive` が偽）のメニューには出ない。リンクの名前は「（サービス名）を予約する」（`aria-label`）で、どのサービスのリンクかが、読み上げでもわかる
- **スタッフと日付は、アドレスのクエリにある**（`?staffId=…&date=2026-12-03`）。読み込み直しても、同じ日の時刻が出る。選び直すと、履歴を足さずに置き換えるので、「戻る」は、見た日を 1 つずつ戻らずに、この画面の前へ戻る。日付がなければ、サロンのタイムゾーンでの今日。過ぎた日、日付でない値、そのサービスを担当できないスタッフは、捨てる（`booking-choice.ts` の `choiceIn`）
- **選べるスタッフ**は、予約を受け付けていて（`canReceiveBookings`）、サービスの求めるレベル（`requiredStaffLevel`）以上のスタッフ。名前の順に並べる（API の一覧は ID の順で、意味のある順ではない）
- **空いている時刻は、表示するたびに読む。** 時刻は、だれかが予約するまでしか空いていないので、前に読んだものを出さない（クエリの `staleTime` と `gcTime` が 0）。一覧は、最後まで読む。時刻は、サロンのタイムゾーンで表示する
- **予約できる時刻がない日**（休業日、スタッフの休み、満席。API は理由を区別しない）は、「この日は、予約できる時刻がありません」と出し、送るボタンを出さない
- **予約が断られたとき**（409。選んだ時刻が、ほかの人に取られた、など。API は理由を区別しない）は、フォームがそう伝え、空いている時刻を読み直す。スタッフと日付の選択は、そのまま残る
- **はじめての予約**では、時刻の前に、お客様の情報（姓、名、電話番号、連絡の受け取り）を尋ねる。登録したばかりのアカウントには顧客のプロフィールがなく（`GET /customers/me` が 404）、API は、プロフィールのある顧客の予約だけを受ける。登録すると、同じ画面のまま、アドレスにある日の時刻へ進む
- **予約を入れたあと**は、予約の内容の画面へ移り、「予約を受け付けました。」と知らせる。予約は `pending`（確定待ち）で、サロンが確認すると確定する
- **予約の内容の画面**は、予約のほかに、サロン、サービス、スタッフを読んで、名前と、サロンのタイムゾーンでの日時、サロンの通貨での料金を出す。サロンが掲載を終えたサービスやスタッフは、「（掲載を終えています）」と出し、ほかはそのまま出す。ほかのアカウントの予約と、存在しない予約は、「予約が見つかりません」になる（API が、どちらも 404 を返す）
- **予約の一覧**は 2 つある。これからの予約は、予約日（`bookingDate`）が今日からのもの、これまでの予約は、昨日までのもの。今日は、ブラウザーのタイムゾーンでの今日（顧客は、タイムゾーンの違うサロンにも予約するので、サロンの今日ではない）。どちらを出すかは、アドレスにある（`/bookings` と `/bookings?when=past`）ので、読み込み直しても、予約の内容から戻っても、同じ一覧が出る。どちらも、開始日時の早い順（API の並び。並び順を選ぶパラメーターは、API にない）。キャンセルした予約も、その日の一覧に出る
- **一覧の行の名前**: 予約は、サロンとサービスを ID で持つ。一覧は、それぞれを 1 回ずつ読み（予約の内容の画面と同じクエリのキー）、名前のそろった予約から、順に行にする。名前がそろうまで、続きのボタンは読み込み中になる。名前を読めなかったときは、出せた行の下にそう出し、ボタンで読み直す。掲載を終えたサロンとサービスは、「サロン（掲載を終えています）」「メニュー（掲載を終えています）」と出す。サロンがなければ、タイムゾーンがわからないので、時刻を出さずに、予約日だけを出す
- **一覧は、表示するたびに読む**（`staleTime` が 0）。予約を入れたあと、キャンセルしたあと、日時を変えたあとは、前に読んだ一覧を捨てる（`removeQueries`）。一覧へ戻ったときに、変える前の内容が一瞬出ることがない
- **続きを表示したときのフォーカス**は、足された最初の行へ移る。移るのは、「さらに表示」を押したあとの 1 回だけ。押していないのに行が増えたとき（一覧を読み直した、名前があとから届いた）は、フォーカスを動かさない。サロンを探す画面の一覧も同じ
- **キャンセルと日時の変更ができる予約**は、`draft`、`pending`、`confirmed` で、開始日時より前のもの（`own-bookings.ts` の `isChangeable`。API の規則と同じ。[予約台帳](./bookings.md#顧客によるキャンセル)）。それ以外の予約には、リンクもボタンも出ない。日時の変更は、さらに、施術明細が 1 件で、その担当が予約の担当である予約だけ（`isMovable`。[予約台帳](./bookings.md#顧客による日時の変更)）。サロンが明細を足した予約には、リンクの代わりに「この予約の日時の変更は、サロンにお問い合わせください。」と出る。これらは、画面が何を出すかを決めるだけで、できるかどうかは、API が、呼ばれたときに決める
- **キャンセル**は、ダイアログで確かめてから送る（「予約をキャンセルしますか？」。予約の日時を示し、元に戻せないと伝える）。ダイアログを開くと、フォーカスは理由の欄に入る。Escape と「戻る」は、何も変えずに閉じ、フォーカスは、開いたボタンへ戻る。理由（`cancellationReason`）は、書いても書かなくてもよい。空欄は `null` で送る。キャンセルすると、「予約をキャンセルしました。」と知らせ、同じ画面に、キャンセルの状態で、リンクとボタンのない予約が出る。フォーカスのあったボタンがなくなるので、フォーカスは見出しへ移る
- **キャンセルできなかったとき**: 送れなかった（応答がない、リクエストが多すぎる）ときは、ダイアログの中でそう伝え、ダイアログも、書いた理由も残す。API が断った（409。サロンが予約を始めた、開始時刻を過ぎた、など。API は理由を区別しない）ときは、ダイアログを閉じ、画面にそう出して、予約を読み直す。予約がなくなっていた（404）ときは、読み直して、「予約が見つかりません」になる
- **日時の変更の画面**は、予約の担当スタッフと予約日を選んだ状態で開く（リンクのアドレスのクエリ。読み方は、予約する画面と同じ `booking-choice.ts`）。空いている時刻は、予約の長さ（`duration`）で読む。予約を入れたあとでサービスの施術時間が変わっていても、予約の長さは変わらない。空き枠の一覧は、動かす予約そのものも占有として数えるので、いまの予約の時間と重なる時刻は出ない（その予約を除いた一覧は、API にない。画面は、フォームの上にそう書く）。指名しないときは、その時刻に空いている最初のスタッフで送る
- **確定している予約の日時を変えると、確定待ちに戻る**（API の規則）。画面は、フォームの上で、先にそう伝える。変更すると、予約の内容の画面へ移り、「予約の日時を変更しました。」と知らせる
- **日時を変更できなかったとき**（409。選んだ時刻が先に取られた、予約が変更できない状態になった、など。API は理由を区別しない）は、フォームがそう伝え、空いている時刻を読み直す。スタッフと日付の選択は、そのまま残る。変更できない予約（キャンセルした予約、開始時刻を過ぎた予約）と、サロンが明細を足した予約のアドレスを開いたときは、フォームの代わりに、そう出す
- **API を呼ぶ関数**は `bookings-api.ts` にある。どれも reject せず、画面が区別する結果の直和型を返す。401 と 403 は、`failed` にまとめる（セッションが終われば、`RequireSession` がサインインの画面を出す）。フォームの値の確かめと、応答からフォームの表示を決めるのは、`booking-flow.ts` の純粋な関数。お客様の情報を読む関数と登録する関数、その値の確かめは、マイページの画面と同じもの（`src/profile/` の `profile-api.ts` と `profile-flow.ts`）。一覧のアドレス、API に渡す日付の範囲、行にする順、予約にできることを決めるのは、`own-bookings.ts` の純粋な関数
- **表示するだけの部品**（`components/`）は、予約のフォーム（`BookingForm`。予約するときと、日時を変えるときに使う。送るボタンの言葉と、時刻といっしょに送る欄は、使う側が渡す）、予約の内容（`BookingSummary`）、予約の一覧（`BookingList`）、予約にできること（`BookingChanges`。日時の変更へのリンクと、キャンセルのボタンとダイアログ）。`ui` のカタログに、`Portal/Bookings/…` として並ぶ。時刻の選択は、`ui` の `RadioGroup` の `layout='columns'`
- ここにないもの: 複数のサービスの予約、オプションの選択、一覧の並び順と、状態での絞り込み

### マイページの画面

portal-app の `src/profile/` に、顧客が、自分の会員の情報とお客様の情報（プロフィール）を見て、登録し、変更する画面があります。ロール `customer` のアカウントでサインインして使います。サインインしていない人には、そのアドレスのまま、サインインの画面が出ます（「マイページを見るには、サインインしてください。」）。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/mypage` | マイページ。会員の情報（会員ランク、ポイント、来店回数、初めての来店と最後の来店、紹介コード、サロンが記録した髪質、髪の太さ、頭皮の状態）と、お客様の情報（名前、フリガナ、メールアドレス、電話番号、予備の電話番号、住所、生年月日、性別、職業、好みのメニュー、サロンに伝えておきたいこと、受け取る連絡）。プロフィールのないアカウントには、登録の画面へのリンクが出る。プロフィールがあれば、その下に、[好みの設定](#好みの設定の画面)の部分と、[自分のレビュー](#レビューの画面)へのリンクが出る。最後に、プロフィールのないアカウントにも、[アカウントの安全](#アカウントの安全の画面)へのリンクが出る | `GET /customers/me`（好みの設定の部分が呼ぶものは、次の節） |
| `/mypage/profile` | お客様の情報の変更と、登録。プロフィールがあれば、いまの内容の入ったフォームが、なければ、空のフォームが出る | `GET /customers/me`、`PATCH /customers/me`、`POST /customers/me` |

- **会員の情報は、見るだけ。** 会員ランク、ポイント、来店回数、来店の日付、紹介コード、髪と頭皮の記録は、サロンと API が決める値で、顧客の変更のリクエスト（`CustomerProfileUpdateRequest`）にない。メールアドレスも、本人は変えられない（登録のときに、アカウントのメールアドレスが入り、そのあとは、サロンが台帳で直す）。フォームにメールアドレスの欄はなく、連絡先のまとまりの中で、そう伝える
- **値のない項目**は、空にせずに、言葉で出す（「未登録」、紹介コードは「未発行」、来店は「まだ来店がありません」、受け取る連絡がなければ「なし」）。名前だけがあって値のない行は、不具合に見えるため
- **マイページは、表示するたびに読む**（`staleTime` が 0）。ポイントと来店回数は、サロンが変える
- **フォームは 1 つ**（`ProfileForm`）。変更と登録で同じ欄を持ち、違うのは、送るボタンの言葉（「変更を保存する」「登録する」）と、開いたときの値だけ。欄は、お名前、連絡先、住所、ご本人について、好み、受け取る連絡の 6 つのまとまり（`fieldset`）に分かれる。欄の名前は、リクエストのプロパティの名前（入れ子のものは、`preferences.notes` のように、その道筋）
- **変更は、変えた項目だけを送る**（`profile-flow.ts` の `readProfileChange`）。`PATCH` は、リクエストにないプロパティをそのままにするので、フォームを開いている間にサロンが書き換えた、ほかの項目を上書きしない。比べるのは、送る形にした値（前後の空白を除き、空欄は `null`）。何も変えずに送ったときは、API を呼ばずに、「変更された項目はありません。」と知らせて、マイページへ戻る
- **フォームは、API のいまの内容で開く。** マイページが読んだ内容が残っていても、フォームの画面を開いてから読み終えた内容だけを使う（`isFetchedAfterMount`）。欄の値はブラウザーが持つので、あとから届いた内容では書き換わらない。開いている間は、読み直さない（ウィンドウに戻ったときと、通信が戻ったときの読み直しを止めている）。読み直しが失敗すると、フォームの代わりに知らせが出て、書いたものが消えるため
- **送る前に確かめるのは、API が受け付けない値だけ**: 姓と名（必須、100 文字まで）、電話番号（必須。数字、空白、`+`、`-`、かっこで、数字が 10 個以上、20 文字まで）、予備の電話番号（書いたときは、同じ形）、生年月日（1900 年 1 月 1 日から、ブラウザーの今日まで）、列の長さ（フリガナ 100、郵便番号 10、都道府県 50、市区町村 100、番地と建物名 255、職業 100）。誤りは、その欄の下に出し、最初の誤りの欄へフォーカスを移す
- **API が値を断ったとき**（400 の `errors[].field`）は、その欄に出す。好みのメニューの 1 つについての指摘（`preferences.preferredServices.0`）は、そのまとまりに出す。フォームに欄のない値だけが断られたときは、フォーム全体のメッセージになる
- **変更したあと**は、API の返した内容を、マイページが読むクエリに書き（`setQueryData`）、「お客様の情報を変更しました。」と知らせて、マイページへ移る。登録したあとも同じ（「お客様の情報を登録しました。」）
- **変更を送ったときに、プロフィールがなくなっていた**（404。サロンが顧客を台帳から削除すると、アカウントと顧客の結び付きがなくなる）ときは、同じ画面が登録のフォームに替わり、そのわけを伝える。フォーカスは、見出しへ移る。アカウントは、あらためて登録できる
- **登録が断られたとき**（409。ほかのタブで先に登録した、など。API は理由を区別しない）は、フォームがそう伝える
- **来店したことのある顧客の登録**: そういう顧客は、アカウントを作る前から台帳にいる。登録すると、API が、アカウントのメールアドレスでその顧客を引き継ぐ（[顧客台帳](./customers.md#プロフィールの作成と台帳の顧客の引き継ぎ)）。フォームに書いた値が台帳の値を置き換え、空欄のままにした項目は台帳の値が残る。会員ランクとポイントも残る。登録の前は、フォームは空で開く（API は、登録するまで、台帳の内容を本人に返さない）。登録のあとのマイページは、API の返した、合わせた内容を出す
- **フォームの画面の見出しは、どの状態でも同じ**（「お客様の情報」）。どちらのフォームを出すかは、読んでからわかる。読んだあとで見出しを変えると、枠（`AppShell`）が、別の画面に替わったものとして、フォーカスを見出しへ移す
- **ヘッダーのリンク**に、「マイページ」が加わる。`/mypage/profile` でも、このリンクが現在の画面になる（`navigation.ts`）
- **API を呼ぶ関数**は `profile-api.ts` にある（`readOwnProfile`、`createOwnProfile`、`updateOwnProfile`）。どれも reject せず、画面が区別する結果の直和型を返す。プロフィールは、どの画面も、同じクエリのキー（`OWN_PROFILE`）で読む。表示の言葉（会員ランク、性別、メニューの種類、髪の記録、日付、ポイント）は、`profile-format.ts` の純粋な関数
- **表示するだけの部品**（`components/`）は、会員の情報（`MembershipDetails`）、お客様の情報（`ProfileDetails`）、フォーム（`ProfileForm`）。`ui` のカタログに、`Portal/Profile/…` として並ぶ。好みのメニューの選択は、`ui` の `CheckboxGroup`
- パスワードの変更、サインインしている端末、2 要素認証は、[アカウントの安全の画面](#アカウントの安全の画面)にある

### 好みの設定の画面

portal-app の `src/preferences/` に、顧客が、自分の好みの設定（指名したいスタッフ、避けたいスタッフ、希望する時間帯、スタイルの好み、接客の好み、特別な要望）を見て、変更する画面があります。ロール `customer` のアカウントでサインインして使います。サインインしていない人には、そのアドレスのまま、サインインの画面が出ます（「好みの設定を変更するには、サインインしてください。」）。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/mypage` | マイページの「好みの設定」の部分（`OwnPreferences`）。プロフィールのあるアカウントに出る | `GET /customers/me/preferences`、保存されているスタッフごとに `GET /staff-profiles/{id}`、そのサロンごとに `GET /salons/{id}` |
| `/mypage/preferences` | 好みの設定の変更 | 上の 3 つと、`GET /customers/me/bookings`、予約のあるサロンごとに `GET /staff-profiles?salonId=`、`PATCH /customers/me/preferences` |

- **好みの設定は、プロフィールのある顧客のもの。** 一度も書いていない顧客には、API が空の値を返す（行は、最初の変更で作られる）ので、マイページの部分は、どの項目も「指定なし」と出す。プロフィールのないアカウント（404）には、変更の画面が「好みの設定は、お客様の情報を登録すると使えます」と伝え、登録の画面へ案内する。マイページは、プロフィールがなければ、この部分を出さず、好みの設定を API に問い合わせない
- **部分は、表示するたびに読む**（`staleTime` が 0）。サロンも、顧客の好みの設定を台帳で書き換える。読めなかったときは、マイページのほかの部分をそのままに、この部分の中で伝える
- **選べるスタッフは、予約したことのあるサロンのスタッフ。** 好みの設定は、サロンごとではなく、顧客に 1 つで、API は、削除されていないスタッフなら、どのサロンの人でも受け付ける。画面は、顧客の予約（来店前、来店済み、キャンセルしたものを問わない）のあるサロンが公開しているスタッフ（`GET /staff-profiles?salonId=`。予約を受けていないスタッフを含む）と、すでに保存されていて、いまも公開されているスタッフを、サロンの名前を添えて出す（「Hiroshi Tanaka（Beauty Studio Tokyo）」）。サロンは名前の順、スタッフは API の返す順。出せるスタッフのいない顧客のフォームには、スタッフの欄がなく、「指名したいスタッフと、避けたいスタッフは、サロンを予約すると選べるようになります。」と伝える
- **サロンが公開しなくなったスタッフ**（在籍していない、削除された）は、保存されていても、マイページの部分にもフォームにも出ない。フォームは、その値を送らないので、顧客がその欄を変えない限り、保存されたまま残る。欄を変えると、選んだ値に置き換わる
- **フォームが開くまでに読むものは、ひとまとまり**（`readOwnPreferencesToChange`）: 好みの設定、予約のあるサロン、そのスタッフ、保存されているスタッフ、サロンの名前。どれかが読めなければ、フォームは出ずに、読めなかったと伝える。選べるものが半分だけのフォームは出ない。API のいまの内容で開くことと、開いている間に読み直さないことは、お客様の情報のフォームと同じ
- **希望する時間帯は、行を足し、行を消す**（`TimeSlotFields`）。曜日はない（API のモデルにない。フォームがそう伝える）。行を足すと、その行の開始の欄へ、行を消すと、「時間帯を追加する」のボタンへ、フォーカスが移る。何も書いていない行は送らず、片方だけ書いた行は誤り。終了は開始より後で、ほかの行と重ならないこと（接するのはよい）。API と同じ決まりを、送る前に確かめる。行の順は、フォームの順のまま保存される
- **好きな色、避けたいスタイル、参考の画像の URL は、1 行に 1 つずつ書く。** 前後の空白と空の行を除き、同じ値は 1 つにして送る。画像の URL は、`http://` か `https://` で始まる、500 文字までのもの。誤りは、行を伝える（「2 行目を確かめてください。…」）。マイページの部分は、画像をリンクとして出し、読み込まない
- **変更は、変えた項目だけを送る**（`preferences` パッケージの `readPreferencesChange`。サロンが[顧客台帳](#顧客台帳の画面)で直すときも同じ）。スタイルの好み（希望の長さ、好きな色、避けたいスタイル、参考の画像）は、API が全体を置き換えるので、1 つでも変えたら 4 つをまとめて送り、4 つとも空なら `null` を送る。何も変えずに送ったときは、API を呼ばずに、「変更された項目はありません。」と知らせて、マイページへ戻る
- **指名したいスタッフは、避けたいスタッフに選べない。** フォームは、送る前に確かめる。片方だけを送ったときは、API が、保存されているもう片方と比べる。フォームを開いている間にサロンが書き換えていて断られたとき（400。`preferredStaffId` の `avoided`）と、選んだスタッフがその間に削除されていたとき（`not_found`）は、その欄に出す。時間帯についての指摘は、フォーム全体のメッセージになる（空の行を送らないので、送った行の番号が、フォームの行の番号と同じとは限らない）
- **変更したあと**は、API の返した内容を、部分のクエリ（`OWN_PREFERENCES`）に書き（`setQueryData`）、「好みの設定を変更しました。」と知らせて、マイページへ移る
- **変更を送ったときに、プロフィールがなくなっていた**（404）ときは、同じ画面が、登録への案内に替わり、そのわけを伝える（「お客様の情報が見つからなかったため、変更を保存できませんでした。」）。フォーカスは、見出しへ移る。マイページのクエリにも、プロフィールがないと書くので、マイページは、読み直す前から、登録への案内を出す
- **API を呼ぶ関数**は `preferences-api.ts` にある（`readOwnPreferences`、`readOwnPreferencesToChange`、`updateOwnPreferences`）。どれも reject せず、画面が区別する結果の直和型を返す。予約のあるサロンは、`bookings-api.ts` の `readBookedSalonIds` が、予約を 100 件ずつ、最後まで読んで求める。選べるスタッフの並びと表示は `preferences` パッケージの `staffChoicesOf`、表示の言葉は `preferences-format.ts` の純粋な関数
- **表示するだけの部品**は、好みの設定（`components/` の `PreferencesDetails`。`ui` のカタログに、`Portal/Preferences/…` として並ぶ）と、`preferences` パッケージのフォーム（`PreferencesForm`）と時間帯の行（`TimeSlotFields`。カタログの `Preferences/…`）
- ここにないもの: サロンごとの好みの設定（API にない）、曜日ごとの時間帯（API にない）、画像のアップロード（参考の画像は、URL で伝える）

### レビューの画面

portal-app の `src/reviews/` に、顧客が、来店したサロンのレビューを書き、自分の書いたレビューを見て、変更し、削除する画面があります。ロール `customer` のアカウントでサインインして使います。サインインしていない人には、そのアドレスのまま、サインインの画面が出ます（「レビューを書くには、サインインしてください。」など）。レビューの決まり（だれが、どの来店について書けるか）は、[レビュー](./reviews.md)にあります。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/bookings/:bookingId` | 予約の内容の画面の「レビュー」の部分（`BookingReview`）。来店が済んだ予約（`completed`）に出る。レビューがあれば、その内容と「レビューを変更する」のリンク、なければ、「レビューを書く」のリンク | `GET /reviews?bookingId=` |
| `/bookings/:bookingId/review` | レビューを書く。どの来店か（サロン、来店日時）の下に、フォーム（総合の評価、評価するスタッフ、項目ごとの評価、タイトル、本文、写真の URL）が出る | `GET /customers/me/bookings/{id}`、`GET /customers/me`、`GET /reviews?bookingId=`、`GET /salons/{id}`、`GET /staff-profiles?salonId=`、`POST /reviews` |
| `/mypage/reviews` | 自分のレビュー。新しい順に、10 件ずつ（「さらに表示」）。レビューごとに、サロン（詳細へのリンク）、評価したスタッフ、レビューの内容、サロンからの返信、「変更する」のリンクと「削除する」のボタン | `GET /customers/me`、`GET /reviews?customerId=`、レビューのサロンごとに `GET /salons/{id}`、スタッフを評価したレビューのサロンごとに `GET /staff-profiles?salonId=`、`DELETE /reviews/{id}` |
| `/mypage/reviews/:reviewId` | レビューを変更する。どのレビューか（サロン、投稿日）の下に、いまの内容の入ったフォームが出る | `GET /reviews/{id}`、`GET /customers/me`、`GET /salons/{id}`、`GET /staff-profiles?salonId=`、`PATCH /reviews/{id}` |

- **レビューを書けるのは、来店が済んだ予約だけ。** 予約の内容の画面は、`completed` の予約にだけ、「レビュー」の部分を出す。レビューを書く画面のアドレスを直接開いたときは、書けないわけを、フォームの代わりに出す: 来店が済んでいない予約（「この予約は、まだ来店が済んでいません」）、レビューのある来店（「この来店のレビューは、投稿済みです」。変更の画面へのリンクが出る）、掲載を終えたサロン（「このサロンは、掲載を終えています」）、ほかのアカウントの予約と存在しない予約（「予約が見つかりません」）
- **予約の内容の画面の「レビュー」の部分**（`booking-review.tsx` の `BookingReview`）は、自分のクエリで、表示するたびに読む（`staleTime` が 0。サロンは返信を書き、管理者はレビューを消す）。読めなかったときは、この部分の中で伝え、予約の内容は、そのまま出る。掲載を終えたサロンの予約では、レビューを問い合わせずに、「掲載を終えたサロンのレビューは、書けません。」と出す（API は、そのサロンのレビューを返さず、受け付けない）
- **フォームが開くまでに読むものは、ひとまとまり**（`reviews-api.ts` の `readVisitToReview`）: 予約、書く人（プロフィールの顧客の ID）、その来店のレビュー、サロン、サロンのスタッフ。どれかが読めなければ、フォームは出ずに、読めなかったと伝える
- **評価できるスタッフは、その予約を担当した人**（`review-staff.ts` の `reviewersOf`）: 予約の担当、続いて、施術明細の担当。同じ人は 1 回だけで、サロンがいま公開している人に限る（API が受け付けるのも、この人たちだけ）。フォームは、予約の担当を選んだ状態で開く。「スタッフを評価しない」を選ぶと、項目ごとの評価から「スタッフ」の欄がなくなり、スタッフの評価のないレビューになる。評価できる人がいない来店のフォームには、スタッフの欄がなく、そう伝える
- **フォームは 1 つ**（`ReviewForm`）。書くときと変更するときで同じ欄を持つ。違うのは、送るボタンの言葉と、スタッフの欄: 評価するスタッフは、投稿したあとで変えられない（API の変更のリクエストにない）ので、変更の画面は、選ぶ欄の代わりに、だれを評価しているか（評価していないか）を文で伝える。評価されたスタッフが掲載を終えていれば、「スタッフ（掲載を終えています）」と出す
- **送る前に確かめるのは、API が受け付けない値だけ**（`review-flow.ts`）: 総合の評価（必須）、タイトル（255 文字まで）、写真の URL（`http://` か `https://` で始まる、500 文字までのものを、1 行に 1 つずつ、10 個まで。誤りは、行を伝える）。前後の空白を除き、空欄は `null`、同じ URL は 1 つにして送る。誤りは、その欄の下に出し、最初の誤りの欄へフォーカスを移す。総合の評価の誤りでは、フォーカスは、その中の最初のボタンに入る
- **写真は、URL で伝える**（API は、画像のアップロードではなく、URL の一覧を受ける）。画面は、写真をリンクとして出し、読み込まない。リンクには `rel="noreferrer nofollow ugc"` が付く
- **投稿が断られたとき**: 来店そのものについて断られた（409。その間にほかのタブで投稿した、など。400 が `bookingId`、`salonId`、`customerId` を指したときも同じ）ときは、来店を読み直し、いまの状態を出す。フォームがなくなったときは、「このレビューは、投稿できませんでした。」と伝え、フォーカスを見出しへ移す。選んだスタッフが、その間に削除されていた（400。`staffId` の `not_found`）ときは、その欄に出し、書いた内容は残る。送れなかった（応答がない、リクエストが多すぎる）ときは、フォームの中でそう伝える
- **変更は、変えた項目だけを送る**（`readReviewChange`）。フォームを開いている間に、ほかのタブで変えた、ほかの項目を上書きしない。何も変えずに送ったときは、API を呼ばずに、「変更された項目はありません。」と知らせて、一覧へ戻る
- **変更できるのは、自分のレビューだけ。** レビューは、だれでも読める（`GET /reviews/{id}` は公開）ので、変更の画面は、レビューの顧客が、プロフィールの顧客であることを確かめる。ほかの人のレビュー、存在しないレビュー、ID でない値のアドレスは、「レビューが見つかりません」になる。変更を送ったときに、レビューがなくなっていた（404。管理者が削除した、など）ときも、同じ画面がそう替わり、わけを伝えて、フォーカスを見出しへ移す
- **フォームは、API のいまの内容で開き、開いている間は読み直さない。** お客様の情報のフォームと同じ（`isFetchedAfterMount`。ウィンドウに戻ったときと、通信が戻ったときの読み直しを止めている）
- **自分のレビューの一覧**は、表示するたびに読む（`staleTime` が 0）。サロンの返信と「参考になった」の数は、ほかの人が変える。サロンとスタッフの名前は、レビューの持つ ID（`salonId`、`staffId`）から読む。掲載を終えたサロンのレビューは、API が一覧に返さない。プロフィールのないアカウントには、レビューがなく、書ける来店もないので、お客様の情報の登録を案内する（「レビューは、お客様の情報を登録すると書けます」）。続きを表示すると、足された最初のレビューのサロンのリンクへ、フォーカスが移る
- **同じ言葉のリンクとボタン**（「変更する」「削除する」）は、どのレビューのものかを、名前に持つ（`aria-label`。「Hair & Spa Osaka（2026年11月19日 投稿）のレビューを変更する」）
- **削除**は、ダイアログで確かめてから送る（「レビューを削除しますか？」。どのレビューかを示し、サロンからの返信とともに消えて、元に戻せないことと、その来店のレビューは、もう一度書けることを伝える）。Escape と「戻る」は、何も変えずに閉じ、フォーカスは、開いたボタンへ戻る。削除すると、「レビューを削除しました。」と知らせ、一覧を読み直す。フォーカスのあったボタンは、一覧とともになくなるので、フォーカスは見出しへ移る。送れなかったときは、ダイアログの中でそう伝え、ダイアログを残す。すでに削除されていた（404）ときは、削除できたものとして扱う
- **レビューを書いた、変えた、消したあと**（`review-cache.ts` の `afterReviewWrite`）は、その来店のレビューのクエリに、API の返した内容（消したときは、レビューがないこと）を書き、自分のレビューの一覧を読み直し（`resetQueries`。一覧が画面に出ているときも、前の内容を出さない）、そのサロンの詳細が読んだもの（サロン、評価のまとめ、レビューの一覧）と、サロンを探す画面の検索の結果を捨てる（`removeQueries`。サロンの評価と件数は、レビューを書くたびに、API が数え直す）。どの画面へ移っても、書く前の内容が一瞬出ることがない
- **見出しは、どの状態でも同じ**（「レビューを書く」「レビューを変更する」）。フォームを出すか、書けないわけを出すかは、読んでからわかる。お客様の情報のフォームと同じ
- **ヘッダーのリンク**は、レビューを書く画面では「予約の一覧」が、自分のレビューの画面と変更の画面では「マイページ」が、現在の画面になる
- **API を呼ぶ関数**は `reviews-api.ts` にある（`readReviewOfBooking`、`readVisitToReview`、`readOwnReviews`、`readOwnReviewToChange`、`writeReview`、`changeReview`、`removeReview`）。どれも reject せず、画面が区別する結果の直和型を返す。フォームの値の確かめと、応答からフォームの表示を決めるのは、`review-flow.ts`、一覧の言葉は `review-format.ts` の純粋な関数
- **表示するだけの部品**（`components/`）は、フォーム（`ReviewForm`）、自分のレビューの一覧（`OwnReviewList`）、削除を確かめるダイアログ（`ReviewRemoval`）、通報のダイアログ（`ReviewReport`）。レビューの内容（`ReviewContent`。評価、日付、タイトル、本文、項目ごとの評価、写真、「参考になった」の数、サロンからの返信）は、サロンの詳細のレビューの一覧と同じ部品で、`src/salons/components/` にある。`ui` のカタログに、`Portal/Reviews/…` と `Portal/Salons/ReviewContent` として並ぶ
- **サロンの詳細で、ほかの人のレビューにできること**（`src/salons/salon-screen.tsx` の「レビュー」の部分。だれにボタンを出すかは、[サロンの画面](#サロンの画面)）。同じ言葉のボタンは、どのレビューのものかを、名前に持つ（`aria-label`。「「Great experience」（2026年11月19日 投稿）のレビューが参考になった」。タイトルのないレビューは、投稿日だけ。`salon-format.ts` の `postedOf`）
- **「参考になった」**（`POST /reviews/{id}/helpful`）: 押すと、そのレビューの数を、API の返した数に替え、ボタンは、押された状態（`aria-pressed`）になる。フォーカスは、ボタンに残る。通知でも伝える（「「参考になった」と伝えました。」）。押されたボタンを、もう一度押しても、何も送らない（取り消しは、API にない）。API は、だれが評価したかを返さないので、ページを開き直すと、ボタンは、押されていない状態で出る。そこで押すと、数は変わらずに、押された状態になる（API は、同じ顧客の 2 回目を、数を変えずに 200 で返す）
- **押したあとの一覧**（`review-cache.ts` の `afterHelpfulCounted`）: いま出ている並びでは、数だけを替え、並びは変えない（読んでいる途中で、レビューが動かない）。その並びは、次に選ばれたときに読み直す（`invalidateQueries` の `refetchType: 'none'`）。ほかの並びで読んであった内容は、捨てる
- **通報**（`POST /reviews/{id}/report`）は、ダイアログのフォームで送る（`components/review-report/` の `ReviewReport`。「レビューを通報する」）。理由は、5 つから 1 つ（必須。不適切な表現、事実と違う内容、個人情報、宣伝や来店と関係のない内容、その他）。詳しい内容は、2000 文字までで、理由が「その他」なら必須。前後の空白を除き、空なら `null` を送る（`reader-flow.ts` の `readReport`）。誤りは、その欄に出し、フォーカスを移す（理由の誤りでは、最初の理由へ）。ダイアログを開くと、フォーカスは、最初の理由に入る。ダイアログは、開くたびに、新しいフォームになる（前に書いた内容と、前の誤りは、残らない）
- **通報したあと**は、ダイアログを閉じ、運営が内容を確かめることと、確かめが済むまで、レビューは掲載されたままであることを、通知で伝える。フォーカスは、そのレビューの「通報する」のボタンへ戻る。レビューは、変わらない
- **すでに通報していたとき**（409。その通報が却下されていても同じ）は、ダイアログの中で、フォームの代わりに、そう伝える（「このレビューは、すでに通報しています。1 つのレビューを通報できるのは、1 回です。」）。残るのは「閉じる」だけで、フォーカスは、そこへ移る。API は、通報したかどうかを、前もっては返さない
- **その間にレビューが消えていたとき**（「参考になった」と通報の 404。書いた人か `admin` が消した）は、「このレビューは、削除されていました。レビューを読み込み直します。」と知らせ、読んであった一覧から、そのレビューを除き、レビューの一覧、評価のまとめ、サロン、スタッフごとの評価を、出したまま読み直す（`afterReviewGone`）。ダイアログは、閉じるのではなく、取り除く（閉じたダイアログは、開いたボタンへフォーカスを戻すが、そのボタンは、レビューとともになくなる）。フォーカスは、「レビュー」の見出しへ移る（`ui` の `Card` の `headingRef`）
- **やり直せる失敗**（応答がない、リクエストが多すぎる、サーバーの誤り）: 「参考になった」は、通知で伝え、ボタンは、押されていないまま残る。通報は、ダイアログの中で伝え、書いた内容は残る
- **レビューを書いた、変えた、消したあと**（`afterReviewWrite`）に捨てるものには、スタッフごとの評価も入る。スタッフを評価したレビューは、その人の集計に入る
- **API を呼ぶ関数**は、`reviews-api.ts` の `sayHelpful` と `reportReview`、`salons-api.ts` の `readStaffRatings`。応答からフォームの表示を決めるのは、`reader-flow.ts` の `afterReport` と `afterHelpful`
- ここにないもの: 写真のアップロード、「参考になった」の取り消し（API にない）、サロンからの通報と、通報の扱い（admin-app と dashboard-app の単位）

### 共有リンクの画面

portal-app の `src/share/` に、サロンが共有したファイル（施術の写真、同意書など）を、アカウントを持たない人（お客様、取引先）が見て、保存する画面があります。サロンが発行した共有リンクのトークンが、見る権利になります。共有リンクの決まりは[添付ファイルの共有リンク](./attachments.md#共有リンク)にあります。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/share#token=<トークン>` | 共有されたファイル。ファイル名、種類、サイズと「ファイルを読み込む」。パスワードのある共有リンクでは、先にパスワードの欄。読み込んだあとは、画像なら画像と、「新しいタブで開く」と「保存する」 | `POST /share/file`（開いたときはパスワードなしで、パスワードを入れたときはパスワードを付けて）、`POST /share/download-url`（「ファイルを読み込む」を押したとき）、ストレージへの `GET`（ダウンロード用 URL） |

- **だれでも使う**: サインインしていても、していなくても同じ（API が `Authorization` を見ない）。入口はナビゲーションではなく、受け取ったリンク
- **トークン**は、アドレスのフラグメントで受け取り、読んだらアドレスから消す（メールのリンクの画面と同じ `useMailedToken`）。サーバーにも、アドレスバーにも、履歴にも残らない。同じタブで別の共有リンクを開くと、フラグメントだけが変わるので、そのトークンに替え、前のリンクのものは何も残さない（画面を、トークンを `key` にして描き直す）。トークンのないアドレス（読み込み直したページ）は、受け取ったリンクから開き直すよう言い、API に何も尋ねない
- **開いても数えない**: 開いたときに読むのは、ファイルの名前、種類、サイズだけ（`POST /share/file`）。共有リンクが数えるのは、ダウンロード用 URL の発行
- **ファイルを読み込む**: 押したときに、ダウンロード用 URL を 1 回だけ発行し（1 回と数える）、ブラウザーがストレージからファイルを読んで、画面の中（オブジェクト URL）に持つ。画像の表示、新しいタブで開くこと、保存は、その持っているファイルから行うので、もう数えない。ファイルの種類は、ストレージの応答ではなく、API が言った種類にする。ボタンのそばで、読み込むたびに 1 回と数えることを言う。読み込んだら、「ファイル」の見出しにフォーカスを移す。画面を閉じると、ファイルを手放す
- **パスワード**: 保護された共有リンクは、開いたときに 403 になるので、パスワードの欄を出す（ファイルの名前は出さない）。空なら送らずに欄で言う。長さは確かめない（発行のときの規則を、見る人は知らない）。違えば、違うか、5 回続けて間違えたために 15 分のあいだ使えなくなっていると、欄で言う（API はロックを区別しない）。正しければ、画面がパスワードを持ち、読み込むときにも送る（ほかには、どこにも置かない）。読み込むときに 403 になった（ほかの人の間違いでロックされた）ときは、もう一度パスワードを尋ねる。パスワードの欄は `autocomplete='off'`（共有リンクのパスワードを、パスワードの管理に覚えさせない）
- **開けない共有リンク**（404）: 失効、期限切れ、回数の上限、ファイルの削除を、API は区別しないので、「この共有リンクは開けません」と、考えられる理由と、共有したサロンに尋ねることを言う。読み込むときに 404 になったときも同じ
- **ストレージがファイルを返さなかったとき**は、1 回と数えられたことと、読み込み直すともう 1 回と数えることを言い、もう一度読み込める
- **ストレージの CORS**: ブラウザーがストレージからファイルを `GET` で読むので、バケットの CORS は、portal のオリジンからの `GET` も許す必要がある（ローカルの SeaweedFS とテストサーバーのストレージは、どのオリジンにも許す）
- **API を呼ぶ関数**は `src/share/share-api.ts`（ファイルの情報と、ファイルの読み込み）。reject せず、画面が区別する結果の直和型を返す。種類とサイズの言い方、パスワードの欄の確かめ、言うことは `shared-file.ts` の純粋な関数
- **表示するだけの部品**は `SharedFileRecord`（ファイルの言葉、読み込みのボタン、読み込んだファイルとそのリンク）。`ui` のカタログに、`Portal/Share/SharedFileRecord` として並ぶ
- **この画面にないもの**: 共有リンクの発行、一覧、取り消し（admin-app の[共有リンクの発行と管理の画面](#共有リンクの発行と管理の画面)）

### アカウントの安全の画面

`session` パッケージの `src/security/` に、サインインしているアカウントのパスワードを変え、どの端末でサインインしているかを確かめ、端末をサインアウトさせ、2 要素認証を設定し、変える画面があります。パスワードとセッションと 2 要素認証は、どのロールのアカウントにもあるので、3 つのアプリが、同じ画面を、それぞれのアドレスに置きます。決まりは、[認証と認可](./authentication.md) の「セッション」「パスワードの変更」「2 要素認証」です。

| アプリ | パス | 画面 | 呼ぶ API |
|---|---|---|---|
| portal-app（顧客だけ。マイページの「アカウントの安全」のカードから） | `/mypage/security` | アカウントの安全。「パスワード」（最後に変更した日時と、「パスワードを変更する」）、「2 要素認証」（状態と、状態ごとの操作）、「サインインしている端末」（端末ごとの、サインインした日時、ブラウザー、IP アドレス、最後に使われた日時、サインインが切れる日時。「この端末」の印。ほかの端末の「サインアウトさせる」。「すべての端末でサインアウトする」） | `GET /auth/me`、`GET /auth/sessions`、`DELETE /auth/sessions/{sessionId}`、`POST /auth/logout-all`、`POST /auth/2fa/backup-codes`、`POST /auth/2fa/disable` |
| portal-app | `/mypage/security/password` | パスワードを変更する（現在のパスワードと、新しいパスワード） | `POST /auth/change-password` |
| portal-app | `/mypage/security/two-factor` | 2 要素認証を設定する。3 つの段階: パスワードを確かめる → 認証アプリに登録する（QR コードと、手で入力するキー）と、認証アプリのコードを確かめる → バックアップコード | `GET /auth/me`、`POST /auth/2fa/enable`、`POST /auth/2fa/verify` |
| admin-app と dashboard-app（そのアプリを使えるロール。ヘッダーの「アカウントの安全」から） | `/account/security`、`/account/security/password`、`/account/security/two-factor` | 同じ 3 つの画面 | 同じ |

- **画面は、ルーターを知らない。** `AccountSecurityScreen` は、パスワードの変更の画面と 2 要素認証の設定の画面のアドレス（`passwordHref`、`twoFactorHref`）と、見出しの横に置くもの（`actions`。portal-app の「マイページへ戻る」）を受け取る。`PasswordChangeScreen` は、戻る先（`securityHref`）と、変更したあとに呼ぶ `onChanged` を受け取り、アプリが `navigate` で戻る
- **選ぶパスワードの規則**（15〜128 文字。API と同じく、NFC にした文字で数える。推測されやすいものは、API が断る）と、その言葉は、`src/security/password-rule.ts` にあり、portal-app の登録、再設定、招待の受け入れのフォームも、ここから使う
- **変更のフォーム**は、現在のパスワードと、新しいパスワード（規則の説明つき）。どちらも、書いたとおりに送る。確認のための 2 回目の入力はない（どちらの欄も、書いたものを表示できる）。空の欄、規則に合わない新しいパスワード、現在のパスワードと同じ新しいパスワード（どちらも NFC にして比べる。API と同じ）は、送らずに、その欄に出す
- **変更を断られたとき**: 現在のパスワードの誤り（`incorrect`）は、その欄に、5 回続けて誤ると 15 分間サインインもできなくなることとともに出す。推測されやすいパスワード（`blocklisted`）は、新しいパスワードの欄に出す。どれも、書いた内容は残る
- **変更したあと**は、通知で、変えたこと、ほかの端末のサインインが終わったこと、メールで知らせたことを伝え、アカウントの安全の画面へ戻る。その画面が読む内容は、戻る前に捨てる（`removeQueries`）。最後に変更した日時と端末の一覧は、読み直したものだけが出る
- **アカウントと端末の一覧は、画面を開くたびに読む**（`staleTime` が 0）。日時は、ブラウザーのタイムゾーンで出す（アカウントは、どのサロンのものでもない）。ブラウザーは、API が持つ User-Agent をそのまま出し、ないときは「記録されていません」と出す。端末の名前は、サインインした日時（「2026年11月20日 10:15 にサインインした端末」）
- **端末の一覧**は、新しい順に 20 件ずつで、「さらに表示」で続きを読む。続きを読むと、フォーカスは、加わった最初の端末の名前へ移る。続きの起点の端末が、その間にサインアウトしていた（400 の `cursor`）ときは、一覧を最初から読み直す
- **ほかの端末のサインアウト**は、確かめずに行う（その端末で、もう一度サインインすれば使える）。その行は、すぐに一覧から除き、件数も 1 つ減らして、フォーカスを「サインインしている端末」の見出しへ移し、一覧は、出したまま読み直す。その間にサインアウトしていた（404）ときも、同じ。この端末には、ボタンがない（ヘッダーのサインアウトを使う）
- **すべての端末でのサインアウト**は、ダイアログで確かめる（この端末も、サインアウトすることを伝える）。終わったら、ブラウザーのセッションも消え、サインインの画面に替わり、通知で伝える。失敗は、ダイアログの中で伝える
- **2 要素認証**の部分は、いまの状態（未設定、設定の途中、有効）と、その説明と、状態ごとの操作。未設定は「2 要素認証を設定する」、設定の途中は「設定をやり直す」（どちらも、設定の画面へのリンク）。有効は「バックアップコードを発行し直す」と「2 要素認証を無効にする」（どちらも、ダイアログ。有効なときだけ置く）
- **設定の画面**は、アカウントを読んでから、1 つのアドレスの中の 3 つの段階を出す。段階は画面が持ち、アドレスには置かない（シークレットとバックアップコードは、`enable` の応答にしかなく、あとから取得できない）。読み込み直すと、最初の段階に戻り、`enable` が、新しいシークレットとバックアップコードを発行する。段階が替わるたびに、その段階の見出しへフォーカスを移す。すでに有効なアカウントには、フォームの代わりに、そのことと、アカウントの安全の画面へのリンクを出す。設定の途中のアカウントは、最初の段階からやり直す
- **QR コード**は、`enable` が返す `otpauth://` の URI を、`uqr` でモジュールの行列にし、`ui` の `QrCode` が SVG で描く（周りに 4 モジュールの余白。暗いモジュールは文字の色、背景は面の色）。URI はシークレットを含むので、外部のサービスで画像にしない。その下に、QR コードを読み取れない人のために、キーを 4 文字ずつ空白で区切って出す
- **認証アプリのコード**は、空白を除き、全角の数字を半角にして送る。6 桁の数字でないものは、送らずに、その欄に出す。欄の説明で、バックアップコードは使えないことを伝える。誤り（`incorrect`）は、その欄に、ロックの回数に数えることとともに出す
- **バックアップコード**は、認証アプリのコードで有効になったあとに、`enable` の応答にあった 10 個を出す。それぞれ 1 回だけ使えること、この画面を離れると二度と出ないこと、控えておくこと、なくしたときは発行し直せることを伝える。確認に失敗した人には、出さない
- **発行し直すダイアログ**は、認証アプリのコードかバックアップコードを受け取り（空白を除き、64 文字まで）、発行したら、同じダイアログの中で、フォームの代わりに 10 個のコードを出し、それまでのコードは使えなくなったことと、メールで知らせたことを伝えて、フォーカスを、その説明へ移す。**無効にするダイアログ**は、パスワードと、認証アプリのコードかバックアップコードを受け取る。API は、パスワードを確かめてからコードを読むので、誤りは、まずパスワードの欄に出る。無効にしたら、ダイアログを閉じ、通知で伝え、アカウントを読み直す。フォームのあるダイアログを開くと、ブラウザーが、最初の欄へフォーカスを置く
- **状態が合わないとき**（409。ほかのタブや端末で、設定、確認、無効化が済んでいた）は、「2 要素認証の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。」と通知し、ダイアログを閉じて（設定の画面では、最初の段階に戻って）、アカウントを読み直す。読み直した状態でボタンがなくなると、フォーカスは「2 要素認証」の見出しへ移る（設定の画面では、替わった段階の見出しへ）
- **変えたあと**は、読んであったアカウントの 2 要素認証の状態を、API が変えた状態に書き換えてから（`two-factor-flow.ts` の `withTwoFactorStatus`）、アカウントを読み直す。クエリを捨てると、それを読んでいる設定の画面が読み込み中に戻り、出していた段階が消えるからであり、書き換えるのは、戻った画面に、前の状態を一瞬でも出さないためである。メールは API が送る（有効にしたとき、無効にしたとき、発行し直したとき）。画面は、そのことを伝える
- **API を呼ぶ関数**は `security-api.ts` にある（`readOwnAccount`、`readOwnSessions`、`changePassword`、`endSession`、`signOutEverywhere`、`startTwoFactor`、`confirmTwoFactor`、`issueBackupCodes`、`stopTwoFactor`）。どれも reject せず、画面が区別する結果の直和型を返す。フォームの値の確かめと、応答ごとの表示、一覧のページの組み立ては `security-flow.ts` と `two-factor-flow.ts`、日時と端末の言葉は `security-format.ts` の純粋な関数
- **表示するだけの部品**（`src/security/components/`）は、パスワードと 2 要素認証（`SecuritySummary`）、端末の一覧（`SessionList`）、すべての端末でのサインアウト（`SignOutEverywhere`）、変更のフォーム（`PasswordChangeForm`）、設定の段階（`TwoFactorPasswordForm`、`AuthenticatorRegistration`）、バックアップコードの一覧（`BackupCodeList`）、2 つのダイアログ（`BackupCodesDialog`、`TwoFactorStopDialog`）。`ui` のカタログに、`Session/Security/…` として並ぶ

### 予約台帳の画面

admin-app の `src/salons/`、`src/customers/` と `src/bookings/` に、サロンで働く人と管理者が、サロンのその日の予約を見て、ステータスを進め、電話や店頭で受けた予約を入れ、記録を変え、日時と担当を変え、施術明細を足して外し、誤って入れた予約を削除する画面があります。ロール `owner`、`manager`、`staff`、`admin` のアカウントでサインインして使います（admin-app のすべての画面と同じく、ほかのロールには、使えないことを伝えます）。決まりは、[予約台帳](./bookings.md) の「ステータスの操作」と「認可」です。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/` | サロンのメンバー（`owner`、`manager`、`staff`）は、所属するサロンのその日の予約の一覧へ移る（履歴を置き換える）。`admin` には、サロンを選ぶ画面。キーワード（名前と説明の部分一致）で探し、20 件ずつ表示する。行のサロンの名前が、そのサロンの予約の一覧へのリンク | `GET /staff-profiles/me`、`GET /salons` |
| `/salons/:salonId/bookings` | その日の予約の一覧。日付、状態、担当の条件（アドレスのクエリの `date`、`status`、`staffId`）。行は、時刻（開始〜終了）、お客様の名前、担当、メニュー、状態、予約番号で、お客様の名前が、予約の内容へのリンク。開始の早い順に 50 件ずつ（「さらに表示」）。「前の日」「今日」「次の日」。「予約を入れる」で、表示している日の予約を入れる画面へ | `GET /salons/{id}`、`GET /bookings`、`POST /customers/batch/get`、`GET /customers/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services` |
| `/salons/:salonId/bookings/new` | 予約を入れる。お客様をキーワード（姓、名、フリガナ、メールアドレスの部分一致と、電話番号の数字）で探して選び（20 人ずつ）、担当スタッフ、来店日、明細（1〜20 行。メニュー、担当、開始の時刻、メモ）、受付の記録（受付の経路、予約金、お客様の要望、サロン内のメモ）を入れる。「担当の空きを確かめる」で、明細の担当の空きを確かめる。入れた予約の内容へ移る | `GET /salons/{id}`、`GET /customers`、`GET /customers/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`POST /salons/{salonId}/available-slots/check`、`GET /bookings/{id}`、`POST /bookings` |
| `/salons/:salonId/bookings/:bookingId` | 予約の内容（「状態」、「予約」、「施術明細」、「金額」、「会計」）と、ステータスの操作。施術明細のメニューが、明細の画面へのリンク。「日時と担当を変える」（下書き、確定待ち、確定の予約）、「施術明細を追加する」（終わっていない予約で、明細が 20 件より少ないとき）、「要望とメモを変える」と「予約を削除する」（`owner`、`manager`、`admin`）。「会計」には、取り消していない売上（売上番号、合計、支払い）か、施術中と完了の予約に「会計を入れる」。「施術記録」には、施術中と完了の予約の施術記録の「施術記録を見る」か「施術記録を書く」（[施術記録の画面](#施術記録の画面)）。「この日の予約へ」で、その日の一覧へ戻る | `GET /salons/{id}`、`GET /bookings/{id}`、`GET /customers/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`GET /sales`、`GET /treatments`、`POST /bookings/{id}/confirm`、`POST /bookings/{id}/start`、`POST /bookings/{id}/complete`、`POST /bookings/{id}/cancel`、`POST /bookings/{id}/no-show`、`DELETE /bookings/{id}` |
| `/salons/:salonId/bookings/:bookingId/edit` | 受付の記録（受付の経路、予約金、お客様の要望、サロン内のメモ）を変える。変えた項目だけを送り、何も変えていなければ、API を呼ばずに戻る | `GET /salons/{id}`、`GET /bookings/{id}`、`PATCH /bookings/{id}` |
| `/salons/:salonId/bookings/:bookingId/reschedule` | 日時と担当を変える。担当スタッフ、来店日、開始の時刻（初めの値は、予約のいま）。値を変えるたびに、動かしたあとの明細を出す。何も変えていなければ、API を呼ばずに戻る | `GET /salons/{id}`、`GET /bookings/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`POST /bookings/{id}/reschedule`、`POST /salons/{salonId}/available-slots/check` |
| `/salons/:salonId/bookings/:bookingId/services/new` | 施術明細を追加する。メニュー、担当（初めの値は「予約の担当と同じ」）、来店日の開始の時刻、メモ | `GET /salons/{id}`、`GET /bookings/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`POST /bookings/{bookingId}/services`、`POST /salons/{salonId}/available-slots/check` |
| `/salons/:salonId/bookings/:bookingId/services/:lineId` | 施術明細の内容（メニュー、担当、時刻、所要時間、料金、割引、支払う額、完了、メモ）と、「この明細を外す」 | `GET /salons/{id}`、`GET /bookings/{id}`、`GET /bookings/{bookingId}/services/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`DELETE /bookings/{bookingId}/services/{id}` |

- **どのサロンの画面かは、アドレスにある**（`/salons/:salonId/...`）。サロンのメンバーのサロンは、`GET /staff-profiles/me` の `salonId`（`session` の `useOwnSalon`。`admin` には、尋ねずに `platform` を返す）。サロンのロールなのに、どのサロンにも属していないアカウント（スタッフとの紐づけを解かれた人など。API は 403）には、そのことと、サロンの `owner` から招待を受けると使えることを伝える（`NoSalonNotice`）
- **ヘッダー**には、「予約」（アドレスのサロンのその日の一覧）と「売上」（アドレスのサロンの今日の売上台帳）。`admin` には、その前に「サロンを選ぶ」（`src/navigation.ts` の `navigationFor`）。サロンの名前は、画面の見出しの説明に出す
- **サロンは、画面の外側で 1 回読む**（`salon-screens` の `WithSalon`）。サロンの名前、タイムゾーン、通貨を、画面が使う。読んでいる間は、読み込み中の表示だけを出し、見出しは、画面が出す（同じ題の見出しを描き直すと、移ったフォーカスが失われるため）。存在しないサロンは「サロンが見つかりません」
- **ほかのサロンのアドレス**: メンバーがほかのサロンの一覧を開くと、API は 403 を返す。画面は、そのサロンの予約は見られないことと、「自分のサロンの予約へ」のリンクを出す。ほかのサロンの予約の ID は、`admin` にも、「予約が見つかりません」と出す（アドレスのサロンの予約ではないため）
- **日と時刻は、サロンのタイムゾーン**（ブラウザーのタイムゾーンではない。`salon-screens` の `salon-time.ts`）。今日は、サロンのタイムゾーンでの今日。時刻は 24 時間制。一覧は、その 1 日の予約を読む（`bookingDateFrom` と `bookingDateTo` に同じ日）。アドレスの日付が日付でないとき（2026-02-30 など）は、今日を出す
- **絞り込み**は、状態と担当。条件は、アドレスのクエリに置き、変えると、アドレスを置き換える（`src/bookings/booking-day.ts`）。担当の選択肢は、サロンのスタッフのプロフィールの一覧のすべて
- **一覧の行の名前**: 予約は、顧客、担当、メニューを ID で持つ。顧客は、読んだページの顧客を、`POST /customers/batch/get` で 1 度に読む。台帳から削除された顧客がいると、API は一括取得の全体を断る（404）ので、そのページの顧客を 1 人ずつ読む（`GET /customers/{id}`）。担当はサロンのスタッフのプロフィールの一覧、メニューはサロンのサービスの一覧（最後まで読む）から引く。引けない名前は、「削除された顧客」「一覧にないスタッフ」「削除されたメニュー」と出し、行は残す（削除された顧客の予約も、ステータスを変えられる）。担当を決めていない施術明細の担当は「未定」
- **一覧は、表示するたびに読む**（`staleTime` が 0）。ステータスを変えたあとは、読んであった一覧を捨てる（`removeQueries`）。一覧へ戻ったときに、前のステータスが出ることがない
- **予約の内容**は、予約番号、来店日、時刻、お客様の名前（お客様の台帳へのリンク）と電話番号、担当、お客様の要望、サロン内のメモ、キャンセル（日時、理由）、実際の開始と終了、完了の日時（「予約」）、施術明細（メニュー、担当、時刻、金額、完了）、金額（小計、割引、消費税、合計）
- **ステータスの操作**は、予約の状態ごとに、出すボタンを決める（`src/bookings/booking-actions.ts` の `actionsOf`。API の表のとおり）。確定と施術の開始は、確かめずに行う。完了、キャンセル、無断キャンセルの記録は、元に戻せないので、ダイアログで確かめる。完了では、実際の開始と終了を、サロンの時計の日時で、任意で入力できる（UTC にして送る。空欄は `null` で、施術を始めたときに記録した開始は、そのまま残る。終了が開始より前なら、送らずにその欄に出す）。キャンセルでは、理由を任意で書ける。無断キャンセルの記録は、開始日時を過ぎた予約にだけ出す（API は、その前には断る）
- **操作のあと**は、応答の予約で内容を置き換え、通知で伝え、フォーカスを「状態」の見出しへ移す（押したボタンは、なくなることがある）。ダイアログは、その描画の中で閉じてから、フォーカスを移す（モーダルのダイアログが開いている間は、その外へフォーカスを移せない）。送れなかった（応答がない、リクエストが多すぎる）ときは、確定と開始は画面に、ほかはダイアログの中に出す
- **状態が合わないとき**（409。ほかの画面や端末、顧客が、予約を変えていた）は、「予約の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。」と画面に出し、ダイアログを閉じて、予約を読み直し、フォーカスを「状態」の見出しへ移す
- **予約を入れる画面の段階は、アドレスにある**（`src/bookings/booking-entry.ts` の `entryChoiceIn`）。`date`（フォームの来店日の初めの値。一覧の日）、`search`（お客様を探したキーワード）、`customerId`（選んだお客様）。キーワードで探すたびと、お客様を選んだときに、履歴に積む（ブラウザーの「戻る」で、探した結果と、選ぶ前に戻れる）。キーワードのない検索はしない（台帳の全員を出す画面ではない）。選んだお客様が台帳から削除されていたら、そのことと「お客様を選び直す」を出す。台帳にないお客様は、この画面では登録しない。キーワードに合うお客様がいなければ、そのことと「お客様を登録する」を出す（[顧客台帳の画面](#顧客台帳の画面)。登録したお客様の台帳の「予約を入れる」で、この画面に戻る）
- **来店日は 1 つ**で、明細の開始は、その日のサロンの時計の時刻（日をまたぐ来店は入れない）。明細の担当は、「予約の担当と同じ」（初めの値。送るときに予約の担当の ID にする）、サロンのスタッフ、「決めない」（`null`。誰の時間も占有しない）。サロンの時計で、その日にない時刻（夏時間の始まり）は、送らずにその欄に出す。予約金は、全角の数字とカンマも読み、0 以上の円の整数だけを送る。受付の経路は「電話」「店頭」「メール」「その他」から選ぶ（ポータルの予約の `online` は、変える画面で、そのまま出す）
- **担当の空き**は、担当を決めた明細ごとに `POST /salons/{salonId}/available-slots/check` で確かめ、重なる予約は、ID から予約を読んで、予約番号と時刻で出す（読む間に削除された予約は出さない）。結果は、明細ごとのバッジ（「空いています」「重なる予約があります」「空きを確かめられませんでした」）と、1 文（`role="status"`）。担当、来店日、明細を変えると、結果を消す。確かめるのは、担当が占有されているかだけで、担当の前後の空け時間も重なりに数える（営業時間や勤務の予定は、確かめない。API の作成と同じ）。作成を API が 409 で断ると（409 は、担当の重なりと、サロンのタイムゾーンの不正を区別しない）、そのことを伝えて、空きを確かめ直す
- **予約を入れたあと**は、応答の予約を、予約の内容の画面の読んだものに置き、読んであった一覧を捨て（`removeQueries`）、「予約を入れました。」と通知して、予約の内容へ移る。API が断った値は、その欄に出す（メニューやスタッフが、選ぶ間に使えなくなったときなど）。欄のない値（削除されたお客様、合計の上限）は、フォームの上に出す
- **予約を変える画面**（記録、日時と担当、施術明細の追加、施術明細）は、開いたときに、予約を読み直す（`src/bookings/with-booking.tsx` の `WithBooking`。`staleTime` が 0 で、読み直した予約だけを出す）。見出しの下に、予約番号と時刻を出す
- **記録を変える画面**は、開いたときの値と比べて、変えた項目だけを `PATCH` で送るので、その間にほかの人が変えたほかの項目は、残る。変えたあとは、応答の予約で内容を置き換えて、予約の内容へ戻る
- **日時と担当の変更**は、担当スタッフと、最初の明細の開始（来店日と時刻。サロンの時計）を送る。API は、すべての明細を同じ時間だけずらし、予約の担当が受け持つ明細を新しい担当に付け替える（ほかのスタッフの明細と、担当を決めない明細は、そのまま）。画面は、同じ規則で、動かしたあとの明細を、値を変えるたびに出す（`src/bookings/booking-moves.ts` の `movedLines`）。変えられるのは、下書き、確定待ち、確定の予約で、ほかの状態の予約には、リンクを出さず、アドレスで開いたときは、変えられない理由と「予約の内容へ」を出す
- **施術明細の追加**は、終わっていない予約（下書き、確定待ち、確定、施術中）に、明細が 20 件になるまで。明細は、来店日のサロンの時計の時刻に始まり、最も早い明細の開始から 24 時間以内（夏時間の終わりの 25 時間の日だけに起こる。送らずにその欄に出す）。API は、明細だけを返し、予約の時刻と金額を算出し直すので、追加のあとは、読んであった予約を捨て（`removeQueries`）、予約の内容で読み直す
- **担当の重なりは、送る前に確かめない**。空きの確認（`POST /salons/{salonId}/available-slots/check`）は、動かす予約や明細を足す予約そのものの明細も、重なりに数えるため（同時に 2 件以上を受けるスタッフでは、数えるかどうかで答えが変わる）。API が 409 で断ると（409 は、状態、担当の重なり、明細の数、24 時間、金額の上限、タイムゾーンの不正を区別しない）、予約を読み直し、いまの予約が変えられない状態なら、その予約を出して理由を伝える。変えられる状態なら、明細ごとに、動かした先（足す明細）の担当を、その予約自身を除いて確かめ（`checkLine` の `excluding`）、重なる予約を明細の下に出す。担当がみな空いていれば、日時の変更は失敗として、明細の追加は金額の上限として伝える。値を変えると、確かめた結果を消す
- **施術明細の画面**は、明細を 1 件読んで出す（`GET /bookings/{bookingId}/services/{id}`）。明細は、変えない（担当や時刻を変えるときは、新しい明細を足してから、この明細を外す。画面にそう書く）。外すときは、ダイアログで、予約の時刻と金額を残る明細から算出し直すこと、元に戻せないことを伝えて確かめる。予約の最後の明細と、終わった予約の明細は、外せない理由を出し、ボタンを出さない。外すまでの間に最後の明細になっていたら（409）、ダイアログを閉じて、読み直した予約から理由を出す。外したあとは、予約の内容へ戻る
- **予約の削除**は、誤って入れた予約や、重複した予約を取り除くためのもの。ダイアログで、施術明細とともに取り除くこと、行われない予約はキャンセルすること、元に戻せないことを伝えて確かめる。削除できるのは `owner`、`manager`、`admin` で、`staff` には、ボタンを出さない。売上、施術記録、レビューのどれかが指す予約は、API が断る（409）ので、ダイアログを閉じて、行われた来店の記録として残ることを画面に出す。削除したあとは、読んであった一覧を捨て、その予約の日の一覧へ移る
- **API を呼ぶ関数**は `salon-screens` の `salons-api.ts`（サロンを探す、読む）、`src/salons/salons-api.ts`（スタッフのプロフィールとサービス）、`src/customers/customers-api.ts`、`src/bookings/bookings-api.ts` にある。どれも reject せず、画面が区別する結果の直和型を返す。条件とアドレス、名前の引き方、行の組み立て、ボタン、フォームの値の確かめ、応答ごとの表示は、それぞれの隣の純粋な関数
- **表示するだけの部品**は、続きのある表（`salon-screens` の `PagedTable`）、キーワードで探すフォーム（`salon-screens` の `KeywordSearch`。サロンとお客様を探す）、サロンとお客様の結果（`salon-screens` の `SalonChoices`、`CustomerChoices`）、日の移動（`DaySwitch`）、絞り込み（`BookingFilter`）、その日の予約の表（`DayBookingTable`）、予約の内容（`BookingRecord`）、ステータスとその操作（`StatusActions`）、選んだお客様（`ChosenCustomer`）、予約を入れるフォーム（`BookingEntryForm`）、明細の行（`BookingLines`）、明細の担当を確かめた結果（`LineCheckNote`）、受付の記録の欄（`BookingNotesFields`）、予約を変える画面へのリンクと削除（`BookingChanges`）、日時と担当を変えるフォーム（`BookingMoveForm`）、動かしたあとの明細（`MovedLines`）、明細を足すフォーム（`BookingLineForm`）、施術明細の内容（`BookingLineRecord`）、明細を外すボタンとダイアログ（`LineRemoval`）。`ui` のカタログに、`Admin/…` として並ぶ（`salon-screens` の部品は `SalonScreens/…`）

### 売上の画面

admin-app の `src/sales/` に、予約台帳の予約から会計を入れ、支払いを記録し、レシートを印刷し、その日の売上を見て、売上の記録を直し、支払いを返金し、売上を取り消す画面があります。予約台帳と同じロール（`owner`、`manager`、`staff`、`admin`）で使います。返金と取り消しは、`owner`、`manager`、`admin` だけで（API）、`staff` には、そのリンクとボタンを出さず、できる人を伝えます。決まりは、[売上台帳](./sales.md) と [支払い](./payments.md) です。システムは決済代行会社と接続していないので、支払いは、現金を受け取るか、カード端末や QR コード決済で決済が通ったことを確かめてから記録します。返金も、お金を返してから記録します。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/bookings/:bookingId/checkout` | 会計を入れる。予約の施術（予約に写した料金と割引）と、足した施術（メニューから選ぶ。いまの料金と割引価格）の 2 つの表、金額（小計、割引、消費税、合計、1 回で受け取れる支払い方法）、会計の担当（初めは予約の担当。「記録しない」も選べる）、メモ。入れた売上の内容へ移る | `GET /salons/{id}`、`GET /bookings/{id}`、`GET /sales`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`POST /sales/calculate`、`POST /sales` |
| `/salons/:salonId/sales` | 売上台帳。会計日の範囲（`from`、`to`。初めは今日）と支払い状態（`paymentStatus`）の条件。行は、売上番号（売上の内容へのリンク）、会計日時、合計、支払い（取り消した売上は「取り消し」）。会計日時の新しい順に 50 件ずつ（「さらに表示」） | `GET /salons/{id}`、`GET /sales` |
| `/salons/:salonId/sales/:saleId` | 売上の内容（「売上」、「明細」、「金額」、「支払い」、「レシート」、お客様のいる、取り消していない売上では「ポイント」、取り消していない売上では「取り消し」）。「ポイント」に「使ったポイントを記録する」と「ポイントを付与する」（その売上に結びつけて、[ポイントを記録する画面](#顧客台帳の画面)へ）。「売上を直す」（取り消していない売上）、「支払いを記録する」（未払い残額があり、取り消しと返金のない売上）、「レシートを出す」（合計を受け取った、取り消していない売上）、支払いの表の「返金する」（受け取った支払い）、「売上を取り消す」（受け取った支払いと、一部を返金した支払いのない売上）。「この日の売上へ」で、会計日の売上台帳へ | `GET /salons/{id}`、`GET /sales/{id}`、`GET /salons/{salonId}/payment-methods`、`GET /customers/{id}`、`GET /staff-profiles`、`POST /sales/{id}/void` |
| `/salons/:salonId/sales/:saleId/payments/new` | 支払いを記録する。支払い方法（サロンが使っているもの）、金額（初めは未払い残額）、カードの支払い方法では、カードの下 4 桁とブランド。売上の内容へ戻る | `GET /salons/{id}`、`GET /sales/{id}`、`GET /salons/{salonId}/payment-methods`、`POST /sales/{id}/process` |
| `/salons/:salonId/sales/:saleId/receipt` | レシート（サロンの名前、住所、電話、レシート番号、会計日時、発行日時、明細、金額、支払い（方法とカード）、返金）と「印刷する」 | `GET /salons/{id}`、`GET /sales/{id}/receipt`、`GET /salons/{salonId}/payment-methods`、`GET /sales/{id}` |
| `/salons/:salonId/sales/:saleId/edit` | 売上を直す。会計の担当（サロンのスタッフと「記録しない」）、会計日と時刻（サロンの時計）、メモ。明細と金額は、ここでは直せないことと、直し方を出す。売上の内容へ戻る | `GET /salons/{id}`、`GET /sales/{id}`、`GET /staff-profiles`、`PATCH /sales/{id}` |
| `/salons/:salonId/sales/:saleId/payments/:paymentId/refund` | 返金する。返金する支払い（取引番号、受けた日時、支払い方法、金額、カード）、返金する金額（初めは支払いの金額）、返金の理由。売上の内容へ戻る | `GET /salons/{id}`、`GET /sales/{id}`、`GET /salons/{salonId}/payment-methods`、`POST /payments/{id}/refund` |

- **会計の入口は、予約**。予約の内容の画面の「会計」は、予約の売上を、表示するたびに読む（`GET /sales?bookingId=`。`staleTime` が 0）。1 つの予約に入れる会計は、取り消していない売上の 1 件で（API）、あればその売上番号、合計、支払いを出す。なければ、施術中と完了の予約に「会計を入れる」を出し、ほかの状態では、入れられない理由（キャンセルした予約には入れない。確定前と確定の予約は、施術を始めると入れられる）を出す。会計を入れる画面をアドレスで開いたときも同じで、会計の入った予約では、その売上へのリンクを出す。予約のない会計（店頭の物販、飛び込みの来店）は、この画面では入れない
- **会計の明細**は、予約の施術明細の 1 件ずつ（名前はメニューの名前、数量 1、単価と割引は予約に写した金額、担当は明細の担当）と、足した施術の 1 件ずつ（いまのメニューの料金で、割引価格があれば、その差が割引。担当は予約の担当）。メニューから削除されたサービスの明細も、予約に写した金額で数える
- **金額は、API が計算する**。足した施術が変わるたびに `POST /sales/calculate` を呼び（クエリのキーに、足した施術の ID を含む）、小計、割引、消費税、合計と、1 回で受け取れる支払い方法を出す。画面の明細の料金と割引の合計が、計算の小計と割引に合わないとき（画面を開いたあとに、メニューの料金が変わった）は、金額を出さずにそのことを伝え、「計算し直す」でメニューを読み直す。足した施術が、その間にメニューから削除されていたら（400）、その名前を出し、外すように伝える
- **消費税**は、計算の消費税（税込でない明細の金額の合計に、サロンの税率を 1 回だけ掛け、1 円未満を切り捨てた額）を、税込でない明細に、割引後の金額の割合で分ける（1 円未満は切り捨て、残りの円は前の明細から 1 円ずつ。`src/sales/checkout.ts` の `taxSharesOf`）。明細の消費税の合計は、計算の消費税と同じになる
- **会計日時は、送った時刻**（ミリ秒まで）。会計日は、API がサロンのタイムゾーンで決める。ポイントは送らない（`null`）
- **会計のあと**は、応答の売上を売上の内容の読んだものに置き、読んであった売上台帳と、予約の「会計」を捨て（`removeQueries`）、「会計を入れました。」と通知して、売上の内容へ移る。409 のときは、予約の売上を読み直し、その間に入った売上があれば、「この予約には、その間に会計が入っていました。その売上を表示します。」と通知して、その売上へ移る。なければ、サロンのタイムゾーンが正しくないことを伝える
- **支払い**は、分けて記録できる（現金で一部、残りをカードで、など）。支払い方法は、サロンが使っているもの（`isActive`）を並び順に出し、1 回に受け付ける金額を括弧の中に出す（「Credit Card（￥1,000から）」）。金額は、全角の数字とカンマも読み、1 円以上、未払い残額以下で、選んだ方法の下限と上限の中の円の整数だけを送る。外れていれば、送らずに、その欄に出す。カードの下 4 桁（4 桁の数字）とブランド（50 文字まで）は、カードの支払い方法（`credit_card`、`debit_card`）のときだけ出し、記録しなくてもよい。使っている支払い方法がないサロンでは、そのことと、サロンの設定で使えるようにすることを伝える
- **支払いのあと**は、読んであった売上を捨て、「支払いを記録しました。」と通知して、売上の内容へ戻る（API の応答は決済取引なので、売上を読み直す）。合計を受け取ったときは、「合計を受け取ったので、レシートを出せます。」を添える。409 のときは、売上を読み直して、支払いを記録できない理由（取り消された、返金がある、未払い残額がない）を出す
- **レシート**は、開くたびに API が作る（保存されない。発行日時は、作った時刻）。合計を受け取る前の売上と、取り消した売上には、理由を出す。「印刷する」は `window.print()` で、紙には、レシートだけが出る（アプリのヘッダー、ナビゲーション、通知、画面の見出しと移動のリンクは、印刷のスタイルで隠す）
- **売上を直す画面**は、会計の担当、会計日時、メモだけを直す。明細と金額は、直せない（API の計算は、予約と施術からしか作れない）。誤りは、オーナーかマネージャーが、支払いを全額返金して売上を取り消し、予約から会計を入れ直す。画面にそう書く。開いたときの値と比べて、変えた項目だけを `PATCH` で送り、何も変えていなければ、送らずに「変更はありませんでした。」と伝えて戻る。会計日時は、日か時刻を変えたときだけ送る（サロンの時計の日時。いまより後と、その日にない時刻は、送らずにその欄に出す）。会計日は、API がサロンのタイムゾーンで決め直す。担当がスタッフの一覧にない売上は、その担当を「一覧にないスタッフ（いまの担当）」として選んだまま出す。直したあとは、応答の売上を売上の内容の読んだものに置き、読んであった売上台帳と予約の「会計」を捨てる（会計日が変わることがあるため）。取り消した売上には、リンクを出さず、アドレスで開いたときは、直せない理由を出す。409 のときは、売上を読み直し、取り消されていれば、その売上と理由を出す。そうでなければ、サロンのタイムゾーンが正しくないことを伝える
- **返金**は、受け取った支払い（`completed`）の 1 件ずつに、1 回だけ（API）。金額は、全角の数字とカンマも読み、1 円以上、支払いの金額以下の円の整数だけを送る。理由は、必ず書く（返金の記録に残る）。一部だけ返金すると、残りは返金できず、売上も取り消せなくなるので、金額の欄にそう書く。返金のあとは、売上を捨てて読み直し（API の応答は決済取引で、売上の支払い状態は API が決め直す）、「返金を記録しました。」と通知して、売上の内容へ戻る。すべての支払いを全額返金したときは、「すべての支払いを全額返金したので、売上を取り消せます。」を添える。409 のときは、売上を読み直して、いまの支払いと、返金できない理由を出す。返金できない支払いのアドレスを開いたときも、理由を出す
- **支払いの表の「返金」**は、返金した金額と日時。理由は文なので、表の下に、取引番号ごとに出す（表のセルは 1 行で、表は横にスクロールする）
- **取り消し**は、売上の内容の「取り消し」から、ダイアログで理由を書いて確かめる（理由は必ず書く）。ダイアログは、取り消しが元に戻せないこと、取り消した売上は台帳に残り、直すことも支払いを受けることもできないこと、予約の会計は入れ直せることを伝える。受け取った支払いがある売上は、全額返金するまで取り消せず、一部を返金した支払いがある売上は、取り消せない（API）。画面は、その理由を出し、ボタンを出さない。取り消したあとは、応答の売上で内容を置き換え、読んであった売上台帳と予約の「会計」を捨て、「売上を取り消しました。」と通知する（予約の売上なら「予約の会計を、入れ直せます。」を添える）。フォーカスは、「売上」の見出しへ移す（「取り消し」は、なくなる）。409 のときは、ダイアログを閉じて売上を読み直し、変わったこと（取り消されていた、支払いが変わった）と理由を通知して、フォーカスを「取り消し」の見出しへ移す（取り消されていたら「売上」）
- **売上台帳の条件は、アドレスにある**（`src/sales/sales-ledger.ts`）。日付でない値は今日に、終わりが始まりより前の範囲は、送らずにその欄に出す。条件を変えると、アドレスを置き換え、「今日の売上に戻す」で条件を外す。お客様の名前は出さない（売上は顧客の ID しか持たない）
- **ほかのサロンのアドレス**: メンバーがほかのサロンの売上を開くと、API は 403 を返す。画面は、そのサロンの売上は見られないことと、「自分のサロンの予約へ」のリンクを出す。ほかのサロンの売上の ID は、`admin` にも、「売上が見つかりません」と出す
- **API を呼ぶ関数**は `src/sales/sales-api.ts` にある。どれも reject せず、画面が区別する結果の直和型を返す。会計の決まりは `checkout.ts`、支払いの決まりは `payments.ts`、売上を直すことと取り消しの決まりは `sale-changes.ts`、返金の決まりは `refunds.ts`、売上と支払いの言葉と、未払い残額、レシートを出せるかは `sale-format.ts`、売上台帳の条件とアドレスは `sales-ledger.ts` の純粋な関数
- **表示するだけの部品**は、売上の表（`SaleTable`）、売上台帳の絞り込み（`LedgerFilter`）、会計のフォーム（`CheckoutForm`）、売上の内容（`SaleRecord`）、支払いの表（`PaymentTable`）、支払いのフォーム（`PaymentForm`）、レシート（`Receipt`）、予約の「会計」（`BookingSale`）、売上を直すフォーム（`SaleChangeForm`）、取り消しのボタンとダイアログ（`SaleVoid`）、返金のフォーム（`RefundForm`）、売上の「ポイント」（`SalePoints`。2 つのボタンは、狭い画面でカードの見出しの横に並ばないので、本文の文の下に置く）。`ui` のカタログに、`Admin/…` として並ぶ

### 顧客台帳の画面

admin-app の `src/customers/` に、顧客台帳からお客様を探し、電話や店頭で初めてのお客様を台帳に登録し、お客様の台帳（台帳の記録、来店とポイント、好み設定、このサロンでの利用）を見て、台帳を直す画面と、お客様を台帳から削除して戻し、台帳の変更履歴と版を見る画面と、お客様のポイントの残高と履歴を見て、ポイントを記録する画面と、CSV ファイルのお客様をまとめて登録し、台帳で選んだお客様にまとめてタグを付けて外し、台帳から削除する画面と、同じお客様の 2 つの記録を 1 つにまとめる画面があり、台帳を CSV ファイルに、お客様のデータを JSON ファイルに出力します。予約台帳と同じロール（`owner`、`manager`、`staff`、`admin`）で使います（削除（まとめての削除も）、統合、台帳に戻すこと、変更履歴と版、ポイントの調整、出力は、`staff` を除く）。決まりは、[顧客台帳](./customers.md) と [ポイント台帳](./points.md) です。顧客台帳はプラットフォームに 1 つで、お客様はサロンに属しません。どのサロンのアドレスで開いても同じ台帳で、サロンは、日付（サロンのタイムゾーン）と、このサロンでの利用の集計に使います。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/customers` | 顧客台帳。キーワード（姓、名、フリガナ、メールアドレスの部分一致と、電話番号の数字）、タグ（すべてを持つお客様）、登録日の範囲、ステータス、会員ランクの条件（アドレスのクエリの `search`、`tags`、`from`、`to`、`customerStatus`、`membershipTier`）。行は、お名前（お客様の台帳へのリンク）、フリガナ、電話番号、会員ランク、ステータス、来店回数、最終来店日。登録の新しい順に 20 人ずつ（「さらに表示」）。行の「選ぶ」で選んだお客様に、表の上の節で、まとめてタグを付けて外し、台帳から削除する。「お客様を登録する」と「CSV から登録する」、「カルテを探す」、オーナーなどには「CSV に出力する」（いまの条件のお客様を CSV ファイルに保存する） | `GET /salons/{id}`、`GET /customers`。タグを変えるときに `POST /customers/batch/get` と `PATCH /customers/bulk`、削除に `DELETE /customers/bulk`。いなくなったお客様を見つけるときに `POST /customers/batch/get`。出力に `GET /customers/export` |
| `/salons/:salonId/customers/new` | お客様を登録する。お名前（姓、名、フリガナ）、連絡先（メールアドレス、電話番号、予備の電話番号）、住所、お客様について（生年月日、性別、職業）、髪と頭皮（髪質、髪の太さ、頭皮の状態）、好み（好みのメニュー、好みについてのメモ）、サロンでの扱い（会員ランク、ステータス、有効なお客様、タグ）、紹介（紹介元、紹介コード）、送ってよい連絡（メール、SMS、キャンペーンなどのお知らせ）、メモ（備考、スタッフ間の申し送り）。登録したお客様の台帳へ移る | `GET /salons/{id}`、`POST /customers`、紹介元を探すときと、断られたときに `GET /customers` |
| `/salons/:salonId/customers/import` | CSV から登録する。CSV ファイルを選ぶと、ブラウザーで読み、登録するお客様（行、お名前、フリガナ、メールアドレス、電話番号、会員ランク）か、ファイルの誤りを行と項目ごとに出す。「2 人を登録する」。「ファイルの書き方」に、列名、項目、書き方の表。登録したら顧客台帳へ移る | `GET /salons/{id}`、`POST /customers/bulk` |
| `/salons/:salonId/customers/:customerId` | お客様の台帳（「台帳」、「来店とポイント」、「カルテ」、「好み設定」、「このサロンでの利用」、「ご本人からの請求」、「台帳の管理」）。「予約を入れる」（このお客様を選んだ、今日の予約を入れる画面へ）と「台帳を直す」。「来店とポイント」に「ポイントの履歴」、「カルテ」に「カルテを見る」。紹介元は、紹介したお客様の名前で、そのお客様の台帳へのリンク。「好み設定」に「好み設定を直す」。「このサロンでの利用」は、集計する期間（アドレスのクエリの `from`、`to`。初めは今日までの 366 日）の予約、利用額、予約 1 件あたりの会計、最後の来店、キャンセル率、無断キャンセル率、よく受けたメニュー、よく担当したスタッフと、「施術記録を見る」（このお客様の条件の施術記録の一覧へ）。「ご本人からの請求」の「データの開示」に「データを出力する」（このお客様のデータを JSON ファイルに保存する）、「データの消去」に最新の削除の依頼と、「消去の依頼を受け付ける」（理由を書くダイアログ）か「依頼を取り消す」（確かめるダイアログ）。「台帳の管理」に「変更履歴」、「ほかのお客様とまとめる」と「台帳から削除する」。台帳から削除されたお客様は、オーナーなどには、同じアドレスで、削除されたときの台帳と「台帳に戻す」、「ご本人からの請求」の「データの消去」（依頼と、進行中の依頼の取り消し） | `GET /salons/{id}`、`GET /customers/{id}`、紹介元の `GET /customers/{id}`、`GET /customers/{id}/preferences`、好み設定のスタッフごとに `GET /staff-profiles/{id}`、`GET /customers/{id}/statistics`、`GET /customers/{id}/export`、`GET`・`POST`・`DELETE /customers/{id}/deletion-request`、`DELETE /customers/{id}`。削除されたお客様は `GET /customers/{id}/history?limit=1`、`GET /customers/{id}/versions/{version}`、`POST /customers/{id}/restore`、`GET`・`DELETE /customers/{id}/deletion-request` |
| `/salons/:salonId/customers/:customerId/edit` | 台帳を直す。登録と同じフォームを、いまの台帳の内容と紹介元の名前で開く。お客様の台帳へ戻る | `GET /salons/{id}`、`GET /customers/{id}`、紹介元の `GET /customers/{id}`、`PATCH /customers/{id}`、紹介元を探すときと、断られたときに `GET /customers` |
| `/salons/:salonId/customers/:customerId/preferences` | 好み設定を直す。お客様がポータルで使うのと同じフォーム（指名したいスタッフ、避けたいスタッフ、希望する時間帯、スタイルの好み、接客の好み、特別な要望）を、いまの好み設定で開く。お客様の台帳へ戻る | `GET /salons/{id}`、`GET /customers/{id}`、`GET /customers/{id}/preferences`、`GET /staff-profiles?salonId=`、このサロンにいない、保存されたスタッフごとに `GET /staff-profiles/{id}`、そのサロンごとに `GET /salons/{id}`、`PATCH /customers/{id}/preferences` |
| `/salons/:salonId/customers/:customerId/history` | 変更履歴。版（版の画面へのリンク「版 3」）、操作、日時、変更者、変えた項目。新しい順に 20 件ずつ（「さらに表示」）。「お客様の台帳へ」 | `GET /salons/{id}`、`GET /customers/{id}`（削除されたお客様は、最新の版）、`GET /customers/{id}/history` |
| `/salons/:salonId/customers/:customerId/history/:version` | 台帳の版。「版 3・更新・日時・変更者」、更新と統合の版は前の版から変えた項目（項目、前の版、この版）、その版の台帳の項目。「変更履歴へ」 | `GET /salons/{id}`、`GET /customers/{id}`（削除されたお客様は、最新の版）、`GET /customers/{id}/versions/{version}`、更新と統合の版は前の版の `GET /customers/{id}/versions/{version}` |
| `/salons/:salonId/customers/:customerId/points` | ポイント。「残高」と「ポイントを記録する」、「期限が近いポイント」（30 日以内に期限が来る、残っているポイントの合計と最も早い期限。期限を過ぎて、まだ失効していないものを含む。付与の有効期限、種類、ポイント数、日時、説明）、ポイントの履歴（日時、種類、増減、残高、有効期限、もとになった記録、説明。説明は長くなるので最後）を新しい順に 20 件ずつ（「さらに表示」）。「お客様の台帳へ」 | `GET /salons/{id}`、`GET /customers/{id}`、`GET /points/customer/{id}/balance`、`GET /points/customer/{id}/expiring`、`GET /points/customer/{id}/transactions`、もとになった記録ごとに `GET /sales/{id}` と `GET /bookings/{id}` |
| `/salons/:salonId/customers/:customerId/points/new` | ポイントを記録する。記録すること（「ポイントを付与する」「使ったポイントを記録する」「調整で増やす」「調整で減らす」。初めはアドレスのクエリの `kind`）、ポイント数、有効期限（付与だけ）、説明、アドレスのクエリの `saleId` の売上に結びつけること。ポイントへ戻る | `GET /salons/{id}`、`GET /customers/{id}`、`GET /points/customer/{id}/balance`、`GET /sales/{id}`、`POST /points/earn`、`POST /points/use`、`POST /points/adjust`。断られたとき（409）に `GET /points/customer/{id}/balance` と `GET /sales/{id}` |
| `/salons/:salonId/customers/:customerId/merge` | ほかのお客様とまとめる。台帳をキーワードで探し（アドレスのクエリの `keyword`）、見つかったお客様の名前で、まとめる相手を選ぶ（`with`。このお客様は「（このお客様）」と出し、選べない）。選んだら、相手の名前と「相手を選び直す」、残すお客様（このお客様か相手）、2 人の値が違う項目（残すお客様の値、まとめるお客様の値、あとから台帳を直したほうの値）、2 人で違う項目の表（項目、残すお客様、まとめるお客様、まとめたあと）、ほかに移るものとポイントの合計、まとめられない理由か「まとめる」 | `GET /salons/{id}`、`GET /customers/{id}`、`GET /customers`、相手の `GET /customers/{id}`、2 人の `GET /customers/{id}/deletion-request` と `GET /medical-charts/customer/{customerId}`、`POST /customers/merge` |

- **入口**は、ヘッダーの「顧客」（「予約」「売上」と並ぶ）、予約の内容のお客様の名前、予約を入れる画面で、キーワードに合うお客様が見つからなかったときの「お客様を登録する」。予約を入れる画面は、台帳にないお客様を登録しない。登録したお客様の台帳の「予約を入れる」で、そのお客様を選んだ予約を入れる画面へ戻る（`/salons/:salonId/bookings/new?date=<今日>&customerId=<ID>`）
- **台帳の条件は、アドレスにある**（`src/customers/customer-ledger.ts`）。条件を変えると、アドレスを置き換え、「条件を外す」で、台帳のすべてのお客様に戻る。日付でない値、終わりが始まりより前の範囲、ないステータスとランクのアドレスは、それを除いた条件で出す。フォームの誤り（日付でない、終わりが始まりより前）は、送らずにその欄に出す。登録日は、サロンの日の始まりと終わりの時刻にして送る（`registeredFrom`、`registeredTo`。API はミリ秒まで比べるので、終わりは次の日の始まりの 1 ミリ秒前）。条件に合うお客様がいなければ、そのことと「お客様を登録する」を出す
- **タグ**は、読点（、）かカンマ（全角も）で区切って書く。間に何もないところはタグにせず、2 回書いたタグは 1 つにする（API はタグの重複を断る）。フォームとお客様の台帳は、タグを「、」で区切って出す
- **登録**は、姓、名、メールアドレス、電話番号が必須。会員ランクは「レギュラー」、ステータスは「通常」、「有効なお客様」はチェックした状態で開く。紹介元は「なし」で開く。どの欄も、ブラウザーの自動入力を使わない（入力するのはお客様ではなく、サロンの人）。登録したあとは、応答のお客様をお客様の台帳の読んだものに置き、読んであった台帳の一覧を捨て（`removeQueries`）、「〇〇 様を台帳に登録しました。」と通知して、お客様の台帳へ移る
- **台帳を直す画面**は、開くたびにお客様を読み直し、読み終えてからフォームを出す（前に読んだ内容で開かない）。開いたときの値と比べて、変えた項目だけを `PATCH` で送る（テキストは前後の空白を除き、空は null、メールアドレスは小文字で比べる）。その間にほかのサロンが書いた項目は、ここで変えていなければ残る。何も変えていなければ、送らずに「変更はありませんでした。」と伝えて戻る。直したあとは、応答のお客様を読んだものに置き、読んであった台帳の一覧を捨て、「台帳を直しました。」と通知して、お客様の台帳へ戻る。開いている間に台帳から削除されていたら（404）、「お客様が見つかりません」と、顧客台帳へのリンクを出す
- **ほかのお客様と同じ値**（409）: メールアドレスは削除していないお客様の間で、紹介コードは削除したお客様も含めて、一意（API）。API の 409 は、どちらの値かを言わないので、送ったのがメールアドレスだけならメールアドレス、紹介コードだけなら紹介コードの欄に出す。両方を送ったときは、台帳をメールアドレスで探し（`GET /customers?search=`、100 人）、ほかのお客様が持っていればメールアドレス、いなければ紹介コードの欄に出す。どちらも、フォーカスをその欄へ移し、書いた内容は残る
- **お客様の台帳**は、開くたびにお客様を読み直す（前に読んだ内容を先に出し、読み直したら置き換える）。値のない項目は「未登録」、タグと紹介元のないお客様は「なし」、紹介コードのないお客様は「未発行」。有効でないお客様は「無効（ご自分では予約を入れられません）」（自分で入れる予約だけが断られる。[顧客台帳](./customers.md)）。台帳から削除されたお客様は、スタッフには、ない ID と同じく「お客様が見つかりません」（オーナーなどには、下の「削除されたお客様の画面」）
- **紹介元**は、台帳のお客様の ID で、打ち込まずに選ぶ。フォームの節「紹介」に、いまの紹介元の名前（ない、と「なし」）を書き換えられない欄で出し、ID は隠れた欄で送る。「紹介元を選ぶ」はダイアログを開き、台帳をキーワードで探して（予約を入れる画面と同じ `GET /customers?search=`、20 人ずつ）、押したお客様を紹介元にする。ダイアログを閉じると、フォーカスは「紹介元を選ぶ」に戻る。「紹介元を外す」で外す。ダイアログは、最後に探した結果を、フォームを開いている間、残す。直すときは、そのお客様自身も探した結果に出るが、「（このお客様）」と添えて、選べない（API は自分自身を断る。`circular`）。台帳を直す画面は、いまの紹介元を読み直してから、フォームを出す。台帳から削除されたお客様（404）は「台帳にいないお客様」と出し、変えなければ送らない（API は、紹介元が削除されても値を残す）。開いている間に、選んだお客様が削除されていたとき（400 の `referredBy` の `not_found`）は、紹介元の欄に出し、フォーカスをそこへ移す。お客様の台帳は、紹介元を読んで名前を出す。読むまでと、読めなかったときは、「紹介したお客様」という言葉のリンク、台帳にいないお客様は、リンクにしない
- **好み設定**は、お客様がポータルで書き、サロンが「好み設定を直す」で書く、同じもの。表示のたびに読む（`staleTime` が 0）。指名したいスタッフと避けたいスタッフは、スタッフのプロフィールを 1 人ずつ読んで名前を出し、読めないスタッフ（削除された。404）は「一覧にないスタッフ」と出す。何も設定していなければ「指定なし」
- **好み設定を直す画面**は、ポータルの好み設定の変更と同じフォームと決まり（`preferences` パッケージ。[好みの設定の画面](#好みの設定の画面)）。選べるスタッフは、アドレスのサロンが公開しているスタッフと、いまの好み設定が名指す、ほかのサロンのスタッフで、サロンの名前を添える（`readPreferencesToChange`）。公開していないスタッフ（削除した、在籍していない）は出ず、その欄を変えなければ、保存されたまま残る。開くたびに好み設定とスタッフを読み直し、開いている間は読み直さない。変えた項目だけを送り、何も変えていなければ、送らずに「変更はありませんでした。」と伝えて戻る。直したあとは、お客様の台帳の好み設定のクエリを捨て（部分は、スタッフをプロフィールで名指すので、読み直す）、「好み設定を直しました。」と通知して、お客様の台帳へ戻る。開いている間にお客様が削除されていたら（404）、「お客様が見つかりません」を出す
- **このサロンでの利用**は、アドレスのサロンでの予約と売上の集計（[顧客台帳](./customers.md#統計)）。期間は、サロンの日付で、両端を含む。API が集計しない期間（366 日より長い、終わりが始まりより前、日付でない）は、アドレスにあれば使わずに今日までの 366 日を、フォームで入れたときは、送らずにその欄に出す。期間を変えると、アドレスを置き換える。集計は、表示のたびに読む。完了した予約のない期間は、メニューとスタッフの表に、そのことを出す。ほかのサロンのメンバーがアドレスで開いたとき（403）は、この部分にだけ、そのサロンの集計は見られないことを出す（台帳と好み設定は、どのサロンのメンバーも読める）
- **台帳からの削除、統合、台帳に戻すこと、変更履歴と版**は、オーナー、マネージャー、管理者が使う（API の権限。統合は、まとめるお客様を台帳から削除するので、削除と同じ）。スタッフには、「台帳の管理」の節に「台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。」とだけ出し、ボタンとリンクを出さない。変更履歴と版と統合のアドレスを開いたスタッフにも、同じことを出す（`src/customers/customer-history.ts` の `mayKeepCustomers`）。**出力と削除の依頼**も同じロールが使う。スタッフには、顧客台帳に「CSV に出力する」を出さず、「ご本人からの請求」の節には「ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。」とだけ出し、削除の依頼を読まない
- **台帳から削除する**は、ダイアログ「山田 花子 様を台帳から削除しますか？」で確かめる（説明は、予約で選べなくなること、予約と売上の記録が残ること、台帳に戻せること。ボタンは「戻る」と「削除する」）。削除したら、同じアドレスのまま、削除されたお客様の画面に替わり、見出しにフォーカスを移して、「山田 花子 様を台帳から削除しました。」と通知する。読んであった台帳の一覧と、このお客様の下のクエリ（変更履歴、版、好み設定、集計）を捨て、お客様のクエリには 404 を置く。終わっていない予約がある（409）ときは、ダイアログを閉じ、節に、予約を終えてからやり直すことを出す。開いている間に、ほかで削除されていた（404）ときは、通知せずに、削除されたお客様の画面に替わる。送れなかったときは、ダイアログの中に出す
- **削除されたお客様の画面**: API は、台帳では、削除したお客様と、いないお客様を区別しない（どちらも 404）。お客様が 404 のとき、オーナーなどには、変更履歴の最新の版を読み（`readRemoved`）、その操作が削除（`delete`）、統合（`merge`）、消去（`erase`）なら、その版を読んで、「2026年11月20日（金） 10:33 に、あなたが台帳から削除しました。」と、そのときの台帳の項目（お客様の台帳と同じ言葉と並び）、「台帳に戻す」と「変更履歴」を出す。統合と消去で外れたお客様は、戻せない理由を出し、「台帳に戻す」を出さない（API は 409）。変更履歴も 404 なら、「お客様が見つかりません」。スタッフには、いままでどおり「お客様が見つかりません」。最新の版が削除でない（その間に戻された）ときは、読み直しを促す
- **台帳に戻す**は、ダイアログなしで戻す（もう一度削除すれば元に戻る）。戻したら、応答のお客様をお客様のクエリに置き、同じアドレスのまま、お客様の台帳に替え、見出しにフォーカスを移して、「山田 花子 様を台帳に戻しました。」と通知する。削除のあとに、同じメールアドレスのお客様が登録されていた（409 の `already-exists`）ときは、そのことと、そのメールアドレスで探した顧客台帳へのリンク「そのお客様を台帳で探す」を出す。その間に戻されていた、統合された（409 の `operation-not-allowed`）、いない（404）ときは、お客様と最新の版を読み直す
- **変更者**は、API がアカウントの ID で返し、サロンの人がアカウントの名前を読む API はない。サインインしているアカウントは「あなた」、お客様のアカウント（お客様の `userId`）は「お客様ご本人」、ほかは「ほかのアカウント」、記録の開始（`baseline`）は空。削除するとアカウントとの紐づけは外れ、版は `userId` を持たないので、削除されたお客様の履歴では、お客様ご本人の変更も「ほかのアカウント」になる
- **変えた項目**は、API の `changes` の項目を、お客様の台帳の言葉にする（`src/customers/components/customer-record/ledger-items.tsx` の `changedTermsOf`。住所の 5 つの値は「住所」、`preferences` は「好みのメニュー」と「好みについてのメモ」）。台帳にない項目の名前は、API の名前のまま出す。値を変えなかった更新は「なし」、登録や削除のように台帳の全体である版は空
- **版の画面**は、更新と統合の版だけ、前の版（番号が 1 つ前）を読んで、表示の違う項目を「前の版から変えた項目」に出す（`changedItemsOf`。好み設定は、メニューとメモを分けて比べる）。前の版が読めなかったときは、そのことと、この版の台帳の項目だけを出す。ない版（404）は「この番号の版はありません。」。版の値は変わらないので、`staleTime` は既定（5 分）のまま
- **ポイント**は、お客様のもので、サロンのものではない（どのサロンでも付与し、使える。[ポイント台帳](./points.md)）。残高、期限が近いポイント、履歴は、表示のたびに読み（`staleTime` が 0）、それぞれが、読めなかったことを自分の場所に出す。履歴の種類は、付与、利用、調整、失効、統合による移行。増減は「+500」「−200」と符号をつけ、残高の列と見分ける
- **もとになった記録**は、売上と予約を 1 件ずつ読み、番号（「売上 SL-…」「予約 BK-…」）で、その記録のサロンの売上と予約の画面へのリンクにする。読めないもの（ほかのサロンの記録。API は 404）は「ほかのサロンの売上」「ほかのサロンの予約」と出し、リンクにしない。統合で移したポイントは「統合したお客様」で、統合したお客様の台帳へのリンク
- **期限が近いポイント**は、30 日以内に期限が来る、使われずに残っているポイント。期限を過ぎて、まだ失効させていないポイントも、失効させるまでは使える（API）ので含め、そのことを添えて、有効期限に「（期限切れ）」をつける。表のポイント数は、付与したポイント数で、残っている数ではない（API）。失効は、すべてのお客様の、期限を過ぎたポイントを管理者がまとめて実行するもの（API は `admin` だけ）で、この画面では扱わない
- **記録すること**は、ラジオボタンで選び、ポイント数は、どれも 1 以上で書く（符号を書かせない）。減らす調整は、API に負の数で送る。調整は、オーナー、マネージャー、管理者だけに出す（`src/customers/points.ts` の `pointKindsFor`。API の権限）。ポイント数（1〜2,147,483,647 の整数。全角の数字とカンマも読む）と、有効期限（空なら期限なし。サロンの今日より前は「有効期限は、今日以降の日付にしてください。」）の誤りは、送らずにその欄に出す。説明は、前後の空白を除き、空なら null
- **売上に結びつける**: 売上の内容の節「ポイント」（お客様のいる、取り消していない売上だけ）の「使ったポイントを記録する」と「ポイントを付与する」は、その売上と、押したほうの `kind` を、ポイントを記録する画面のアドレスに入れる。画面は、その売上を読み、「売上番号 SL-…（日時、合計）に結びつける」チェックボックスを、チェックした状態で出す（外せば、売上に結びつけずに記録する）。読めない売上（ない、ほかのサロン）、取り消した売上、ほかのお客様の売上、お客様のいない売上は、そのことを出し、チェックボックスを出さない（API は 400 か 409）。1 つの売上には、付与と利用を 1 回ずつ記録できる（二重に付与しないのは、売上を参照したときだけ。API）
- **記録したあと**は、このお客様のポイントのクエリを捨てて、ポイントの画面へ戻り、「500 ポイントを付与しました。残高は 3,000 ポイントです。」（利用は「使いました」、調整は「調整で200 ポイント増やしました」「減らしました」）と通知する。残高は、記録の応答にある。お客様の台帳の残高（`loyaltyPoints`）は、お客様を読む画面が開くたびに、お客様といっしょに読み直す（`WithCustomer`。ポイントの画面に戻ったときにも読む）。読み直しが終わるまでは読んであったお客様を出すので、記録したら、読んであったお客様の残高を、応答の残高に置き換える（`withBalance`）。読み直す前に台帳を開いても、記録したあとの残高が出る
- **断られたとき**（409）: API は理由を言わないので、残高と売上を読み直して見分ける（`whyRefused`）。取り消した売上は「取り消した売上には、ポイントを付与も利用もできません。」、残高より多く減らすときは、ポイント数の欄に「残高（800 ポイント）より多くは減らせません。」、上限を超えるときは「残高が上限（2,147,483,647 ポイント）を超えるため、記録できません。」、それ以外で売上に結びつけたときは「この売上には、もうポイントを付与しています（使ったポイントを記録しています）。ポイントの履歴をお確かめください。」。開いている間に台帳から削除されたお客様（400 の `customerId`）は、「お客様が見つかりません」に替わる
- **CSV から登録する**: ファイルの形は、[台帳の CSV 出力](./customers.md#台帳の-csv-出力)と同じ。1 行目は列名で、登録の本文の 30 項目を、API の名前（`lastName` など）で書く。`lastName`、`firstName`、`email`、`phoneNumber` の列は必ず要る。ない列は、登録のフォームが開くときの値（会員ランクはレギュラー、ステータスは通常、有効なお客様、送ってよい連絡はなし、ほかは空）。出力にしかない列（`id`、`loyaltyPoints`、`visitCount`、`createdAt` など 10 列）は読み飛ばし、どちらでもない列名、2 回書いた列名、名前のない列は誤り。値は、登録のフォームと同じ決まりで、1 人ずつ読む（`readCustomerEntry`）。出力が、数式にしないために値の前に付けた `'` は外す。`true` と `false` の列、`preferences`（出力と同じ JSON）、`tags`（出力の JSON の配列か、「、」とカンマの区切り）は、ファイルの書き方で読む。空の行は読み飛ばすが、行の番号は数えたまま。文字コードは、UTF-8（BOM があってもよい）で読み、読めない文字があれば Shift_JIS で読む（表計算ソフトが保存する CSV）
- **ファイルの誤り**は、行と項目ごとに、すべてを出し（「3 行目 メールアドレス: …」）、何も送らない。閉じていないダブルクォート、空のファイル、お客様のいないファイル、101 人以上（API は 1 回に 100 人まで）、列の数と値の数の合わない行、ファイルの中で同じメールアドレス（大文字と小文字は同じ）と紹介コードも、ここで出す。ファイルを選び直すと、読み直す。誤りのあるまま、またはファイルを選ばずに「登録する」を押すと、ファイルの欄に誤りを出し、フォーカスを移す
- **まとめて登録する**: ファイルのすべてのお客様を 1 回で送る（API は、全員を登録するか、だれも登録しない）。登録したら、読んであった台帳の一覧を捨て、「2 人を台帳に登録しました。」と通知して、顧客台帳へ移る（登録の新しい順なので、登録したお客様が先頭に並ぶ）。断られたときは、どのお客様も登録していないことと、理由を行ごとに出す。値の誤り（400）は、`items.<n>.<項目>` を n 番目のお客様の行に出し、紹介元が台帳にいない（`not_found`）ときは「台帳にいないお客様の ID です。…」。ほかのお客様と同じ値（409）は、API が `detail` に書く値（`Customer with email … already exists`）を、ファイルのメールアドレスと紹介コードと、語として比べて、その行に出す。本文が大きすぎるとき（413）は、ファイルを分けることを出す
- **選んだお客様**: 台帳の表の「選ぶ」のチェックボックスで選ぶ（ラベルは「山田 花子 様を選ぶ」で、画面には出さない）。選んだお客様は、選んだときの条件のもので、条件を変えると、だれも選んでいない状態に戻る（条件を戻しても、選び直さない）。表の上の節「2 人を選んでいます」に、「タグを付ける・外す」、「台帳から削除する」（オーナー、マネージャー、管理者だけ）、「選ぶのをやめる」。だれも選んでいないときは、その節に、選ぶと何ができるかを出す（最初の 1 人を選んでも、表が動かない）。101 人以上を選ぶと、そのことを出し、ボタンを押せなくする（API は 1 回に 100 人まで）。選んだ最後のお客様がいなくなったとき（選ぶのをやめる、削除）は、フォーカスを節の見出しへ移す
- **タグを付ける・外す**は、ダイアログ「選んだ 2 人のタグ」で、付けるか外すかと、タグを 1 つ書く（「、」とカンマは誤り）。送る前に、選んだお客様を読み直し（`POST /customers/batch/get`）、タグが変わるお客様だけを、読み直したタグに足すか、そこから除いて送る（`PATCH /customers/bulk`。その間に付けられたほかのタグは残る）。だれのタグも変わらないときは、送らずに、そのことを伝える。終えたら、変えた人数で「1 人にタグ「vip」を付けました。」と通知し、台帳を読み直す。お客様は選んだまま
- **まとめて台帳から削除する**は、ダイアログ「2 人のお客様を台帳から削除しますか？」で、削除するお客様の名前を並べて確かめる（`DELETE /customers/bulk`）。削除したら、だれも選んでいない状態に戻し、「2 人を台帳から削除しました。」と通知して、台帳を読み直す。終わっていない予約のあるお客様がいる（409）ときは、API が `detail` に書く ID のお客様の名前と、だれも削除していないことを、ダイアログの中に出す
- **その間に台帳からいなくなったお客様**（ほかで削除された）がいるときは、だれのタグも変えず、だれも削除せず、「選んだお客様のうち、〇〇 様は、もう台帳にいません。…」と通知して、そのお客様を選ぶのをやめ、ダイアログを閉じて、台帳を読み直す。API の 404 は最初の 1 人しか言わないので、選んだお客様を読み直して、いないお客様をすべて見つける
- **ほかのお客様とまとめる**（統合。[顧客台帳](./customers.md#統合)）: 入口は、お客様の台帳の節「台帳の管理」の「ほかのお客様とまとめる」。相手は、紹介元を選ぶダイアログと同じ検索（`FoundCustomers`）で探し、名前のリンクで選ぶ。キーワードと選んだ相手はアドレスのクエリなので、再読み込みしても同じ相手を出し、ブラウザーの戻るで、探した一覧に戻る。選んだときと「相手を選び直す」で、探す部分とまとめる部分が入れ替わるので、フォーカスを節の見出し「まとめる相手」へ移す
- **相手を選んだら**、相手と、2 人の削除の依頼とカルテを、まとめて読む（5 つの読み込み。依頼とカルテのないお客様は 404 で、ないものとして読む）。相手がいない（404）ときは「選んだお客様は、台帳にいません。…」と「相手を選び直す」。名前は同じことが多いので、ラジオボタン、ダイアログの説明、まとめられない理由、断られたときの言葉では、お客様を「山田 花子 様（hanako@example.com）」と、メールアドレスを添えて言う
- **2 人で違う項目**は、お客様の台帳の項目のうち、2 人で表示が違う項目だけを出す。まとめたあとの値は、API と同じ決まりで画面が求める（`mergedLedgerOf`）: 2 人とも同じならその値、片方だけが値を持つ（タグは空でない）ならその値、違えば選んだほう（「あとから台帳を直したほうの値」は `updatedAt` の遅いほう、同じなら残すお客様）。紹介元が 2 人のどちらかなら、値がないものとして扱う。値のセルは、ほかの表と違って折り返す（メモや住所は長く、まとめたあとの列が見えなければならない。狭い画面では、表を横に動かす）。違う項目がなければ「2 人の台帳の項目は、すべて同じです。」。表の下に、予約、売上、施術記録、レビューは残すお客様のものになり、好み設定、カルテ、アレルギーは合わせ、ポイントは 2 人の残高の合計になることを出す
- **まとめられない理由**は、送る前に、すべてを出し、「まとめる」を出さない（API が断ることが分かっているため）: 2 人ともアカウントを持つ（`userId`）、どちらかに受け付けた削除の依頼がある、ポイントの合計が 2,147,483,647 を超える、カルテの施術歴、使いたい製品、避けたい製品のどれかが、合わせて（同じものは 1 つとして）50 件を超える
- **確かめるダイアログ**は「2 人のお客様を 1 人にまとめますか？」で、説明に、残すお客様と、台帳から削除するお客様と、台帳に戻せないことを書く（ボタンは「戻る」と「まとめる」）。まとめたら、残すお客様の台帳へ移り、「2 人のお客様を、山田 花子 様にまとめました。」と通知する。台帳の一覧と、2 人の下のクエリ（変更履歴、ポイント、好み設定、集計）を捨て、残すお客様のクエリに応答のお客様を、まとめたお客様のクエリに 404 を置く
- **断られたとき**: その間に記録が変わった（409）ときは、ダイアログを閉じ、「その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。」と出して、2 人を読み直す（409 の `detail` の言い回しには頼らず、読み直した記録から、まとめられない理由を出す）。2 人のどちらかが、その間に台帳を出た（400 の `not_found`）ときは、そのお客様を名前で言い、読み直す。ダイアログとそれを開いたボタンがなくなるので、フォーカスを節の見出しへ移す。送れなかったときと、アクセスが多すぎるときは、ダイアログの中に出す
- **台帳の CSV 出力**（[顧客台帳](./customers.md#台帳の-csv-出力)）: 顧客台帳の「CSV に出力する」は、アドレスの条件（表に見えているお客様と同じ条件。登録日は、一覧と同じく、サロンの日の始まりと終わりの時刻にする）で、API が書いた CSV を保存する。ファイル名は API の `Content-Disposition` の名前（`customers-2026-11-20.csv`）、中身は API の本文に BOM を付け直したもの。保存したら「2 人のお客様を、customers-2026-11-20.csv に出力しました。」と通知する（人数は、ファイルの行を、引用符の中の改行を数えずに数える）。条件に合うお客様がいなければ、ファイルを保存せず、見出しの下に「条件に合うお客様がいないため、出力しませんでした。」。10,000 人を超える（409）ときは「条件に合うお客様が 10,000 人を超えるため、出力できません。条件を絞ってから、もう一度出力してください。」。送れなかったときも、見出しの下に出し、もう一度押せる。言ったことは、そのときの条件のもので、条件を変えると消える
- **お客様のデータの出力**（[顧客台帳](./customers.md#顧客のデータの出力)）: お客様ご本人から、保有している個人データの開示を求められたときのもので、お客様の台帳の節「ご本人からの請求」に、何のためのものかと「データを出力する」を出す（ご本人であることは、サロンが確かめる）。保存するファイルは、API が書いたとおりの JSON（2 文字の字下げ）で、名前は `customer-<ID>.json`。保存したら「山田 花子 様のデータを、customer-….json に出力しました。」と通知する。その間に台帳から削除されていた（404）ときは、削除と同じく、同じアドレスで削除されたときの台帳に替え、見出しにフォーカスを移す。節は「台帳の管理」の前に置く（請求に応えることは、台帳を管理することとは別で、削除の依頼も同じ節に入る）。節の中は「データの開示」と「データの消去」の 2 つに分ける
- **お客様のデータの消去の依頼**（[顧客台帳](./customers.md#削除の依頼)）: お客様ご本人から、保有している個人データの消去を求められたときのもので、「ご本人からの請求」の「データの消去」に、最新の依頼を出す。依頼がなければ、消去が何を消して何を残すか（売上と予約は帳簿の保存のために残し、お客様を特定できる情報を消す）と、受け付けてから 14 日は取り消せることを書き、「消去の依頼を受け付ける」。ダイアログで理由（必須、1,000 文字まで、空白だけは不可。書いたとおりに送る）を書いて受け付けると、ダイアログを閉じ、受け付けた日時、消去の予定（「〜 以降」）、理由と「依頼を取り消す」を出し、「山田 花子 様のデータの消去の依頼を受け付けました。2026年12月4日（金） 10:30 以降に消去します。」と通知して、節の見出しにフォーカスを移す。取り消しは、確かめるダイアログ（「戻る」「取り消す」）のあとで送り、取り消した依頼（「〜に受け付けた依頼は、〜に取り消しました。」）と、新しい依頼を受け付けるボタンを出す。日時はサロンのタイムゾーン。予定日時を過ぎていても、実行されるまでは取り消せる。その間にほかのアカウントが受け付けていた（409）とき、取り消しで依頼がもう進行中でなかった（404。取り消されたか、消去が実行された）とき、ロールで断られたときは、ダイアログを閉じ、お客様と依頼を読み直し、そのことを節の見出しの下に出して、見出しにフォーカスを移す。消去が実行されていれば、お客様は台帳から外れているので、同じアドレスが削除されたときの台帳になる。受け付けの 404 は、その間に台帳から削除されたお客様で、削除と同じく、削除されたときの台帳に替える。削除されたお客様の画面にも「データの消去」を出し、進行中の依頼は取り消せるが、新しい依頼は受け付けない（API は、台帳に戻してから受け付ける）。消去が終わった依頼は「〜に受け付けた依頼により、〜にデータを消去しました。消去したことを、ご本人にお知らせください。」。消去の実行（`POST /customers/deletion-requests/execute`）は、管理者だけのもので、ダッシュボードの画面にする
- **API を呼ぶ関数**は `src/customers/customers-api.ts` と、削除、台帳に戻すこと、変更履歴と版の `customer-history-api.ts`、まとめての登録、タグ、削除の `customer-bulk-api.ts`、統合と、統合の前に読むものの `customer-merge-api.ts`、出力の `customer-export-api.ts`、削除の依頼の `customer-erasure-api.ts`（統合も、これで依頼を読む）にある。どれも reject せず、画面が区別する結果の直和型を返す。台帳の条件とアドレスは `customer-ledger.ts`、CSV ファイルの読み方（文字コード、列、値）と、登録したあとの言葉は `customer-file.ts`、選んだお客様、タグの変え方、まとめて書いたあとの言葉は `customer-bulk.ts`、まとめたあとの台帳の値、まとめられない理由、まとめたあとの言葉は `customer-merge.ts`、出力したあとの言葉は `customer-export.ts`、削除の依頼の理由の読み方、依頼の状態の言葉、受け付けと取り消しのあとの言葉は `customer-erasure.ts`、フォームの読み方と変えた項目、断られたときの言葉、紹介元（`Referrer`）は `customer-form.ts`、紹介元を探すダイアログの中身は `referrer-choice.tsx`（キーワードで探したお客様の表は、統合の相手を探すのと共有する `found-customers.tsx`）、集計する期間は `customer-statistics.ts`、削除と台帳に戻したあとのこと、操作の言葉、変更者は `customer-history.ts`、ポイントのフォームの読み方、断られた理由、ポイントの言葉は `points.ts`（API を呼ぶのは `points-api.ts`）、ランクとステータスの言葉、住所と連絡先の書き方は `customer-format.ts` の純粋な関数。サロンの日の始まりの時刻は、`src/salon-time.ts` の `startOfDayAt`
- **表示するだけの部品**は、台帳の絞り込み（`CustomerFilter`）、台帳の表（`CustomerTable`）、お客様のフォーム（`CustomerForm`）、紹介元の欄（`ReferrerField`）、紹介元を選ぶダイアログ（`ReferrerDialog`）、探したお客様の表（`CustomerChoices`。予約を入れる画面と共有）、お客様の台帳と来店とポイント（`CustomerRecord`）、好み設定（`CustomerPreferences`）、集計する期間（`StatisticsPeriod`）、このサロンでの利用（`CustomerStatistics`）、台帳の管理の節と削除のダイアログ（`CustomerKeeping`）、削除されたお客様（`RemovedRecord`）、変更履歴の表（`CustomerHistory`）、台帳の版（`VersionRecord`）、残高（`PointBalance`）、期限が近いポイント（`ExpiringPoints`）、ポイントの履歴（`PointHistory`）、ポイントを記録するフォーム（`PointEntryForm`）、選んだお客様の節とダイアログ（`ChosenCustomers`）、CSV ファイルを選んで読んだ内容を出すフォーム（`CustomerImportForm`）、ファイルの列の表（`FileColumns`）、2 人のお客様をまとめる部分とダイアログ（`CustomerMerge`）、ご本人からの請求の節とデータの開示（`CustomerRequests`）、データの消去と 2 つのダイアログ（`CustomerErasure`）。台帳の項目の言葉と並びは、お客様の台帳、削除されたお客様、版、統合が共有する（`ledger-items.tsx`）。`ui` のカタログに、`Admin/…` として並ぶ

### カルテの画面

admin-app の `src/charts/` に、お客様のカルテ（ほかのサロンで受けた施術、施術の前に注意が必要な持病や体調、好みの商材と避ける商材、メモ）とアレルギーを見て、カルテを作り、直し、アレルギーを記録し、直し、削除する画面と、カルテの中身でお客様を探す画面があります。顧客台帳と同じロール（`owner`、`manager`、`staff`、`admin`）で使います。決まりは [カルテ](./medical-charts.md) です。カルテとアレルギーはお客様のもので、カルテはお客様 1 人に 1 つ、アレルギーはアレルゲンごとに 1 件、どのサロンのアドレスで開いても同じです。アレルギーは、カルテがなくても記録できます。サロンは、日付と日時（サロンのタイムゾーン）に使います。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/customers/:customerId/chart` | カルテ。最初に「アレルギー」（アレルゲン、重篤度、種類、症状、施術のときの注意、確かめた日、「直す」と、オーナーなどには「削除」。重い順に 20 件ずつ、「さらに表示」。「アレルギーを記録する」）。次に「カルテ」（持病や体調、好みの商材、避ける商材、メモ、最後に書いた日時と「カルテを直す」）と「過去の施術」（施術日、施術、サロン、メモ。保存した順）。カルテがなければ、カルテに書くことの説明と「カルテを作る」。「お客様の台帳へ」 | `GET /salons/{id}`、`GET /customers/{id}`、`GET /medical-charts/customer/{customerId}/allergies`、`DELETE /medical-charts/customer/{customerId}/allergies/{allergyId}`、`GET /medical-charts/customer/{customerId}` |
| `/salons/:salonId/customers/:customerId/chart/new` | カルテを作る。節「施術の前に確かめること」（持病や体調、好みの商材、避ける商材）、節「過去の施術」（1 件ずつ、施術、施術日、サロン、施術のメモと「外す」。「施術を足す」）、メモ。作ったらカルテへ戻る。カルテのあるお客様には、そのことと「カルテを直す」 | `GET /salons/{id}`、`GET /customers/{id}`、`GET /medical-charts/customer/{customerId}`、`POST /medical-charts` |
| `/salons/:salonId/customers/:customerId/chart/edit` | カルテを直す。作るときと同じフォームを、いまのカルテで開く。カルテへ戻る。カルテのないお客様には、そのことと「カルテを作る」 | `GET /salons/{id}`、`GET /customers/{id}`、`GET /medical-charts/customer/{customerId}`、`PATCH /medical-charts/{id}` |
| `/salons/:salonId/customers/:customerId/chart/allergies/new` | アレルギーを記録する。アレルゲン、種類、重篤度（重い順のラジオボタン）、症状、施術のときの注意、確かめた日。記録したらカルテへ戻る | `GET /salons/{id}`、`GET /customers/{id}`、`POST /medical-charts/customer/{customerId}/allergies` |
| `/salons/:salonId/customers/:customerId/chart/allergies/:allergyId/edit` | アレルギーの記録を直す。記録するときと同じフォームを、いまの記録で開く。カルテへ戻る。お客様のアレルギーにない ID には、そのことと「カルテへ」 | `GET /salons/{id}`、`GET /customers/{id}`、`GET /medical-charts/customer/{customerId}/allergies`（最後まで）、`PATCH /medical-charts/customer/{customerId}/allergies/{allergyId}` |
| `/salons/:salonId/customers/charts` | カルテを探す。キーワード（持病や体調、メモ、好みの商材と避ける商材の名前の一部）と、アレルギーの記録（すべて、ある、ない）の条件（アドレスのクエリの `search`、`allergies`）。行は、お客様（カルテへのリンク）、持病や体調、好みの商材、避ける商材、最後に書いた日時。新しく作ったカルテから 20 件ずつ（「さらに表示」）。「顧客台帳へ」 | `GET /salons/{id}`、`GET /medical-charts`、ページのお客様の `POST /customers/batch/get` |

- **入口**は、お客様の台帳の節「カルテ」（カルテに何を書くかの 1 文と「カルテを見る」）と、顧客台帳の見出しの「カルテを探す」。節「台帳」の見出しには、ボタンを 2 つまでしか並べない（狭い画面で、見出しからはみ出す）
- **カルテ**は、表示のたびに読む（`staleTime` が 0。どのサロンでも書くため）。書いていない項目は「未登録」、過去の施術のないカルテは、表に「記録はありません」。好みの商材と避ける商材は、タグと同じ形で並べる。お客様の台帳から削除されたお客様は、ほかのお客様の画面と同じく「お客様が見つかりません」（API は、削除されたお客様のカルテを 404 で返す）
- **フォーム**は、開くたびにカルテを読み直し、読み終えてから出す。作る画面と直す画面は、アドレスで分ける。カルテのあるお客様の作る画面と、カルテのないお客様の直す画面は、フォームを出さず、もう一方へのリンクを出す
- **過去の施術**は、1 件ずつの欄のまとまり（「1 件目の施術」）。「施術を足す」は末尾に足して、その施術の欄にフォーカスを移し、「外す」（読み上げは「1 件目の施術を外す」）は、その施術を外して、「施術を足す」にフォーカスを移す。欄の名前は、いまの行の番号（0 から）で、`previousTreatments.1.date` のように、API が誤りを言う名前と同じ。外したあとは、番号が変わるので、次に送るまで、施術の欄の誤りを出さない。50 件（API の上限）になると「施術を足す」を出さず、「過去の施術は、50 件まで書けます。」。施術と施術日は必須で、施術日は 1900年1月1日から、サロンの今日まで（API は、未来の日を断る）。サロンは 255 文字まで。施術の行は、表示した順に送り、API は一覧全体を置き換える
- **好みの商材と避ける商材**は、台帳のタグと同じく、読点（、）かカンマで区切って書き、同じ名前は 1 つにする（`tagsIn`）。1 つ 100 文字まで、50 件まで。持病や体調、メモ、サロン、施術のメモは、前後の空白を除き、空は null
- **直すとき**は、開いたときのカルテと比べて、変えた項目だけを `PATCH` で送る（過去の施術と商材は、変えたら一覧全体）。その間にほかのアカウントが書いた項目は、ここで変えていなければ残る。何も変えずに送ると、API を呼ばずにカルテへ戻り、「変更はありませんでした。」と通知する
- **書いたあと**は、応答のカルテをカルテのクエリに置き、読んであったカルテの一覧を捨てて、カルテへ戻り、「山田 花子 様のカルテを作りました。」（直したときは「直しました」）と通知する
- **断られたとき**: その間にほかのアカウントがカルテを作っていた（409）ときは、「その間に、ほかのアカウントがこのお客様のカルテを作っていました。書いた内容は、そのカルテを直して書き足してください。」と出し、書いた内容をフォームに残して、「そのカルテを直す」を出す。その間にお客様が台帳から削除されていた（作るときは 400 の `customerId`、直すときは 404）ときは、お客様のクエリを 404 に置き、「お客様が見つかりません」に替える。値の誤り（400）は、API が言う欄の下に出し（商材の名前は、一覧の欄に）、欄のない誤りは、フォームの上に「入力した内容を確かめて、もう一度お試しください。」。ロールで断られた（403）ときは「このアカウントでは、カルテを書けません。」
- **探す**の条件は、アドレスにある（`src/charts/chart-search.ts`）。キーワードは 100 文字まで。同じ条件で送ると、読み直す。カルテはお客様の ID しか持たないので、ページのお客様をまとめて読み（`POST /customers/batch/get`）、名前で出す。2 つの読み込みの間に台帳から削除されたお客様は「台帳から削除されたお客様」と出し、リンクにしない。持病や体調と商材は、長いので、列の中で折り返す（狭い画面では、表を横に動かす）。条件のないときにカルテがなければ「カルテはありません」と、カルテはお客様の台帳から作ることと「顧客台帳へ」
- **アレルギー**は、カルテの画面の最初の節。施術の前に、重いものから確かめるため、API の並び（重篤度の重い順、同じ重篤度は記録した順）のまま出す。重篤度は「命に関わる」「重い」「中程度」「軽い」の言葉で出し、命に関わるものと重いものは色でも分ける（言葉が先）。症状と施術のときの注意（10rem より狭くしない）と、長いアレルゲンは、列の中で折り返し、行の「直す」と「削除」は縦に並べる（幅 1180px からの画面に、表が収まる）。記録していない症状は「未登録」、確かめた日のないものは「不明」。行の「直す」と「削除」は、読み上げではアレルゲンの名前を言う（「強い香料の記録を直す」）。表示のたびに読む（`staleTime` が 0）
- **アレルギーのフォーム**は、アレルゲン（必須、255 文字まで）、種類（必須）、重篤度（必須。一覧と同じ重い順）、症状、施術のときの注意、確かめた日（1900年1月1日から、サロンの今日まで。空なら記録しない）。症状と注意は前後の空白を除き、空は null。直すときは、API に 1 件を読むルートがないので、お客様のアレルギーを最後まで読んで（100 件ずつ）その ID を探し、読み終えてからフォームを出す。開いたときの記録と比べて変えた項目だけを `PATCH` で送り、何も変えずに送ると、API を呼ばずにカルテへ戻り、「変更はありませんでした。」
- **アレルギーを書いたあと**は、読んであったアレルギーの一覧を捨ててカルテへ戻り、「山田 花子 様のアレルギー（PPD）を記録しました。」（直したときは「の記録を直しました。」）と通知する。記録したときは、読んであったカルテの一覧も捨てる（アレルギーの記録の有無が、探す条件にあるため）。お客様がすでに持つアレルゲン（409）は、アレルゲンの欄に「このお客様には、同じアレルゲンの記録があります。」。記録する前にお客様が台帳から削除されていた（404）ときは「お客様が見つかりません」。直すときの 404 は、お客様が台帳から削除されたときと、アレルギーが削除されたときの両方なので、お客様とアレルギーを読み直し、お客様がいなければ「お客様が見つかりません」、アレルギーがなければ「このアレルギーの記録は、ありません。ほかのアカウントが削除したのかもしれません。」と「カルテへ」
- **アレルギーの削除**は、オーナー、マネージャー、管理者だけ（API と同じ）。スタッフには「削除」を出さず、「間違えて記録したアレルギーの削除は、オーナーとマネージャーができます。」。確かめるダイアログ（「強い香料の記録を削除しますか？」、間違えて記録したときのためのもので、元に戻せないこと）のあとで削除し、一覧を読み直して、節の見出しにフォーカスを移し、「…の記録を削除しました。」と通知する。その間にほかのアカウントが削除していた（404）ときは、ダイアログを閉じ、節の見出しの下に「その間に、ほかのアカウントがこのアレルギーの記録を削除していました。」と出して、お客様とアレルギーを読み直す。送れなかったときは、ダイアログの中で言う
- **API を呼ぶ関数**は `src/charts/charts-api.ts` にある（統合の画面も、これでカルテを読む）。アレルギーは `allergies-api.ts`（一覧のページ、ID で探すこと、記録、直すこと、削除）。どれも reject せず、画面が区別する結果の直和型を返す。フォームの読み方、変えた項目、断られたときの言葉は `chart-form.ts`、探す条件とアドレスは `chart-search.ts`、アレルギーの言葉、フォーム、削除の結果は `allergies.ts` の純粋な関数
- **表示するだけの部品**は、カルテと過去の施術（`ChartRecord`）、カルテのフォーム（`ChartForm`）、探す条件（`ChartFilter`）、探したカルテの表（`ChartTable`）、アレルギーの節（`AllergyList`。表と削除のダイアログ）、アレルギーのフォーム（`AllergyForm`）。`ui` のカタログに、`Admin/Charts/…` として並ぶ

### 施術記録の画面

admin-app の `src/treatments/` に、予約の施術について、担当したスタッフが、提供したサービス、技法、頭皮と毛髪の状態、カラー剤の配合、使った商材、次の来店に勧めること、お客様の満足度、申し送りを書き、直し、読み返す画面と、施術写真を足して外す画面、サロンの施術記録を探す画面と数える画面があります。予約台帳と同じロール（`owner`、`manager`、`staff`、`admin`）で使い、削除は `owner`、`manager`、`admin` だけです。決まりは [施術記録](./treatments.md) です。施術記録は予約に 1 件で、予約のサロンのものです。API は施術記録をサロンの下に置かないので、画面は予約を読んで、ほかのサロンの予約の施術記録を「見つかりません」とします。サロンは、日付と日時（サロンのタイムゾーン）に使います。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/treatments` | 施術記録。条件は、担当、お客様（お客様の台帳から来たときだけ。「すべてのお客様にする」で外す）、書いた日（から、まで）（アドレスのクエリの `staff`、`customer`、`from`、`to`）。行は、書いた日時（施術記録へのリンク）、お客様（お客様の台帳へのリンク）、担当、サービス、施術時間、満足度。新しく書いた順に 20 件ずつ（「さらに表示」） | `GET /salons/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`GET /treatments`、ページのお客様の `POST /customers/batch/get`、条件のお客様の `GET /customers/{id}` |
| `/salons/:salonId/treatments/:treatmentId` | 施術記録の内容。「施術」（お客様、予約、担当、提供したサービス、技法、施術時間、書いた日時、直していれば最後に直した日時）、「カウンセリングと状態」、「使った商材」（商品、量、ロット番号、メモの表）、「結果と次回」（結果のメモ、満足度、次に勧める日とサービス、ホームケアの提案、申し送り）、「施術写真」（写真ごとに、縮小した写真か写真、「1 枚目：施術後の写真（正面）」、説明、使い方、「写真を開く」と「外す」。「写真を足す」）。「施術記録を直す」と、オーナーなどには「削除」 | `GET /salons/{id}`、`GET /treatments/{id}`、`GET /bookings/{id}`、`GET /customers/{id}`、`GET /salons/{salonId}/products`（最後まで）、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`DELETE /treatments/{id}`、`DELETE /treatments/{id}/photos/{photoId}` |
| `/salons/:salonId/treatments/:treatmentId/photos/new` | 施術写真を足す。写真ごとの欄のまとまり（「1 枚目の写真」）に、区分、撮った向き、写真の URL、縮小した写真の URL、写真の説明、お客様の同意、サロンの外に見せてよいかと「写真の欄を外す」。「写真の欄を足す」。足したら施術記録へ移る。20 枚ある施術記録には、そのことと「施術記録に戻る」 | `GET /salons/{id}`、`GET /treatments/{id}`、`GET /bookings/{id}`、`GET /customers/{id}`、`GET /salons/{salonId}/products`（最後まで）、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`POST /treatments/{id}/photos` |
| `/salons/:salonId/treatments/statistics` | 施術の統計。集計する期間（から、まで）（アドレスのクエリの `from`、`to`。ないときは今月の 1 日から今日まで）、「施術記録の数」（施術記録、施術時間の平均）、「メニューの区分ごと」の表、「施術記録の多いサービス」の表（10 位まで）。「施術記録の一覧へ」 | `GET /salons/{id}`、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`GET /treatments/statistics` |
| `/salons/:salonId/bookings/:bookingId/treatment/new` | 施術記録を書く。節「施術」（担当、提供したサービス、技法、施術時間）、「カウンセリングと状態」（カウンセリングのメモ、頭皮の状態、毛髪の状態、カラー剤の配合）、「使った商材」（1 件ずつ、商品、量、単位、ロットで管理する商品のロット番号、商材のメモと「外す」。「商材を足す」）、「結果と次回」（結果のメモ、お客様の満足度、次に勧める日、次に勧めるサービス、ホームケアの提案、申し送り）。書いたら施術記録へ移る。施術記録のある予約には、そのことと「施術記録を見る」。施術中でも完了でもない予約には、書けないこと | `GET /salons/{id}`、`GET /bookings/{id}`、`GET /customers/{id}`、`GET /treatments`（お客様の施術記録を最後まで）、`GET /salons/{salonId}/products`（最後まで）、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`POST /treatments` |
| `/salons/:salonId/treatments/:treatmentId/edit` | 施術記録を直す。書くときと同じフォームを、いまの施術記録で開く（担当は出すだけ）。施術記録へ戻る | `GET /salons/{id}`、`GET /treatments/{id}`、`GET /bookings/{id}`、`GET /customers/{id}`、`GET /salons/{salonId}/products`（最後まで）、`GET /staff-profiles`、`GET /salons/{salonId}/services`、`PATCH /treatments/{id}` |

- **入口**は、ヘッダーの「施術記録」（「顧客」の次）、予約の内容の節「施術記録」、お客様の台帳の節「このサロンでの利用」の「施術記録を見る」（そのお客様の条件の一覧）。施術写真は施術記録の内容の節「施術写真」から、統計は一覧の「施術の統計」から
- **予約の節「施術記録」**は、予約の状態で決まる。施術中と完了の予約には、施術記録があれば「（書いた日時）に書いた施術記録があります。」と「施術記録を見る」、なければ「まだ施術記録を書いていません。」と「施術記録を書く」。下書き、確定待ち、確定の予約には「施術を始めると、施術記録を書けます。」、取り消しと来店なしの予約には「施術をしなかった予約には、施術記録はありません。」。API の一覧に予約の条件がないので、予約のお客様の、このサロンの施術記録を最後まで読み（100 件ずつ）、予約の ID で探す（`findTreatmentOfBooking`）。施術記録は椅子の横で書くので、予約の画面を開くたびに読む（`staleTime` が 0）
- **一覧**の日付の条件は、売上台帳と同じくサロンの日付で、始まりの日の 0 時から、終わりの日の次の日の 0 時の 1 ミリ秒前までを API に渡す。終わりの日が始まりの日より前なら、送る前に「終わりの日は、始まりの日と同じか、その後にしてください。」。施術記録はお客様の ID しか持たないので、ページのお客様をまとめて読み（`POST /customers/batch/get`）、台帳から削除されたお客様は「台帳から削除されたお客様」と出し、リンクにしない。担当とサービスは、サロンのスタッフとメニューの名前で出す。満足度は「5（とても満足）」から「1（とても不満）」の言葉で出し、記録していなければ「未回答」。条件のないときに施術記録がなければ「施術記録はありません」
- **フォーム**は、書く画面でも直す画面でも、開くたびに読み直し、読み終えてから出す。担当は必須で、予約の担当を初めに選ぶ（予約の担当でなくても選べる）。提供したサービスは、予約の明細のサービスを初めに選ぶ（1〜20 件。削除されたサービスは「削除されたメニュー」として、記録にあれば選んだまま出す）。技法は、台帳のタグと同じく「、」かカンマで区切って書き（1 つ 100 文字、20 件まで）、施術時間は 0〜1440 分の整数、次に勧める日は予約の日から（前の日は「次に勧める日は、予約の日（…）から後の日にしてください。」）、満足度は「記録しない」か 5 段階。テキストは前後の空白を除き、空は null。お客様は、予約のお客様
- **使った商材**は、1 件ずつの欄のまとまり（「1 件目の商材」）で、カルテの過去の施術と同じく、「商材を足す」で末尾に足してその商品の欄に、「外す」で「商材を足す」にフォーカスを移す。50 件（API の上限）になると「商材を足す」を出さない。商品は、施術で使う取り扱い中の商品と、その行が持つ商品から選ぶ（削除された商品は「削除された商品」）。商品を選ぶと、その単位を単位の欄に入れる。量は 0 より大きく、小数第 2 位まで。ロット番号の欄は、ロットで管理する商品（`requiresLotTracking`）にだけ出し、必須。節の説明に、記録しても在庫は減らず、在庫の移動は在庫の画面で記録することを書く。商品は、サロンの商品を最後まで読む（100 件ずつ、`readProducts` of `src/products/products-api.ts`）
- **直すとき**は、開いたときの施術記録と比べて、変えた項目だけを `PATCH` で送る（サービス、技法、次に勧めるサービス、商材は、変えたら一覧全体）。サービスはメニューの順に並ぶので、記録と同じサービスを選んでいれば、順が違っても変えていないものとする。その間にほかのアカウントが書いた項目は、ここで変えていなければ残る。何も変えずに送ると、API を呼ばずに施術記録へ戻り、「変更はありませんでした。」と通知する
- **書いたあと**は、応答の施術記録を施術記録のクエリに置き、読んであった施術記録の一覧を捨てて、施術記録へ移り、「山田 花子 様の施術記録を書きました。」（直したときは「直しました。」）と通知する
- **断られたとき**: 書くときの 409 は、API が 2 つの理由（施術記録がすでにある、予約が施術中でも完了でもない）で返すので、予約の施術記録を読み直して分ける。あれば「その間に、ほかのアカウントがこの予約の施術記録を書いていました。書いた内容は、その施術記録を直して書き足してください。」と「書かれていた施術記録を見る」、なければ「この予約は、施術中でも完了でもありません。施術を始めた予約に、施術記録を書けます。」と出して予約を読み直す。どちらもフォームの上に出してフォーカスを移し、書いた内容をフォームに残す。その間に削除された予約（400 の `bookingId`）は「予約が見つかりません」に替え、台帳から削除されたお客様（400 の `customerId`）は、フォームの上に「このお客様は、その間に台帳から削除されました。施術記録は書けません。」。その間に削除されたスタッフ、サービス、商品と、その間に変わった商品のロットの管理は、それぞれの欄に言う。その間に削除された施術記録（直すときの 404）は「施術記録が見つかりません」と「施術記録の一覧へ」。ロールで断られた（403）ときは「このアカウントでは、施術記録を書けません。」
- **削除**は、オーナー、マネージャー、管理者だけ（API と同じ）。スタッフには「削除」を出さない。確かめるダイアログ（「山田 花子 様の施術記録を削除しますか？」、間違えて書いた施術記録を、使った商材と写真と一緒に削除し、元に戻せないこと）のあとで削除し、読んであった一覧を捨てて一覧へ戻り、「…の施術記録を削除しました。」と通知する。その間にほかのアカウントが削除していた（404）ときは「施術記録が見つかりません」。ロールで断られた（403）ときは、ダイアログを閉じて施術記録の上に「このアカウントでは、施術記録を削除できません。」と、削除できる人を出す。送れなかったときは、ダイアログの中で言う
- **施術写真**は、API がファイルを預からず URL を記録するので、写真を保存サービスなどに置いてから URL を書く（フォームの説明に書く）。URL は API と同じ決まり（`z.httpUrl()`。http か https で、ドメイン名のある 500 文字までの URL。IP アドレスや `localhost` の URL は API が断る）で、送る前に確かめる。施術記録 1 件に 20 枚までなので、フォームは残りの枚数まで欄を足せ、足せないときは「この施術記録に足せる写真は、あと n 枚です。」。区分は必須、撮った向きは 50 文字まで。サロンの外に見せる写真には、お客様の同意が要る（2 つのチェックボックスはどちらも選べ、同意のないまま外に見せると、そのチェックボックスに「お客様の同意がない写真は、サロンの外に見せられません。…」）。同じ URL は、フォームの前の欄（「n 枚目と同じ URL です。…」）にも、施術記録の写真（「この施術記録には、同じ URL の写真があります。…」）にも書けない。並び順は、施術記録の写真の最後の次から、欄の順。足したあとは、施術記録のクエリに写真を足して施術記録へ移り、「施術写真を n 枚足しました。」と通知する。写真の画像の `alt` は空で、キャプションが写真の区分と向き、説明、使い方（「お客様の同意あり。サロンの外にも見せられます。」など）を言う。「写真を開く」は同じタブで写真の URL を開く
- **施術写真を足して断られたとき**: 409 は、その間にほかのアカウントが同じ URL の写真を足したか、写真が 20 枚を超えるときなので、施術記録を読み直して、同じ URL の写真がある欄にはその欄に、なければフォームの上に、いま足せる枚数を言う。次に送るときは、読み直した施術記録で確かめる。その間に削除された施術記録（404）は「施術記録が見つかりません」。ロールで断られた（403）ときは「このアカウントでは、施術写真を足せません。」
- **施術写真を外す**ときは、確かめるダイアログ（「1 枚目：施術前の写真（側面）を外しますか？」、外した写真は元に戻せず、ファイルは置いてある場所に残ること）のあとで外し、節の見出しにフォーカスを移して「施術前の写真（側面）を外しました。」と通知する。その間に外されていた（404）ときは、節の上に「この写真は、その間に外されていました。」と出して施術記録を読み直す。外すのはスタッフもできる（API と同じ）
- **施術の統計**は、施術記録を書いた日（サロンの日付）で、期間の始まりの日の 0 時から終わりの日の次の日の 0 時の 1 ミリ秒前までを数える（一覧と同じ）。期間に上限はない（終わりの日が始まりの日より前なら「終わりの日は、始まりの日と同じか、その後にしてください。」）。区分のないメニューの施術記録は「そのほか」、いくつもの区分のサービスをした施術記録は区分ごとに 1 件と数えるので、表の下にそのことを書く。施術時間の平均は、施術時間を記録した施術記録の平均（小数第 1 位）で、なければ「記録なし」。サービスはメニューの名前で出し、メニューから削除されたサービスは「削除されたメニュー」と出す。期間に施術記録がなければ「この期間に書いた施術記録はありません」。施術記録は来店のたびに書くので、開くたびに読む（`staleTime` が 0）
- **見出し**は、施術記録と、それが名前を出すもの（予約、お客様、商品、スタッフ、メニュー）を読む間、同じ要素のまま（`with-treatment.tsx`）。読み終えたときに見出しが替わると、画面を移ったときに見出しが受け取ったフォーカスが失われる。施術記録の内容の画面の見出しは「施術記録の内容」で、一覧の「施術記録」と違う名前にして、その間を移るときも見出しにフォーカスを移す
- **API を呼ぶ関数**は `src/treatments/treatments-api.ts` にある（一覧のページ、予約の施術記録を探すこと、1 件、書くこと、直すこと、削除、写真を足すこと、外すこと、統計）。どれも reject せず、画面が区別する結果の直和型を返す。フォームの読み方、変えた項目、断られたときの言葉は `treatment-form.ts`、探す条件とアドレスは `treatment-search.ts`、名前と言葉、削除の結果、書ける予約は `treatment-format.ts`、写真のフォームの読み方、名前、使い方、足したときと外したときの言葉は `treatment-photos.ts`、統計の期間と数の言葉は `treatment-statistics.ts` の純粋な関数。期間のフォーム（`StatisticsPeriod`）と期間の読み方は、お客様の統計と同じもの
- **表示するだけの部品**は、施術記録のフォーム（`TreatmentForm`）、一覧の表（`TreatmentTable`）、探す条件（`TreatmentFilter`）、施術記録の内容（`TreatmentRecord`）、予約の節（`BookingTreatment`）、施術写真の節（`TreatmentPhotos`）、写真のフォーム（`PhotoForm`）、統計（`TreatmentStatistics`）。`ui` のカタログに、`Admin/Treatments/…` として並ぶ

### スタッフ台帳の画面

admin-app の `src/staff/` に、サロンのスタッフ台帳（氏名と連絡先、雇用の情報、お客様に見せる紹介、予約の受け方、在籍）を見て、スタッフを登録し、直し、無効にし、削除する画面があります。使うのは、サロンの `owner` と `admin` です（API と同じ）。決まりは [スタッフ台帳](./staff.md) です。台帳は給与と歩合、個人の連絡先を持ち、無効にすることと削除することは、そのスタッフのログインアカウントからサロンの画面を取り上げるので、`manager` と `staff` は使いません。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/staff` | スタッフ台帳。行は、表示名（スタッフの内容へのリンク）、氏名（フリガナ）、レベル、役職、予約（受ける、受けない）、状態（有効、無効）。登録した順に 20 人ずつ（「さらに表示」）。無効なスタッフも並ぶ。読み終えてから「スタッフを登録する」 | `GET /salons/{id}`、`GET /salons/{salonId}/staff` |
| `/salons/:salonId/staff/new` | スタッフを登録する。節「名前」（姓、名、フリガナ、表示名）、「連絡先」（メールアドレス、電話番号、予備の電話番号）、「雇用」（スタッフコード、レベル、役職、雇用形態、入社日、基本給、歩合率）、「紹介」（専門、資格、経験年数、紹介文、写真の URL）、「予約の受け方」（予約を受ける、同時に担当できる予約の数、予約の前と後に確保する時間）、「在籍」（有効なスタッフ）。登録したらスタッフの内容へ移る | `GET /salons/{id}`、`POST /salons/{salonId}/staff`、`GET /salons/{salonId}/staff`（409 のとき、最後まで） |
| `/salons/:salonId/staff/:staffId` | スタッフの内容。「スタッフ」（表示名、氏名、スタッフコード、レベル、役職、状態、ログインアカウントが紐づいているか、登録した日時）、「連絡先」、「雇用」、「紹介」、「予約の受け方」。「スタッフ情報を直す」と、ご自身のスタッフ情報でなければ「削除」 | `GET /salons/{id}`、`GET /salons/{salonId}/staff/{id}`、`DELETE /salons/{salonId}/staff/{id}` |
| `/salons/:salonId/staff/:staffId/edit` | スタッフ情報を直す。登録するときと同じフォームを、いまのスタッフ情報で開く。スタッフの内容へ戻る | `GET /salons/{id}`、`GET /salons/{salonId}/staff/{id}`、`PATCH /salons/{salonId}/staff/{id}`、`GET /salons/{salonId}/staff`（409 のとき、最後まで） |

- **入口**は、ヘッダーの「スタッフ」（「施術記録」の次）。`owner` と `admin` にだけ出す
- **使えないロール**: `manager` と `staff` には、API を呼ばずに「このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。」と「トップへ戻る」を出す。ほかのサロンの `owner` は API が断る（403）ので、そのときに同じことを出す
- **項目の決まり**は API と同じで、送る前に確かめる。姓と名、メールアドレス、電話番号は顧客台帳と同じ決まり。フリガナと役職は 100 文字、スタッフコードと雇用形態は 50 文字、表示名は必須で 255 文字、レベルは必須（ジュニア、スタイリスト、シニア、エキスパート、ディレクター）。入社日は 1900 年 1 月 1 日から 2999 年 12 月 31 日まで（これから入社するスタッフも登録できる）。基本給は 0 以上の円の整数（「250,000」とも書ける）、歩合率は 0〜100 で小数第 2 位まで、経験年数は 0〜100 の整数、写真の URL は http か https で始まる 500 文字までの URL。同時に担当できる予約の数は 1〜10、予約の前と後に確保する時間は 0〜120 分の整数。専門と資格は、台帳のタグと同じく「、」かカンマで区切る。テキストは前後の空白を除き、空にした任意の項目は null を送る
- **予約を受けることと、有効なスタッフ**は、別のチェックボックス。予約を受けないスタッフは、お客様が予約するときの空き枠に出ないが、サロンが入れる予約の担当には選べる。無効なスタッフは、ログインアカウントがサロンの画面を使えなくなり、お客様にも出ない。休職や退職の手続きの間は無効にし、付け直すと元に戻る。どちらもチェックボックスの説明に書く。新しいスタッフは、どちらも付けた状態で、同時に担当できる予約は 1 件、前後に確保する時間は 0 分で始まる
- **ご自身のスタッフ情報**（サインインしているアカウントが紐づいたスタッフ）は、無効にも削除もできない（API が 409 で断る）。スタッフの内容に「ご自身のスタッフ情報です。このアカウントからは、無効にすることも、削除することもできません。」と出して「削除」を出さない。フォームで「有効なスタッフ」を外して送ると、API を呼ばずに、そのチェックボックスに「ご自身のスタッフ情報は、無効にできません。…」と出す
- **直すとき**は、開いたときのスタッフ情報と比べて、変えた項目だけを `PATCH` で送る（専門と資格は、変えたら一覧全体）。その間にほかのアカウントが書いた項目は、ここで変えていなければ残る。何も変えずに送ると、API を呼ばずにスタッフの内容へ戻り、「変更はありませんでした。」と通知する
- **登録したあと、直したあと**は、応答のスタッフ情報をスタッフのクエリに置き、読んであった台帳を捨てて、スタッフの内容へ移り、「Rina Kato さんを、スタッフ台帳に登録しました。」（直したときは「スタッフ情報を直しました。」）と通知する
- **断られたとき**: 409（コード `3002`）は、送ったメールアドレスかスタッフコードを、ほかのスタッフが使っているときだが、API はどちらかを言わない。メールアドレスは台帳から削除したスタッフのものなら使え、スタッフコードは使えないので、送ったメールアドレスのスタッフがほかにいるかを、台帳を最後まで読んで（大文字と小文字を区別せず）確かめる。いればメールアドレスの欄に「このメールアドレスのスタッフが、すでに台帳にいます。…」、いなければスタッフコードの欄に「このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。…」と出し、その欄にフォーカスを移す。片方しか送らない変更では、読まずにその欄に出す。直すときの 409 のうち、コードが `3003` のものは、ご自身のスタッフ情報を無効にしたとき。その間に削除されたスタッフ（404）は「スタッフが見つかりません」。ロールで断られた（403）ときは「このアカウントでは、このサロンのスタッフ台帳を扱えません。」
- **削除**は、確かめるダイアログ（「Rina Kato さんを、スタッフ台帳から削除しますか？」。元に戻せないこと、担当した予約と施術記録は残ること、紐づいたログインアカウントがサロンの画面を使えなくなること、スタッフコードはほかのスタッフに使えないままなこと、休職や退職の手続きの間は削除せずに無効にすること）のあとで削除し、読んであった台帳を捨てて台帳へ戻り、「…さんを、スタッフ台帳から削除しました。」と通知する。終わっていない予約（下書き、確定待ち、確定、施術中）を担当しているスタッフは API が 409 で断るので、ダイアログを閉じて、スタッフの内容の上に、そのことと、予約を完了するか、キャンセルするか、日時の変更で担当をほかのスタッフに替えてから削除することを出す。その間に削除されていた（404）ときは「スタッフが見つかりません」
- **ログインアカウント**は、紐づいているかだけを出す。招待、ロールの変更、紐づけの解除は、スタッフの内容の「ログインアカウント」から開く[スタッフのログインアカウントの画面](#スタッフのログインアカウントの画面)で行う
- **API を呼ぶ関数**は `src/staff/staff-api.ts` にある（台帳のページ、1 人、登録、直すこと、削除、409 がどの項目かを確かめること）。どれも reject せず、画面が区別する結果の直和型を返す。フォームの読み方、変えた項目、断られたときの言葉は `staff-form.ts`、名前と言葉、台帳を扱えるロール、ご自身のスタッフ情報か、削除の結果は `staff-format.ts` の純粋な関数。姓と名、メールアドレス、電話番号の決まりは、顧客台帳のフォーム（`customer-form.ts`）と同じもの
- **表示するだけの部品**は、台帳の表（`StaffTable`）、スタッフの内容（`StaffRecord`）、フォーム（`StaffForm`）。`ui` のカタログに、`Admin/Staff/…` として並ぶ

### シフトの画面

admin-app の `src/shifts/` に、サロンのシフト（その週にだれがいつ勤務するか）と、スタッフごとの勤務スケジュール（曜日ごとの勤務時間と休憩、日付ごとの勤務時間の変更と休み）を見て、勤務スケジュールを直す画面があります。シフトと勤務スケジュールを見るのは、サロンの `owner`、`manager`、`staff` と `admin`（`staff` は自分のものだけ）、直すのは `owner`、`manager`、`admin` です（API と同じ）。決まりは [スタッフ台帳](./staff.md) の「勤務スケジュール」です。お客様が予約するときの空き枠は、このスケジュールから決まります。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/shifts` | シフト。週（アドレスのクエリの `week`。その週の日。ないときはサロンの今日の週）の表で、行はスタッフ（表示名が勤務スケジュールへのリンク）、列は月曜日から日曜日。セルは、その日の勤務時間と休憩（「09:00〜20:00」「休憩 13:00〜14:00」）、休み（「休み」と備考）か「勤務なし」で、日付の行には「（この日だけ）」と添える。「前の週」「今週」「次の週」 | `GET /salons/{id}`、`GET /staff-profiles`（サロンの有効なスタッフ、最後まで）、`GET /salons/{salonId}/staff/{id}/schedules`（スタッフごとに 1 回） |
| `/salons/:salonId/shifts/:staffId` | 勤務スケジュール。表「毎週」（曜日、勤務、休憩、備考）と表「日付ごと」（今日から後の日付の行）。今日より前の日付の行は、数だけを言う。「勤務スケジュールを直す」と「シフトへ」 | `GET /salons/{id}`、スタッフの名前（台帳を扱うロールは `GET /salons/{salonId}/staff/{id}`、ほかは `GET /staff-profiles/{id}`）、`GET /salons/{salonId}/staff/{id}/schedules` |
| `/salons/:salonId/shifts/:staffId/edit` | 勤務スケジュールを直す。曜日ごとのまとまり（「勤務する」「勤務しない」、始まり、終わり、休憩の始まりと終わり、備考）と、日付ごとの行（日付、「勤務する」「休み」、時刻、備考。足して外す）。今日より前の日付の行があれば「今日より前の日付の行（n 行）を消す」。勤務スケジュールへ戻る | 同上と `PUT /salons/{salonId}/staff/{id}/schedules` |

- **入口**は、ヘッダーの「シフト」（「施術記録」の次。4 つのロールに出す）と、スタッフ台帳のスタッフの内容の「勤務スケジュール」。勤務スケジュールの画面のアドレスはシフトの下なので、どのロールでもヘッダーの「シフト」が今の画面になる
- **シフトの行**は、お客様に見せるプロフィールのスタッフ（有効なスタッフ、登録した順。予約を受けないスタッフも）。無効なスタッフは出ない。`staff` には、セッションのスタッフ（`staffId`）の行だけを出す。スケジュールはスタッフごとに 1 回読み、7 日に当てはめる。その日に当てはまる行は、その日付の行、なければ曜日の毎週の行（API の決まり）。表は見出しのセルのほかは 1 行に収めるが、シフトのセルは語の間で折り返し（「休憩」のあと、備考）、時刻と「（この日だけ）」は折らない。広い画面に 1 週間が収まり、狭い画面では表の枠が横にスクロールする
- **週**は月曜日から日曜日（API の並びと同じ）。「今日」はサロンのタイムゾーン。週はアドレスにあるので、戻るボタンで前に見ていた週に戻る。日でない `week` は、今日の週として扱う
- **スタッフの名前**は、スタッフ台帳を扱うロール（`owner`、`admin`）は台帳から読む。無効なスタッフも読めるので、オーナーと管理者は、スタッフの内容の「勤務スケジュール」から、無効なスタッフの勤務スケジュールを見て直せる（「無効なスタッフです。有効に戻すまで、シフトには出ません。復帰の前に、勤務スケジュールを組んでおけます。」）。ほかのロールはプロフィールから読む（無効なスタッフと、ほかのサロンのスタッフは「スタッフが見つかりません」）
- **使えないとき**: `staff` がほかのスタッフの勤務スケジュールを開くと、API が断り（403）、「この勤務スケジュールは、見られません。…」を出す。ほかのサロンの `owner` には、シフトに「このサロンのシフトは、見られません。…」、勤務スケジュールに同じ言葉を出す。`staff` には「勤務スケジュールを直す」を出さず、直す画面では API を呼ばずに「このアカウントでは、勤務スケジュールを直せません。…」と「勤務スケジュールへ」を出す
- **毎週のフォーム**は、曜日ごとに「勤務する」「勤務しない」を選び、勤務する曜日にだけ時刻を出す。勤務しない曜日は、備考があれば休みの行を、なければ行を送らない（API は、休みの行と行がないことを同じ意味にしている。備考を残せるようにする）
- **日付ごとのフォーム**は、今日から後の行を出し、行を足して外す（足した行は「休み」で始まり、日付にフォーカスが移る。外すと「日付の行を足す」にフォーカスが移る）。今日より前の行は出さずにそのまま送り、「今日より前の日付の行（n 行）を消す」を選ぶと送らない（`PUT` は全体の置き換えなので、送らない行は消える。古い行が積もると、行の上限 373 に届く）。日付ごとの行は、今日より前の行と合わせて 366 行まで
- **欄の決まり**は API と同じで、送る前に確かめる。勤務する日は始まりと終わりが必須で、終わりは始まりより後（日付をまたぐ勤務は入れられない）。休憩は始まりと終わりの両方か、どちらもなしで、勤務時間の内側（始まりより後に始まり、終わりより前に終わる）。日付は必須で 1900 年 1 月 1 日から 2999 年 12 月 31 日まで、同じ日付の行は 1 つ（「この日付は、1 行目と同じです。…」）、今日より前の行と同じ日付も、その行を消さないときは断る。時刻は秒を付けて送る（「09:00:00」）
- **送るとき**は、勤務スケジュールを読み直し、フォームを開いたときと同じなら送る。違えば（その間にほかのアカウントが変えた）、送らずにフォームの上に「その間に、ほかのアカウントがこの勤務スケジュールを変えていました。…もう一度「保存する」を押すと、いまの勤務スケジュールを、このフォームの内容で置き換えます。…」と出し、次は読み直した勤務スケジュールに対して送る。何も変えずに送ると、API を呼ばずに勤務スケジュールへ戻り、「変更はありませんでした。」と通知する。保存したら、応答の勤務スケジュールをクエリに置き、勤務スケジュールへ移って「Hiroshi Tanaka さんの勤務スケジュールを保存しました。」と通知する
- **断られたとき**: 400 の項目（`n.startTime` のように行の位置で言う）は、その行を書いた欄に出す（今日より前の行のように、フォームにない行のものは、フォームの上に「入力した内容を確かめて、…」）。その間に削除されたスタッフ（404）は「スタッフが見つかりません」。ロールで断られた（403）ときは「このアカウントでは、勤務スケジュールを直せません。…」
- **API を呼ぶ関数**は `src/shifts/schedules-api.ts` にある（勤務スケジュール、プロフィール、読み直してから送ること、2 つの勤務スケジュールが同じか、直せるロール）。どれも reject せず、画面が区別する結果の直和型を返す。週と、日に当てはまる行と、その言葉は `shift-week.ts`、フォームの読み方、送る行の並び、断られたときの言葉は `schedule-form.ts` の純粋な関数
- **表示するだけの部品**は、週の切り替え（`WeekSwitch`）、週の表（`ShiftTable`）、勤務スケジュール（`ScheduleRecord`）、フォーム（`ScheduleForm`）。`ui` のカタログに、`Admin/Shifts/…` として並ぶ

### スタッフのログインアカウントの画面

admin-app の `src/staff-accounts/` に、スタッフ台帳のスタッフがサインインに使うログインアカウントを見て、スタッフを招待し、アカウントのロールを変え、紐づけを解除する画面があります。使うのは、サロンの `owner` と `admin` です（API と同じ）。決まりは [スタッフ台帳](./staff.md) の「スタッフのログインアカウント」です。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/staff/:staffId/account` | ログインアカウント。アカウントが紐づいていれば「ログインアカウント」（メールアドレス、ロール、状態、2 要素認証、最後のログイン、作った日時と、状態の説明）と「ロールを変える」。なければ、招待があれば「招待」（状態、宛先、ロール、期限、送った日時）と「招待し直す」、どちらもなければ「招待する」。「スタッフの内容へ」 | `GET /salons/{id}`、`GET /salons/{salonId}/staff/{id}`、`GET /salons/{salonId}/staff/{id}/account` と `GET /salons/{salonId}/staff/{id}/invitation`（並べて、開くたびに）、`POST` と `DELETE /salons/{salonId}/staff/{id}/invitation`、`PATCH` と `DELETE /salons/{salonId}/staff/{id}/account` |

- **入口**は、スタッフの内容の「ログインアカウント」（「勤務スケジュール」の隣）。アドレスはスタッフ台帳の下なので、ヘッダーの「スタッフ」が今の画面になる。`manager` と `staff` には、API を呼ばずに、スタッフ台帳と同じ言葉で断る。ほかのサロンの `owner` は、API の 403 を同じ言葉で言う
- **読むもの**: アカウントと招待を並べて読み、アカウントがあればアカウントを（招待を読み終える前でも）、なければ招待を、どちらもなければ招待のフォームを出す。招待は、メールのリンクから画面の外で受け入れられるので、開くたびに読み直す（`staleTime: 0`）
- **ロール**は、`admin` がオーナー、マネージャー、スタッフを、`owner` がマネージャーとスタッフを与えられる（オーナーのロールを与えられるのは管理者。選択の説明に書く）。それぞれのロールで何ができるかも、選択の説明に書く。招待のフォームは、ロールを選ばずに開く（確かめずにロールを与えないため）。選ばずに送ると「ロールを選んでください。」
- **招待する**: 招待メールは、台帳のメールアドレスに送る（フォームに宛先を出す。宛先を変えるときは、先にスタッフ情報を直す）。リンクは 7 日の間使える。送ったら、「招待」の見出しにフォーカスを移し、「Yui Watanabe さんに、招待メールを送りました。」と通知する。無効なスタッフには、フォームを出さずに「無効なスタッフは、招待できません。…」と「スタッフ情報を直す」を出す
- **招待**の状態は、受け入れ待ち、期限切れ（招待し直すと、新しいリンクを送る）、使えません（招待したあとで台帳のメールアドレスが変わったか、スタッフが無効）。期限の切れた招待も API が返すので、そのまま出す。「招待し直す」は前の招待のロールで始まり、送ると前のリンクは使えなくなる。「招待を取り消す」は、確かめるダイアログのあとで取り消し、招待のフォームに戻る
- **招待が断られたとき**: API の 409 は、アカウントがすでにある、スタッフが無効、1 分以内に同じ招待を送った、のどれかで、どれかを言わない（同じコード）。画面は、API が確かめる順に、アカウントを読み直し（あれば、その間に招待が受け入れられた）、なければスタッフを読み直し（無効なら、その間に無効にされた）、どちらでもなければ 1 分以内の招待とする。読み直したアカウントか無効なスタッフを出し、その間に変わったことと、メールは送っていないことを画面の上に言う。1 分以内のときは、フォームの上に「…1 分以内に招待メールを送ったばかりです。続けては送れません。…」
- **アカウント**の状態（有効、メールアドレスの確認待ち、無効、ロック中、停止中、削除済み）には、有効のほかは説明を添える（ロック中は、パスワードを続けて誤ったため 15 分の間新しいログインができないこと、ログインしている端末はそのまま使えること）。アカウントのメールアドレスが台帳と違えば、そのことを言う。最後のログインがなければ「まだログインしていません」。無効なスタッフのアカウントには、有効に戻すまでサロンの画面を使えないことを言う
- **ロールを変える**は、今のロールを選んで開く。`owner` がオーナーのアカウントを見ると、オーナーは選択肢になく、何も選ばずに開く（オーナーのロールを外すと、戻せるのは管理者だけだと、説明に添える）。変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知する。変えたら「…さんのロールを、マネージャーにしました。次の操作から、新しいロールで扱われます。」（API は、そのアカウントの次のリクエストから、新しいロールで扱う）
- **紐づけを解除する**は、確かめるダイアログ（次の操作からサロンの画面を使えなくなること、アカウントとスタッフ情報は残り、また招待できること、休職や退職の手続きの間は解除せずに無効にすること）のあとで解除し、招待のフォームに戻る
- **ご自身のアカウント**には、ロールの変更も紐づけの解除も出さず、そのことを言う（API も 409 で断る）
- **その間に変わったとき**: ロールの変更、招待の取り消し、紐づけの解除で、対象がなくなっていた（404）ときは、アカウントと招待を読み直して今の状態を出し、「その間に、…さんのログインアカウントか招待が、変わっていました（…）。いまの状態を出しています。」と画面の上に出す。招待する間にスタッフが削除されていたときは「スタッフが見つかりません」
- **API を呼ぶ関数**は `src/staff-accounts/accounts-api.ts` にある（アカウントと招待を読むこと、招待することと断られた理由を読み直すこと、招待の取り消し、ロールの変更、紐づけの解除）。どれも reject せず、画面が区別する結果の直和型を返す。ロールと状態の言葉、招待の状態、2 つの読み取りから出すものは `account-format.ts`、フォームの読み方と、書いたあとに言うことは `account-form.ts` の純粋な関数
- **表示するだけの部品**は、アカウント（`AccountRecord`）、招待（`InvitationRecord`）、ロールのフォーム（`RoleForm`）。`ui` のカタログに、`Admin/StaffAccounts/…` として並ぶ

### 自分のプロフィールの画面

admin-app の `src/own-profile/` に、サインインしているスタッフが、お客様に見せる自分のプロフィールを読み、自分を紹介する項目を直す画面があります。使うのは、サロンに届く `owner`、`manager`、`staff` です（API と同じ。どのスタッフかはアカウントが決める）。決まりは [スタッフ台帳](./staff.md) の「スタッフ本人のプロフィール」です。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/account/profile` | プロフィール。「お客様に見せるプロフィール」（表示名、レベル、役職、予約、専門、資格、経験年数、紹介文、写真の URL と、サロンが決める項目の説明、お客様からの見え方へのリンク）と「紹介を直す」 | `GET /staff-profiles/me`（開くたびに）、`PATCH /staff-profiles/me` |

- **入口**は、ヘッダーのリンクの最後の「プロフィール」。サロンの 3 つのロールのアカウントに、どの画面でも出す（アドレスはサロンの下にないので、この画面では「予約」がスタートへ戻るリンクになる）。アカウント欄（メールアドレス、「アカウントの安全」、「サインアウト」）には置かない。狭い画面では、アカウント欄はアプリ名の横の 1 行に収め、ボタンがもう 1 つは入らない（ヘッダーのリンクは、収まらなければ横にスクロールする）。`admin` には出さず、アドレスを開くと、API を呼ばずに、管理者のアカウントにはプロフィールがないことを言う
- **お客様に見せる項目**は、すべて出す。表示名、レベル、役職、予約の受け方はサロンがスタッフ台帳で決めるので、そのことと、変えたいときはオーナーに伝えることを添える。「お客様からの見え方を、サロンのページで見る」は、portal-app のサロンの詳細（`VITE_PORTAL_APP_URL` の `/salons/:salonId`）へのリンク
- **紹介を直す**は、スタッフ台帳のフォームの「紹介」と同じ 5 つの欄（専門、資格、経験年数、紹介文、写真の URL）で、同じ読み方（`src/staff/introduction.ts` と部品 `IntroductionFields` を共有する）。送るのは、開いたときから変えた項目だけで、その間に台帳で変わった項目は、ここで変えない限りそのまま残る。何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知する。空にした文字の項目は `null`、空にした一覧は空の一覧で送る
- **保存したら**、API の答えをそのまま出し、フォームをその内容で開き直し、「お客様に見せるプロフィール」の見出しにフォーカスを移して、「プロフィールを保存しました。お客様の画面に、すぐに出ます。」と通知する。フォームは、開いたときのプロフィールを自分で持つので、プロフィールを読み直しても、書きかけの内容は消えない
- **使えないとき**: スタッフが無効にされたか削除されたか、紐づけが解除されたアカウントには、API が 403 か 404 を返す。開いたときも保存したときも、「このアカウントのプロフィールは、いまは使えません。…サロンのオーナーに確かめてください。」と出す
- **API を呼ぶ関数**は `src/own-profile/profile-api.ts` にある（プロフィールを読むことと、直すこと）。どちらも reject せず、画面が区別する結果の直和型を返す。フォームの読み方と、断られたあとに言うことは `profile-form.ts` の純粋な関数
- **表示するだけの部品**は、プロフィール（`ProfileRecord`）とフォーム（`ProfileForm`）。`ui` のカタログに、`Admin/OwnProfile/…` として並ぶ。5 つの欄は `Admin/Staff/IntroductionFields`

### メニューの画面

admin-app の `src/menu/` に、サロンのメニュー（カテゴリーと、そのサービス）を見て、サービスとカテゴリーを足し、直し、削除し、いくつものサービスをまとめて変える画面があります。メニューを見るのは、サロンの 4 つのロールと `admin`、メニューを変えるのは、`owner`、`manager`、`admin` です（API と同じ）。決まりは [サービスメニュー](./service-menu.md) です。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/menu` | メニュー。「サービス」（カテゴリーごとの表。表の名前は、親からたどったカテゴリーの名前（「Hair Cut › Bob Cut」）。行は、サービス、所要時間、料金、オンライン予約、状態で、サービスの名前が、サービスの内容へのリンク）と、「カテゴリー」（名前、親、種類、表示順、色、状態）。変えられるロールには、「サービスを足す」と「カテゴリーを足す」と「まとめて変える」と、カテゴリーの名前から直す画面へのリンクが出る | `GET /salons/{id}`、`GET /salons/{salonId}/service-categories`、`GET /salons/{salonId}/services`（どちらも最後まで、開くたびに） |
| `/salons/:salonId/menu/services/:serviceId` | サービスの内容。「サービス」（名前、カテゴリー、状態、所要時間、料金、価格の決め方、提供日、表示順、短い紹介、説明、タグ、写真の URL）、「予約」（オンライン予約、予約の条件、カウンセリング、担当できるスタッフ、1 日の予約の上限）、パッケージのサービス（それぞれの内容へのリンク）、オプションの表。「メニューへ」。変えられるロールには、「サービスを直す」が出る | `GET /salons/{salonId}/services/{id}`（開くたびに）と、上の 2 つの一覧 |
| `/salons/:salonId/menu/services/new` | サービスを足す。「サービス」（名前、カテゴリー、短い紹介、説明、タグ、表示順（初めは、いまの最後の次））、「時間と料金」（所要時間、価格の決め方、料金、割引後の料金、税込）、「提供」（有効、提供の状態、提供日）、「予約」（オンライン予約、カウンセリング、担当できるスタッフ、1 日の予約の上限、予約の条件）、「写真」（写真の URL、ほかの写真の URL）、「パッケージ」（パッケージにする、構成サービスの行）、「オプション」（オプションの行。名前、種類、選べる数、追加の時間、追加の料金、説明、必須、有効）。足したサービスの内容へ移る | `GET /salons/{salonId}/service-categories`、`GET /salons/{salonId}/services`（どちらも開くたびに）、`POST /salons/{salonId}/services` |
| `/salons/:salonId/menu/services/:serviceId/edit` | サービスを直す。足す画面と同じ欄と、「削除」 | `GET /salons/{salonId}/services/{id}`、上の 2 つの一覧、`PATCH /salons/{salonId}/services/{id}`、`DELETE /salons/{salonId}/services/{id}` |
| `/salons/:salonId/menu/services/bulk` | サービスをまとめて変える。「サービス」（変えるサービス。メニューの順のチェックボックスで、名前のあとに、親からたどったカテゴリーの名前）、「変える項目」（カテゴリー、有効、オンライン予約、提供の状態、提供日、担当できるスタッフ。どれも初めは「変えない」）。変えたら、メニューへ戻る | `GET /salons/{salonId}/service-categories`、`GET /salons/{salonId}/services`（どちらも開くたびに）、`PATCH /salons/{salonId}/services/bulk` |
| `/salons/:salonId/menu/categories/new` | カテゴリーを足す。名前、親カテゴリー、種類、表示順（初めは、いまの最後の次）、説明、色、アイコンの URL、有効 | `POST /salons/{salonId}/service-categories` |
| `/salons/:salonId/menu/categories/:categoryId/edit` | カテゴリーを直す。足す画面と同じ欄と、「削除」 | `GET /salons/{salonId}/service-categories/{id}`、`PATCH /salons/{salonId}/service-categories/{id}`、`DELETE /salons/{salonId}/service-categories/{id}` |

- **入口**は、ヘッダーのリンクの「メニュー」（「シフト」の次）。サロンの下のどの画面にも出す
- **メニューの並び**は、API の順（カテゴリーも、その中のサービスも、表示順）。カテゴリーのないサービスと、読めたカテゴリーにないサービスは、最後の「未分類」に並ぶ。お客様に見せないもの（無効のカテゴリーとサービス、提供中でないサービス）も出し、状態に「無効」や「近日公開」と書く。料金は、割引価格があれば「￥7,200（￥8,000 から割引）」と書き、税込か税別と、固定価格でなければ価格の決め方を添える
- **カテゴリーのフォーム**: 親に選べるのは、そのカテゴリー自身と、その下にあるカテゴリーを除いたもの（選択肢の名前も、親からたどった名前）。色は大文字にして送る。直す画面は、開いたときから変えた項目だけを送り、何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知してメニューへ戻る。直す画面は、窓に戻ってもカテゴリーを読み直さない（変えた項目は、開いたときのカテゴリーと比べる）
- **書いたあと**は、カテゴリーの一覧を捨て（`removeQueries`）、「カテゴリー「…」を、メニューに足しました。」か「カテゴリー「…」を直しました。」と通知して、メニューへ戻る
- **サービスのフォーム**: 新しいサービスは、未分類、固定価格、提供中、毎日、税込、有効、オンライン予約を受ける、で開く。所要時間は 1〜1440 分、料金と割引後の料金は 0 以上の整数（全角の数字も読む）で、割引後の料金は料金以下。タグは、台帳のタグと同じく「、」かカンマで区切る。写真の URL は http か https。担当できるスタッフは「（レベル）以上」で、選ばなければ、すべてのスタッフ。予約の条件は、契約の順に送る
- **オプションと構成サービスの行**は、足して外せる。足した行の最初の欄に、外したあとは足すボタンに、フォーカスが移る。オプションは、行の順を並びの順（`sortOrder`）にして、変えたら全体を送る（API は、送った一覧で置き換える。行を全部外せば、空の一覧）。名前のない行があれば、送る前にその行に言う
- **パッケージ**: 「パッケージにする」に印を付けると、構成サービスの行が 2 つ出る。選べるのは、パッケージでない、ほかのサービス（2〜20 件、同じサービスは 1 回だけ）。印を外して送ると、構成サービスの空の一覧もいっしょに送り、パッケージでなくなる。パッケージに入っているサービスには、印の代わりに、どのパッケージに入っているので、パッケージにできないかを書く
- **サービスを書いたあと**は、サービスの一覧を捨て、応答のサービスを内容の画面の読んだものに置いて、「サービス「…」を、メニューに足しました。」か「サービス「…」を直しました。」と通知し、サービスの内容へ移る。直す画面は、カテゴリーと同じく、変えた項目だけを送り、何も変えずに送ると API を呼ばずに内容へ戻る
- **カテゴリーか構成サービスを断られたとき**（400 の `categoryId`、`isPackage`、`packageServiceIds`。その間に削除されたもの、その間にパッケージになったもの）は、その欄にそのことを言い、カテゴリーとサービスの一覧を読み直して、選択肢を今のものにする
- **親を断られたとき**（400 の `parentId`。`not_found` は、その間に削除された親、`circular` は、その間にこのカテゴリーの下に入った親）は、親カテゴリーの欄にそのことを言い、カテゴリーの一覧を読み直して、選択肢を今のものにする
- **削除**は、ダイアログで、下にあるカテゴリーは最上位に、サービスは未分類になり、どちらも削除されないことと、元に戻せないことを言ってから。削除したら、カテゴリーとサービスの一覧を捨て、「カテゴリー「…」を、メニューから削除しました。」と通知して、メニューへ戻る。その間に削除されていたカテゴリーは、「カテゴリーが見つかりません」
- **サービスの削除**は、ダイアログで、メニューから消えて予約を入れられなくなることと、すでにある予約の施術明細は残ること、元に戻せないことを言ってから。削除したら、サービスの一覧を捨て、「サービス「…」を、メニューから削除しました。」と通知して、メニューへ戻る。API が削除を断ったとき（409）は、サービスの一覧を読み直して、パッケージに入っていれば、そのパッケージの名前と、先に構成サービスから外すことを、そうでなければ、終わっていない予約の施術明細にあることと、その予約を終えるかキャンセルするか、明細を外すことを、フォームの上に言う
- **まとめて変える**: 選んだサービスのすべてに、「変えない」でない項目だけを送る（API は、すべてを変えるか、どれも変えない）。変えられるのは、どのサービスにも同じ値でよい項目で、料金、所要時間、名前、オプション、パッケージは、1 件ずつ直す。カテゴリーは「未分類にする」、担当できるスタッフは「すべてのスタッフ」でも外せる。サービスを選ばずに（または 101 件以上）送ると、選ぶ欄に、項目をどれも変えずに送ると、フォームの上に言い、API を呼ばない。変えたら、サービスの一覧を捨て（メニューが、変える前の一覧を先に出さないように）、API が変えたと答えた数で「N 件のサービスを変えました。」と通知して、メニューへ戻る
- **まとめて変えるのを断られたとき**: 選んだサービスがその間に削除されていた（404）ときは、どのサービスも変えていないことをフォームの上に言い、カテゴリーとサービスの一覧を読み直す。消えたサービスだけが選択肢から消え、ほかの印と選んだ項目は残る。選んだカテゴリーがその間に削除されていた（400 の `updates.categoryId`）ときは、カテゴリーの欄に言い、選択肢を読み直す
- **変えられないロール**: `staff` には、「サービスを足す」「サービスを直す」「カテゴリーを足す」「まとめて変える」も、直す画面へのリンクも出さない。アドレスを開くと、API を呼ばずに、変えられないことと、変えられるロールを言う。ほかのサロンのアカウントには、送ったときの API の 403 で、そのサロンのメニューは変えられないと言う
- **API を呼ぶ関数**は `src/menu/menu-api.ts` にある（カテゴリーの一覧を最後まで、カテゴリーとサービスを 1 件、サービスとカテゴリーを足す、直す、削除する、サービスをまとめて変える）。どれも reject せず、画面が区別する結果の直和型を返す。サービスの一覧は、予約台帳と同じ `src/salons/salons-api.ts` の関数で読む。表示の言葉と並びは `menu-format.ts`、フォームの読み方と、断られたあとに言うことは `category-form.ts`、`service-form.ts`、`services-change.ts` の純粋な関数
- **表示するだけの部品**は、カテゴリーごとのサービス（`MenuSections`）、カテゴリーの表（`CategoryTable`）、サービスの内容（`ServiceRecord`）、フォーム（`ServiceForm`、`CategoryForm`、`ServicesChangeForm`）。`ui` のカタログに、`Admin/Menu/…` として並ぶ

### サロンの設定の画面

admin-app の `src/settings/` に、サロンの設定（サロンの情報、曜日ごとの営業時間、営業日カレンダー）を見て、サロンの情報と営業時間を直す画面があります。設定を見るのは、サロンの 4 つのロールと `admin`、直すのは、`owner`、`manager`、`admin` です（API の `mayUpdateSalon` と同じ）。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/settings` | サロンの設定。「サロン」（名前、カナ、紹介、オンライン予約、評価）、「所在地」（郵便番号、都道府県、市区町村、町名・番地、建物、地図の位置）、「連絡先」（電話番号、予備の電話番号、メールアドレス、公式サイト）、「写真」（ロゴの URL、写真の URL）、「特徴と設備」、「会計」（タイムゾーン、通貨、税率、支払い方法の画面へのリンク）、「営業時間」（月曜日からの表。休憩と、期間のある営業時間はその期間を添える。決まりのない曜日は「休業」）、「営業日カレンダー」（サロンの今日からの日付の表。営業時間、祝日・休業日の名前、備考）。変えられるロールには、「サロンの情報を直す」と「営業時間を直す」が出る | `GET /salons/{id}`（開くたびに） |
| `/salons/:salonId/settings/edit` | サロンの情報を直す。「サロン」（名前、カナ、紹介、オンライン予約を受け付ける）、「所在地」（郵便番号、都道府県、市区町村、町名・番地、建物、緯度、経度）、「連絡先」（電話番号、予備の電話番号、メールアドレス、公式サイト）、「写真」（ロゴの URL、写真の URL）、「特徴と設備」、「会計」（税率）。直したら、設定の画面へ戻る | `GET /salons/{id}`（開くたびに）、`PATCH /salons/{id}` |
| `/salons/:salonId/settings/hours` | 営業時間を直す。「毎週」（月曜日から日曜日まで。「営業する」か「休業」、開店、閉店、休憩の始まりと終わり）と、「日付ごと」（今日からの営業日カレンダーの行。日付、「営業する」か「終日休業」、開店、閉店、祝日の営業、祝日・休業日の名前、備考。行を足して外せる）。直したら、設定の画面へ戻る | `GET /salons/{id}`（開くたびと、保存の前に）、`PATCH /salons/{id}`（`businessHours`、`openingHours`） |

- **入口**は、ヘッダーのリンクの「設定」（「スタッフ」の次。「スタッフ」のないロールでは「メニュー」の次）。サロンの下のどの画面にも、どのロールにも出す
- **直せない項目**: タイムゾーンと通貨は、フォームでは変えられないことを書くだけにする。変えると、すべての予約の日時と料金の読み方が変わる。曜日ごとの営業時間と営業日カレンダーは、サロンの情報のフォームには出さず、営業時間を直す画面で直す
- **送る前に確かめること**は、API と同じ規則: 名前、都道府県、市区町村、町名・番地、電話番号、メールアドレス、税率は空にできない。文字数（名前、カナ、町名・番地、建物は 255、郵便番号は 10、都道府県は 50、市区町村は 100、URL は 500）、緯度は -90〜90、経度は -180〜180（どちらも小数 8 桁まで、負の数も、全角の数字も読む）、電話番号は数字 10 個以上、URL は http か https、税率は 0〜100 で小数 2 桁まで。誤りは、送らずに、その欄に言う
- **特徴と設備**は、サービスのタグと同じく「、」かカンマで区切る。**写真の URL** は 1 行に 1 つで、URL でない行があれば、何行目かを言う
- **変えた項目だけを送る**: フォームを開いたときのサロンと、フォームの読み方で比べる（前後の空白、空の欄と `null`、区切り方の違いは、変えたことにしない）。その間にほかの人が直した項目は、送らないので、そのまま残る。何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知して、設定の画面へ戻る。緯度と経度は、指数（`1e-7`）でなく小数で欄に出す
- **書いたあと**は、応答のサロンを読んだサロンに置き、「サロンの情報を直しました。」と通知して、設定の画面へ戻る
- **断られたとき**: ほかのサロンが使っているメールアドレス（409）は、メールアドレスの欄に言う。その間にサロンがなくなった（404）ときは、サロンが見つからないことを出す。ほかのサロンのアカウントには、送ったときの API の 403 で、そのサロンの設定は変えられないと、フォームの上に言う
- **オンライン予約を受け付ける**の説明に、外しているあいだ、お客様は空き枠を見られず、予約できないことと、サロンが台帳に入れる予約には使えることを書く
- **変えられないロール**: `staff` には「サロンの情報を直す」も「営業時間を直す」も出さない。アドレスを開くと、API を呼ばずに、変えられないことと、変えられるロールを言う
- **営業時間を直す画面**は、勤務スケジュールを直す画面と同じ形にする。「毎週」は、月曜日から日曜日まで、1 曜日 1 つのまとまり（「営業する」か「休業」、開店、閉店、休憩の始まりと終わり）。「日付ごと」は、サロンの今日からの営業日カレンダーの行（日付、「営業する」か「終日休業」、開店、閉店、祝日の営業、祝日・休業日の名前、備考）で、行を足して外せる。足した行は終日休業で始まり、その日付にフォーカスが移る。外すと、「日付の行を足す」にフォーカスが移る
- **1 曜日の時間**は、営業時間 1 つと、休憩 0 か 1 つ。保存されている曜日に、営業時間か休憩が 2 つ以上あれば、その曜日に、毎週の営業時間を変えて保存すると最初のものだけが残ることを書く。期間のある営業時間（`effectivePeriod`）は、その期間を曜日に書き、変えずに送り返す
- **休業の曜日**は、時間を空にして `isClosed: true` で送る。曜日は、いつも 7 つとも送る（エントリーのない曜日と、休業の曜日は同じ）。曜日の時刻は `10:00`、日付の時刻は `10:00:00` で送る（API が持つ形）
- **終日休業**の日付は、時刻を空で送り、祝日・休業日の印（`isHoliday`）を付ける。営業する日に「祝日の営業」の印を付けると、祝日・休業日として、その時間は営業する（空き枠は、印があっても、時刻のある日を営業日とする）
- **送る前に確かめること**: 営業する日は、開店と閉店が要り、閉店は開店より後（日付をまたぐ営業は表せない）。休憩は、始まりと終わりの両方か、どちらもなしで、開店より後に始まり、閉店より前に終わる。日付は、サロンの今日以降で、行の間で重ならない。祝日・休業日の名前は 100 文字まで。誤りは、送らずに、その欄に言う（日付の行の誤りは、行を外すと消え、次に送ったときにまた出る）
- **今日より前の日付**は、フォームに出さず、「今日より前の日付（N 行）は、記録としてそのまま残ります。」と書いて、そのまま送り返す
- **変えたほうだけを送る**: API は、送った一覧で、曜日ごとの営業時間と営業日カレンダーのそれぞれの全体を置き換える。フォームを開いたときと、フォームの読み方で比べ（前後の空白、行の順、秒の有無は、変えたことにしない）、変えたほうを全体で、日付の順に送る。何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知して、設定の画面へ戻る
- **その間にほかの人が直したとき**: 保存の前にサロンを読み直し、フォームを開いたときと営業時間かカレンダーが違えば、保存せずに、そのことをフォームの上に言う。もう一度「保存する」を押すと、いまの営業時間を、フォームの内容で置き換える（勤務スケジュールと同じ）
- **書いたあと**は、応答のサロンを読んだサロンに置き、「営業時間を直しました。」と通知して、設定の画面へ戻る。ほかのサロンのアカウントには、送ったときの API の 403 で、そのサロンの営業時間は変えられないと、フォームの上に言う
- **API を呼ぶ関数**は `src/settings/settings-api.ts`（サロンの情報を直すこと）と `hours-api.ts`（サロンを読み直してから、営業時間を直すこと）にある。サロンは、予約台帳と同じ `salon-screens` の `readSalon` で読む。reject せず、画面が区別する結果の直和型を返す。表示の言葉（営業時間、カレンダー、税率、地図の位置、評価）は `settings-format.ts`、フォームの読み方と、断られたあとに言うことは `salon-form.ts` と `hours-form.ts` の純粋な関数
- **表示するだけの部品**は、設定（`SalonRecord`）とフォーム（`SalonForm`、`HoursForm`）。`ui` のカタログに、`Admin/Settings/…` として並ぶ

### 支払い方法の画面

admin-app の `src/payment-methods/` に、サロンが会計で受け付ける支払い方法を見て、足し、直し、削除する画面があります。見るのは、サロンの 4 つのロールと `admin`、変えるのは、`owner`、`manager`、`admin` です（API と同じ）。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/settings/payment-methods` | 支払い方法。並び順の表（表示名、種類、1 回の金額、手数料率、使う場所、状態）で、使っていないものも並ぶ。表示名から、その支払い方法へ。変えられるロールには、「支払い方法を足す」が出る | `GET /salons/{id}`、`GET /salons/{salonId}/payment-methods`（開くたびに、最後まで） |
| `/salons/:salonId/settings/payment-methods/new` | 支払い方法を足す。種類、表示名、説明、1 回の金額の下限と上限、手数料率、決済代行会社、店頭の会計で使う、オンラインの決済で使う、並び順（初めは最後）、この支払い方法を使う。足したら、その支払い方法へ移る | `GET /salons/{id}`、`GET /salons/{salonId}/payment-methods`（開くたびに）、`POST /salons/{salonId}/payment-methods` |
| `/salons/:salonId/settings/payment-methods/:paymentMethodId` | 支払い方法の内容（表示名、種類、説明、1 回の金額、手数料率、決済代行会社、使う場所、状態、並び順）。変えられるロールには、「支払い方法を直す」が出る | `GET /salons/{id}`、`GET /salons/{salonId}/payment-methods/{id}`（開くたびに） |
| `/salons/:salonId/settings/payment-methods/:paymentMethodId/edit` | 支払い方法を直す（種類のほかは、足す画面と同じ項目）と、削除。直したら、その支払い方法へ戻る。削除したら、支払い方法の一覧へ | `GET /salons/{id}`、`GET /salons/{salonId}/payment-methods/{id}`（開くたびに）、`PATCH /salons/{salonId}/payment-methods/{id}`、`DELETE /salons/{salonId}/payment-methods/{id}` |

- **入口**は、サロンの設定の「会計」の「支払い方法を見る」。ヘッダーでは「設定」が選ばれた形になる
- **種類**（`method`）は、足すときにだけ選ぶ。API は、あとから変えさせないので、直す画面では、種類を文字で出し、間違えたときは、受け取った支払いがなければ削除して足し直し、あれば使うのをやめて足し直すように書く。種類の言葉は、売上の画面と同じ（現金、クレジットカード、デビットカード、電子マネー、QR コード決済、銀行振込、ポイント）
- **送る前に確かめること**は、API と同じ規則: 種類は選ぶ。表示名は空にできず 100 文字まで、決済代行会社は 100 文字まで。手数料率は 0〜100 で小数 2 桁まで（空は記録しない。0 は手数料なし）。下限と上限は 1 以上の円の整数（全角の数字とカンマも読む。空は制限なし）で、上限は下限と同じか、それより大きい。並び順は 0 以上の整数。誤りは、送らずに、その欄に言う。API が、保存されている片方と比べて断った下限か上限（400）は、その欄に言う
- **変えた項目だけを送る**: フォームを開いたときの支払い方法と、フォームの読み方で比べる（前後の空白、空の欄と `null`、全角の数字とカンマは、変えたことにしない）。何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知して、その支払い方法へ戻る
- **書いたあと**は、応答の支払い方法を読んだものに置き、読んだ一覧を捨てる（`removeQueries`）。売上の画面は、支払い方法の一覧を 5 分のあいだ使い回すので、次に支払いを記録する画面を開くと読み直し、使うのをやめた支払い方法は出なくなる
- **使う場所**（店頭の会計、オンラインの決済）と手数料率は、記録として保存する。いまの支払いを記録する画面は、使っている支払い方法を、使う場所にかかわらず出す（サロンが受け取ったあとに記録する画面なので）。フォームの説明に、そのことを書く
- **削除**は、直す画面の「削除」から、確かめるダイアログを経て行う。その支払い方法で受け取った支払いがあれば、API は断る（409）。ダイアログを閉じ、フォームの上に、削除できないことと、「この支払い方法を使う」の印を外して保存すれば使うのをやめられることを言う
- **変えられないロール**: `staff` には「支払い方法を足す」も「支払い方法を直す」も出さない。足す画面と直す画面のアドレスを開くと、API を呼ばずに、変えられないことと、変えられるロールを言う。ほかのサロンのアカウントには、一覧と支払い方法の API の 403 で、そのサロンの支払い方法は見られないと言う。ない支払い方法と、ID でないアドレスは、支払い方法が見つからないと言う
- **API を呼ぶ関数**は `src/payment-methods/payment-methods-api.ts`（1 件を読むこと、足すこと、直すこと、削除すること）にある。一覧は、売上の画面と同じ `src/sales/sales-api.ts` の `readPaymentMethods` で、同じキーで読む。reject せず、画面が区別する結果の直和型を返す。表示の言葉（手数料率、1 回の金額、使う場所、状態、次の並び順）は `payment-method-format.ts`、フォームの読み方と、断られたあとに言うことは `payment-method-form.ts` の純粋な関数
- **表示するだけの部品**は、一覧（`PaymentMethodTable`）、内容（`PaymentMethodRecord`）、フォーム（`PaymentMethodForm`）。`ui` のカタログに、`Admin/PaymentMethods/…` として並ぶ

### 商品台帳の画面

admin-app の `src/products/` に、サロンが扱う商品（店頭で売るもの、施術で使うもの）の台帳を探し、商品を足し、直し、取り扱いをやめ、削除する画面があります。見るのは、サロンの 4 つのロールと `admin`、変えるのは、`owner`、`manager`、`admin` です（API と同じ）。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/products` | 商品台帳。商品コードの順の表（商品コード、商品名、カテゴリー、ブランド、販売価格、用途、状態）で、20 件ずつ読み、「さらに表示」で続きを読む。キーワード（商品名、商品コード、ブランドの一部）、バーコード、カテゴリー、取り扱い（取り扱い中、取り扱いをやめた）、用途（店頭で販売する、施術で使う）で探す。商品名から、その商品へ。変えられるロールには、「商品を足す」が出る | `GET /salons/{id}`、`GET /salons/{salonId}/products`（条件で 20 件ずつ。カテゴリーの選択肢のために、条件なしで最後まで。どちらも開くたびに） |
| `/salons/:salonId/products/new` | 商品を足す。商品（商品コード、単位、商品名、説明、カテゴリー、ブランド、店頭で販売する、施術で使う、取り扱い中）、価格（仕入価格、定価、販売価格）、在庫の水準（最低在庫数、発注点、最大在庫数）、仕入れ（仕入先、仕入先の商品コード、納品までの日数）、管理（バーコード、使用期限までの月数、在庫をロット番号で分ける、保管条件、商品画像の URL、安全データシートの URL）。足したら、その商品へ移る | `GET /salons/{id}`、`POST /salons/{salonId}/products` |
| `/salons/:salonId/products/:productId` | 商品の内容（商品、価格、在庫の水準、仕入れ、管理）。変えられるロールには、「商品を直す」が出る | `GET /salons/{id}`、`GET /salons/{salonId}/products/{id}`（開くたびに） |
| `/salons/:salonId/products/:productId/edit` | 商品を直す（足す画面と同じ項目）と、削除。直したら、その商品へ戻る。削除したら、商品台帳へ | `GET /salons/{id}`、`GET /salons/{salonId}/products/{id}`（開くたびに）、`PATCH /salons/{salonId}/products/{id}`、`DELETE /salons/{salonId}/products/{id}` |

- **入口**は、ヘッダーの「商品」（「メニュー」の次）
- **探す条件**はアドレスに残る（`keyword`、`barcode`、`category`、`carried` は `carried` か `dropped`、`use` は `sale` か `treatment`）。キーワードとバーコードは、前後の空白を除いて 100 文字まで。カテゴリーは、書かれたとおりに（大文字と小文字を区別して）送る。選択肢は、サロンのすべての商品（取り扱いをやめた商品も）にあるカテゴリーで、選んでいるカテゴリーは、それを持つ商品がなくなっても残す。読めない値は、条件にしない
- **新しい商品の初めの値**は、API が値のない商品を保存するときの値と同じ: 施術で使う、取り扱い中、店頭で販売しない、ロット番号で分けない、最低在庫数 0
- **送る前に確かめること**は、API と同じ規則: 商品コード（100 文字まで）、商品名（255 文字まで）、単位（20 文字まで）は空にできない。カテゴリー、ブランド、仕入先の商品コード、バーコードは 100 文字まで、仕入先は 255 文字まで（文字数はコードポイントで数える）。価格は 0 以上の円の整数（全角の数字とカンマも読む。空は記録しない）。在庫の水準は 0 から 99,999,999.99 までで小数 2 桁まで、最低在庫数、発注点、最大在庫数の順に同じか大きい（発注点と最大在庫数は、空にすると決めない）。納品までの日数は 0 以上の整数、使用期限までの月数は 1 以上の整数。URL は `http://` か `https://` で始まり 500 文字まで。誤りは、送らずに、その欄に言う。API が、保存されている水準と比べて断った水準（400）は、その欄に言う
- **商品コード**は、削除していないほかの商品と同じものを API が断る（409）。取り扱いをやめた商品のコードも使えない。商品コードの欄に言い、フォーカスを移す
- **変えた項目だけを送る**: フォームを開いたときの商品と、フォームの読み方で比べる（前後の空白、空の欄と `null`、全角の数字とカンマ、`5` と `5.00` は、変えたことにしない）。何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知して、その商品へ戻る
- **書いたあと**は、応答の商品を読んだものに置き、読んだ商品の一覧（台帳のページと、すべての商品）を捨てる（`removeQueries`）。施術記録の画面は、材料に出す商品の一覧を 5 分のあいだ使い回すので、次に施術記録のフォームを開くと読み直し、取り扱いをやめた商品は材料に出なくなる
- **取り扱いをやめる**のは、「取り扱い中」の印を外して保存すること。台帳には「取り扱いをやめた」と出て、施術記録の材料に出なくなる。在庫の記録と施術記録は、そのまま残る
- **削除**は、直す画面の「削除」から、確かめるダイアログを経て行う。在庫の記録がある商品は、API が断る（409）。ダイアログを閉じ、フォームの上に、削除できないことと、「取り扱い中」の印を外して保存すれば取り扱いをやめられることを言う
- **変えられないロール**: `staff` には「商品を足す」も「商品を直す」も出さない。足す画面と直す画面のアドレスを開くと、API を呼ばずに、変えられないことと、変えられるロールを言う。ほかのサロンのアカウントには、台帳と商品の API の 403 で、そのサロンの商品は見られないと言う。ない商品と、ID でないアドレスは、商品が見つからないと言う。直しているあいだに削除された商品は、保存したときに、商品が見つからないと言う
- **API を呼ぶ関数**は `src/products/products-api.ts`（台帳の 1 ページ、すべての商品、1 件を読むこと、足すこと、直すこと、削除すること）にある。すべての商品は、施術記録の画面と同じキーで読み、台帳のページは、そのキーの下で読む。reject せず、画面が区別する結果の直和型を返す。探す条件の読み方は `product-ledger.ts`、表示の言葉（価格、用途、状態、在庫の水準、日数と月数、カテゴリーの選択肢）は `product-format.ts`、フォームの読み方と、断られたあとに言うことは `product-form.ts` の純粋な関数
- **表示するだけの部品**は、台帳（`ProductTable`）、探す条件（`ProductFilter`）、内容（`ProductRecord`）、フォーム（`ProductForm`）。`ui` のカタログに、`Admin/Products/…` として並ぶ

### 在庫の画面

admin-app の `src/inventory/` に、サロンの在庫の行（商品のロットごとの行）を見て、在庫の行を足し、直し、削除する画面があります。見るのは、サロンの 4 つのロールと `admin`、変えるのは、`owner`、`manager`、`admin` です（API と同じ）。在庫の数は、[在庫の移動の画面](#在庫の移動の画面)と[棚卸しの画面](#棚卸しと在庫評価額の画面)で変えます。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/inventory` | 在庫。見かた（すべて、在庫僅少、期限切れ間近）を選ぶ。表（商品コード、商品名、ロット番号、使用期限、保管場所、在庫数）は 20 行ずつ読み、「さらに表示」で続きを読む。すべての行は、商品とロット番号で絞る。期限切れ間近は、今日まで、7 日後まで、30 日後まで、90 日後までから選ぶ。商品名から、その行へ。変えられるロールには、「在庫の行を足す」と、「棚卸しする」「在庫評価額」が出る | `GET /salons/{id}`、`GET /salons/{salonId}/products`（行の商品の名前と単位のために、最後まで）、`GET /inventory`、`GET /inventory/low-stock`、`GET /inventory/expiring`（見かたで 20 行ずつ。どれも開くたびに） |
| `/salons/:salonId/inventory/new` | 在庫の行を足す。商品（取り扱い中の商品から選ぶ）、ロット番号（ロット番号で分ける商品のとき）、使用期限、保管場所、棚、メモ。在庫数 0 の行として足す。足したら、その行へ移る | `GET /salons/{id}`、`GET /salons/{salonId}/products`（開くたびに）、`POST /inventory` |
| `/salons/:salonId/inventory/:inventoryId` | 在庫の行の内容（在庫の行、在庫）。最後の棚卸しは、日時と、数えたスタッフの名前（管理者が数えた行は、日時だけ）。「在庫の移動を記録する」と「在庫の移動の履歴」が、すべてのロールに出る。変えられるロールには、「在庫の行を直す」が出る | `GET /salons/{id}`、`GET /inventory/{id}`、`GET /salons/{salonId}/products`（どちらも開くたびに）、`GET /staff-profiles`（数えた人の名前のために、最後まで） |
| `/salons/:salonId/inventory/:inventoryId/edit` | 在庫の行を直す（商品のほかは、足す画面と同じ項目）と、削除。直したら、その行へ戻る。削除したら、在庫へ | `GET /salons/{id}`、`GET /inventory/{id}`、`GET /salons/{salonId}/products`（どちらも開くたびに）、`PATCH /inventory/{id}`、`DELETE /inventory/{id}` |

- **入口**は、ヘッダーの「在庫」（「商品」の次）
- **見かた**はアドレスに残る（`view` は `low-stock` か `expiring`。すべての行の `product` と `lot`、期限切れ間近の `days`）。見かたは `ui` の `Navigation`（「在庫の見かた」）のリンクで、いまの見かたに `aria-current` が付く。商品は ID、ロット番号は前後の空白を除いて 100 文字まで、`days` は選べる 4 つ（30 は書かない）。読めない値は、条件にしない。ロット番号は、書かれたとおりに（大文字と小文字を区別して）探す
- **在庫僅少**は、取り扱い中の商品のうち、すべてのロットを合わせた在庫数が最低在庫数以下の商品の、すべての行。行のない商品は出ない（API と同じ）。**期限切れ間近**は、在庫のある行のうち、使用期限がサロンの今日から選んだ日までのもので、期限の過ぎた行も出る。使用期限の順
- **行の名前**: 在庫の行は、商品を ID でしか持たない。商品の名前、商品コード、単位は、サロンのすべての商品（取り扱いをやめた商品も）を読んで付ける。商品が読めるまで、行は出さない。読んだ商品にない商品は「削除した商品」と言う。通知とダイアログでは、行を「商品名（ロット ロット番号）」と呼ぶ
- **使用期限**は、曜日を付けずに言う（`2025年12月31日`）。サロンの今日より前の行には、「期限切れ」の印を付ける。使用期限のない行は「期限なし」。引き当てた数と使える数は、在庫の行の内容で言う
- **足せる商品**は、取り扱い中の商品だけ。取り扱い中の商品がないサロンには、先に商品台帳に商品を足すように言う
- **ロット番号**は、商品の「在庫をロット番号で分ける」の印に従う。足す画面は、ロット番号で分ける商品を選んだときだけ、ロット番号の欄を出し、空にできない。ほかの商品の行は、ロット番号を送らない（`null`）。直す画面は、ロット番号で分ける商品の行と、ロット番号のある行に、ロット番号の欄を出す。印を外した商品の行のロット番号は、消すことだけができる
- **送る前に確かめること**は、API と同じ規則: 商品を選ぶこと、ロット番号（100 文字まで）、使用期限（1900年1月1日から2999年12月31日まで）、保管場所（100 文字まで）、棚（50 文字まで）。文字数はコードポイントで数える。前後の空白は除いて送り、空の欄は `null`
- **同じロット番号**の行がある（409）ときは、ロット番号の欄に言い、フォーカスを移す。ロット番号のない行が、その商品にすでにある（ロット番号で分けない商品の 2 つめの行と、ロット番号を消した行）ときは、フォームの上に言う
- **その間に変わった商品**: 選んだ商品が削除されていた（400。`productId` の `not_found`）ときは、商品の欄に言う。商品の印がその間に変わっていて、API がロット番号を断った（400。`lotNumber` の `custom`）ときは、フォームの上に言う。どちらも、商品を読み直し、フォームはいまの商品に従う（ロット番号の欄が出る、または消すことだけになる）
- **変えた項目だけを送る**: フォームを開いたときの行と、フォームの読み方で比べる。何も変えずに送ると、API を呼ばずに「変更はありませんでした。」と通知して、その行へ戻る
- **書いたあと**は、応答の行を読んだものに置き、読んだ在庫のページ（すべての見かた）を捨てる（`removeQueries`）。在庫の画面は、開くたびに読む
- **削除**は、直す画面の「削除」から、確かめるダイアログを経て行う。在庫数が 0 でない行は、API が断る（409）。ダイアログを閉じ、フォームの上に、在庫の移動で在庫数を 0 にしてから削除するように言う。行の在庫の移動の記録は残る
- **変えられないロール**: `staff` には「在庫の行を足す」も「在庫の行を直す」も出さない。足す画面と直す画面のアドレスを開くと、API を呼ばずに、変えられないことと、変えられるロールを言う。ほかのサロンのアカウントには、在庫の一覧の API の 403 で、そのサロンの在庫は見られないと言う。ない行、ID でないアドレス、ほかのサロンの行（`admin` が、別のサロンのアドレスで開いたものも）は、在庫の行が見つからないと言う。直しているあいだに削除された行は、保存したときに、在庫の行が見つからないと言う
- **API を呼ぶ関数**は `src/inventory/inventory-api.ts`（見かたの 1 ページ、1 行を読むこと、足すこと、直すこと、削除すること）にある。在庫のページは、サロンの在庫のキーの下で読む。reject せず、画面が区別する結果の直和型を返す。見かたの読み方は `stock-view.ts`、表示の言葉（行の名前、数量と単位、使用期限、保管場所、棚卸し、商品と期間の選択肢、見かたのリンク）は `stock-format.ts`、フォームの読み方と、断られたあとに言うことは `stock-form.ts` の純粋な関数
- **表示するだけの部品**は、表（`StockTable`）、探す条件（`StockFilter`）、内容（`StockRecord`）、フォーム（`StockForm`）。`ui` のカタログに、`Admin/Inventory/…` として並ぶ

### 在庫の移動の画面

admin-app の `src/inventory/` に、在庫の行ごとに在庫の移動を記録し、その履歴を見る画面があります。見るのと記録するのは、サロンの 4 つのロールと `admin` です。`staff` が記録するのは、仕入れ、施術で使用、店頭販売、返品で、在庫の調整、廃棄、サロン間の移動は、`owner`、`manager`、`admin` が記録します（API と同じ）。在庫の移動は、直すことも削除することもできません。

| パス | 画面 | 呼ぶ API |
|---|---|---|
| `/salons/:salonId/inventory/:inventoryId/movements` | 在庫の移動の履歴。新しい順に、表（日時、区分、増減、移動後の在庫数、金額、理由、記録した人）を 20 件ずつ読み、「さらに表示」で続きを読む。区分と、記録した日（サロンの日付）で絞る。「在庫の移動を記録する」と、在庫の行へのリンク | `GET /salons/{id}`、`GET /inventory/{id}`、`GET /salons/{salonId}/products`（どちらも開くたびに）、`GET /staff-profiles`（記録した人の名前のために、最後まで）、`GET /inventory/{id}/movements`（20 件ずつ。開くたびに） |
| `/salons/:salonId/inventory/:inventoryId/movements/new` | 在庫の移動を記録する。区分、向き（増えるか減るかを選ぶ区分のとき）、数量、単価、理由。記録したら、履歴へ移る | `GET /salons/{id}`、`GET /inventory/{id}`、`GET /salons/{salonId}/products`（どちらも開くたびに）、`POST /inventory/movement` |

- **入口**は、在庫の行の内容の「在庫の移動を記録する」と「在庫の移動の履歴」。どちらも、すべてのロールに出る
- **数量**は、正の数で入れる。増えるか減るかは、区分で決まる（仕入れは増える。施術で使用、店頭販売、廃棄は減る）。返品、在庫の調整、サロン間の移動は、「在庫が増える」か「在庫が減る」かを選ぶ。画面が符号を付けて送る。区分は、はじめは選ばない
- **送る前に確かめること**は、API と同じ規則: 区分を選ぶこと（アカウントが記録する区分だけ）、向きを選ぶこと、数量（0.01 から 99,999,999.99 まで、小数は 2 桁まで。全角の数字とカンマも読む）、単価（任意。0 以上の円の整数で、単価 × 数量を四捨五入した金額が 2,147,483,647 円まで）、理由（在庫の調整と廃棄では、空にできない）。減らす記録は、読んだ在庫の行の使える数（在庫数 − 引き当てた数）まで。増やす記録は、在庫数が 99,999,999.99 を超えないこと
- **その間に変わった在庫**: 在庫数が引き当てた数を下回る、または 99,999,999.99 を超える（409）ときは、送った数量の符号で言い分け、数量の欄に言う。在庫の行を読み直し、フォームの上の在庫数と使える数を、いまの数にする。その間に削除された行は、記録したときに、在庫の行が見つからないと言う
- **記録したあと**は、記録した区分と、記録したあとの在庫数を知らせ、履歴へ移る。読んだ在庫の行（その下の履歴も）と、読んだ在庫のページを捨てる（`removeQueries`）。在庫数が変わったので、在庫の一覧も、開き直すと読み直す
- **履歴の言葉**: 増減は、符号と単位を付ける（`+12 tube`、`−2.5 tube`）。理由のない、発注の入荷の在庫の移動は「発注の入荷」と言う。記録した人は、スタッフのプロフィールの名前で言う。管理者の記録と、在庫移動の記録を始めた時点の在庫（シードの在庫移動）は「記録なし」、サロンの一覧にないスタッフは「一覧にないスタッフ」
- **条件**はアドレスに残る（`type`、`from`、`to`）。期間は、始まりの日のサロンの 0 時から、終わりの日のサロンの 24 時の直前までとして、`startDate` と `endDate` に送る。読めない値と、始まりの日より前の終わりの日は、条件にしない
- **変えられないロール**: `staff` には、在庫の調整、廃棄、サロン間の移動の区分を出さず、オーナーとマネージャーが記録すると言う。API が断った（403）ときは、フォームの上に、記録できるロールを言う。ほかのサロンの行（`admin` が、別のサロンのアドレスで開いたものも）とない行は、在庫の行が見つからないと言う
- **API を呼ぶ関数**は `src/inventory/movements-api.ts`（履歴の 1 ページと、記録すること）にある。履歴は、在庫の行のキーの下で読む。reject せず、画面が区別する結果の直和型を返す。条件の読み方は `movement-search.ts`、表示の言葉（区分、向き、増減、理由、記録した人）は `movement-format.ts`、フォームの読み方と、断られたあとに言うことは `movement-form.ts` の純粋な関数。在庫の行と商品を読む部分（`WithStockRow`）は、在庫の行の内容と分け合う
- **表示するだけの部品**は、履歴の表（`MovementTable`）、探す条件（`MovementFilter`）、フォーム（`MovementForm`）。`ui` のカタログに、`Admin/Inventory/…` として並ぶ

### 棚卸しと在庫評価額の画面

admin-app の `src/inventory/` に、サロンの在庫を数えて記録する画面と、在庫が仕入価格でいくらになるかを見る画面があります。どちらも、`owner`、`manager`、`admin` のものです（API と同じ。棚卸しは、帳簿との差を在庫の調整で直すので、在庫の調整を記録できる人のもの。在庫評価額は、経営の数字）。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/salons/:salonId/inventory/count` | 棚卸し。サロンのすべての在庫の行に、数えた数の欄（行の名前がラベル。帳簿の在庫数、引き当てた数、保管場所が説明）と、理由の欄。記録すると、同じ画面に、帳簿の在庫数と差のあった行の表（在庫の行、帳簿の在庫数、数えた数、差）を出す。「在庫へ」と「続けて棚卸しする」 | `GET /salons/{id}`、`GET /salons/{salonId}/products`、`GET /inventory`（行の名前と単位のために、最後まで。100 行ずつ。どちらも開くたびに）、`POST /inventory/stock-count` |
| `/salons/:salonId/inventory/value` | 在庫評価額。合計（金額と品目数）と、カテゴリーごとの表（カテゴリー、品目数、在庫評価額。評価額の大きい順） | `GET /salons/{id}`、`GET /inventory/value-report`（開くたびに） |

- **入口**は、在庫の画面のヘッダーの「棚卸しする」と「在庫評価額」。`staff` には出さない
- **数える行**: 数えた数を入れた行だけを記録する。空の行は数えず、在庫数も変わらない。サロンは、棚ごとに、何度に分けて数えてもよい。1 回に記録するのは 500 行まで（API の上限）。差のなかった行も、最後に棚卸しした日時と人は書かれる（API と同じ）
- **送る前に確かめること**は、API と同じ規則: 1 行は数えること（数えた行がないことを、最初の行の欄に言う）、数えた数は 0 から 99,999,999.99 まで、小数は 2 桁まで（全角の数字とカンマも読む）、読んだ行の引き当てた数を下回らないこと（引き当てた在庫も棚にある）。理由は任意で、空なら API が「棚卸しの差異」と記録する
- **その間に変わった行**: 数えた行がその間に削除された（400、`items.<n>.inventoryId` の `not_found`）ときと、その間に引き当てられて、数えた数が引き当てた数を下回る（409）ときは、何も記録されない。フォームの上に言い、在庫の行を読み直す。入れた数は、残った行の欄にそのまま残る
- **記録したあと**は、記録した行の数と差のあった行の数を知らせ、差のあった行の表を出して、見出しにフォーカスを移す。差のある行がなければ、どの行も帳簿と同じだったと言う。読んだ在庫（在庫のページ、在庫評価額、棚卸しの画面の行）と、記録した行（その下の履歴も）を捨てる（`removeQueries`）。「続けて棚卸しする」で、読み直した行の空のフォームに戻る。数えた行の内容には、最後の棚卸しの日時と、数えた人の名前が出る
- **在庫評価額**は、在庫数 × 商品の仕入価格の和を、商品のカテゴリーごとに言う。仕入価格のない商品は 0 円、カテゴリーのない商品は「カテゴリーなし」。在庫のある商品がなければ、そう言う。在庫の移動と棚卸しは、在庫のキーの下にある在庫評価額を捨てる
- **使えないロール**: `staff` が棚卸しと在庫評価額のアドレスを開くと、API を呼ばずに、使えないことと、使えるロールを言う。ほかのサロンのアカウントには、API の 403 で、そのサロンの在庫は見られないと言う
- **API を呼ぶ関数**は `src/inventory/count-api.ts`（棚卸しを記録すること、在庫評価額を読むこと）と、`src/inventory/inventory-api.ts`（サロンのすべての行を読むこと）にある。reject せず、画面が区別する結果の直和型を返す。フォームの読み方と、断られたあとに言うことは `stock-count.ts` の純粋な関数
- **表示するだけの部品**は、棚卸しのフォーム（`CountForm`）、差のあった行の表（`CountResult`）、在庫評価額（`ValueReport`）。`ui` のカタログに、`Admin/Inventory/…` として並ぶ

### 在庫のアラートの画面

admin-app の `src/inventory/` に、サロンの在庫のアラートを見て、確認済みにする画面があります。サロンの `owner`、`manager`、`staff` と `admin` が使います（API と同じ。アラートは、そのサロンで働く誰もが手を打つもの）。アラートは保存されず、API が読むたびに、商品と在庫の行から求めます（[在庫のアラート](./inventory-alerts.md)）。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/salons/:salonId/inventory/alerts` | 在庫のアラート。今出ているアラートの件数と、そのうち未確認の件数、重要度（緊急、注意、情報）ごとの件数。探す条件（種類、重要度、確認）と、表（アラート〔重要度と種類〕、対象、在庫数、確認）。表は 20 件ずつ読み、「さらに表示」で続きを読む。未確認のアラートの「確認済みにする」で、ダイアログ（重要度、在庫数、最低在庫数か最大在庫数か使用期限、メモの欄）を開く。「在庫へ」 | `GET /salons/{id}`、`GET /inventory-alerts/summary`、`GET /inventory-alerts`（どちらも開くたびに）、`GET /staff-profiles`（確認した人の名前のために、最後まで）、`POST /inventory-alerts/acknowledge` |

- **入口**は、在庫の画面のヘッダーの「在庫のアラート」。どのロールにも出す
- **条件**は、アドレスのクエリに持つ（`alert`、`severity`、`acknowledged`。API のパラメーターと同じ名前）。同じ条件で「表示する」を押すと、今のアラートを読み直す。絞り込んで 1 件もなければ、そう言って、条件を変えるよう促す。「条件をすべて外す」で、すべてのアラートに戻る
- **並び**は API のまま、商品コードの順。商品のアラートが、その商品の在庫の行のアラートより前
- **表**: 商品のアラート（在庫僅少、在庫過剰）は、商品名と商品コードで言い、在庫数（サロンのすべての行の合計）の下に、比べた最低在庫数か最大在庫数を添える。在庫の行のアラート（期限切れ間近、期限切れ）は、商品名とロット番号で言い、在庫の行の内容へのリンクにして、下に使用期限を添える。確認の列は、確認した日時（サロンの時計）と、確認したスタッフの名前と、メモ。管理者が確認したものと、スタッフの一覧を読んでいるあいだは、日時だけ。一覧にないスタッフは「一覧にないスタッフ」。ノートパソコンの幅に収まるよう 4 列にし、対象と確認の列は折り返す。それより狭い画面では、表を横にスクロールする
- **確認済みにする**: メモは任意で、空なら送らない（null）。記録したら、アラート（件数と一覧）を読み直してからダイアログを閉じ、確認したことを知らせて、見出しにフォーカスを移す
- **その間に変わったアラート**: 在庫が動くか商品が変わって、アラートがもう出ていない（404）ときと、その間にほかの人が確認した（409）ときは、何も記録されない。見出しの下にそう言い、アラートを読み直してからダイアログを閉じて、見出しにフォーカスを移す。在庫を使い切った行の期限切れは消え、代わりに商品の在庫僅少が出ることがある。アクセスが多すぎるときと通信の失敗は、ダイアログの中で言い、もう一度送れる
- **確認が効くあいだ**: 在庫が動くか、最低在庫数か最大在庫数が変わって、アラートの状態が変わると、API が確認を外す。画面は、一覧の `acknowledgement` をそのまま出す。在庫の移動と棚卸しは、在庫のキーの下にあるアラートを捨てる
- **ほかのサロン**: ほかのサロンのアカウントには、API の 403 で、そのサロンの在庫は見られないと言う
- **API を呼ぶ関数**は `src/inventory/alerts-api.ts`（アラートの 1 ページ、件数、確認）にある。reject せず、画面が区別する結果の直和型を返す。条件の読み方は `alert-search.ts`、アラートの名前は `alert-format.ts`、送る確認と、確認のあとに言うことは `alert-acknowledgement.ts` の純粋な関数
- **表示するだけの部品**は、件数（`AlertSummary`）、探す条件（`AlertFilter`）、表（`AlertTable`）、ダイアログ（`AlertDialog`）。`ui` のカタログに、`Admin/Inventory/…` として並ぶ

### 発注の画面

admin-app の `src/purchase-orders/` に、サロンの発注を探して見る画面、発注を作る画面、発注のステータスを進める操作、納品予定日とメモを直す画面、入荷を記録する画面と、発注の提案の画面があります。サロンの `owner`、`manager`、`staff` と `admin` が使います（API と同じ。足りない商品を頼み、仕入先とのやりとりと届いた品を記録するのは、日々在庫を扱うスタッフ）。承認と取り消しは、`owner`、`manager`、`admin` だけです（お金を使うことを決める）。発注のルールは[発注](./purchase-orders.md)にあります。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/salons/:salonId/purchase-orders` | 発注。探す条件（ステータス、仕入先、発注日の期間）と、表（発注番号、発注日、仕入先、ステータス、合計、納品予定日）。表は 20 件ずつ読み、「さらに表示」で続きを読む。ヘッダーの「発注を作る」と「発注の提案」 | `GET /salons/{id}`、`GET /purchase-orders`（`salonId` を付けて、開くたびに） |
| `…/purchase-orders/:purchaseOrderId` | 発注の内容。状態（ステータスと、いまできる操作と入荷の記録。取り消しは理由を書くダイアログ）、発注（発注番号、ステータス、仕入先、発注日時と作ったスタッフ、納品予定日、承認と納品と取り消しのうち起きたこと、支払条件、メモ、納品のメモ）、明細の表（商品コード、商品名、数量、単価、金額、メモ）、金額（小計、税額、送料、合計）。ヘッダーの「納品予定日とメモを直す」と、「発注へ」 | `GET /salons/{id}`、`GET /purchase-orders/{id}`（開くたびに）、`GET /staff-profiles`（作った人と承認した人の名前のために、最後まで）、`PATCH /purchase-orders/{id}`（`status` だけ）、`POST /purchase-orders/{id}/approve`、`POST /purchase-orders/{id}/cancel` |
| `…/purchase-orders/:purchaseOrderId/edit` | 発注を直す。納品予定日、納品のメモ、メモ | `GET /salons/{id}`、`GET /purchase-orders/{id}`（開くたびに）、`PATCH /purchase-orders/{id}`（変えた欄だけ） |
| `…/purchase-orders/new` | 発注を作る。仕入先、明細（サロンのすべての在庫の行に、数量と単価の欄）と小計、税額、送料、納品予定日、支払条件、メモ。アドレスの `suggested` が仕入先を言うときは、その仕入先と、その仕入先の発注の提案の数量で始まる | `GET /salons/{id}`、`GET /inventory`（最後まで）、`GET /salons/{salonId}/products`（行の名前、単位、仕入価格のために）、`GET /purchase-orders/reorder-suggestions`（`suggested` があるとき、開くたびに、最後まで）、`POST /purchase-orders` |
| `…/purchase-orders/:purchaseOrderId/receive` | 入荷を記録する。届いた数量（在庫の行が残っている明細ごと）と、納品のメモ。在庫の行が削除された明細は、名前と、入荷できないことを言う | `GET /salons/{id}`、`GET /purchase-orders/{id}`（開くたびに）、`POST /purchase-orders/{id}/receive` |
| `…/purchase-orders/suggestions` | 発注の提案。仕入先ごとのカードに、表（商品コード、商品名、在庫、発注中、発注点、最大在庫数、提案する数量、最後の発注日）と、その仕入先への発注を作るリンク。「発注へ」 | `GET /salons/{id}`、`GET /purchase-orders/reorder-suggestions`（`salonId` を付けて、開くたびに、最後まで） |

- **入口**は、サロンのナビゲーションの「発注」（「在庫」のあと）。どのロールにも出す
- **条件**は、アドレスのクエリに持つ（`status`、`supplier`、`from`、`to`）。発注日はサロンの日付で選び、その日の始まりから終わりまでを UTC の日時にして送る（`startDate`、`endDate`）。仕入先は、API と同じく名前のすべてで探す（欄の説明にそう書く）。終わりの日が始まりの日より前なら、送らずに欄で言う。同じ条件で「表示する」を押すと、今の発注を読み直す。絞り込んで 1 件もなければ、そう言う。「条件をすべて外す」で、すべての発注に戻る
- **並び**は API のまま、発注日時の新しい順
- **ステータス**は、下書き、承認待ち、承認済み、発注済み、出荷済み、納品済み、取り消し。承認待ちは警告、進んでいるもの（承認済み、発注済み、出荷済み）は情報、納品済みは成功の色の印にする
- **発注の内容**: 発注日時、承認、納品日時、取り消しはサロンの時計で言い、納品予定日は日付だけで言う（納品は日で約束する）。作った人と承認した人は、スタッフの一覧を読んだあとで名前を添える。管理者がしたことと、一覧を読んでいるあいだは、日時だけ。明細の商品名は、在庫の行がある間は、その行の内容へのリンクにする。アドレスのサロンと違うサロンの発注は、見つからない発注と同じく言う（管理者は、どのサロンの発注も読める）
- **明細の選び方**は棚卸しと同じ: サロンのすべての在庫の行（商品コードとロットの順）に、数量と単価の欄を並べ、数量を入れた行だけを、フォームの順に明細にする。単価のはじめの値は、商品の仕入価格（ない商品は空）。数量の欄の説明に、行の在庫数を言う。明細のメモは送らない（null）
- **小計**は、入れた数量と単価から、API と同じ計算（明細ごとに、数量×単価の円未満を四捨五入）で、その場で言う。税額は、仕入先の請求に合わせて入れてもらい、欄の説明に、小計にサロンの税率をかけた額（円未満切り捨て）を言う
- **送る前に確かめること**は API と同じ規則: 仕入先は空白だけでない 255 文字以下、明細は 1〜100 行、数量は 0 より大きく 99,999,999.99 以下で小数 2 桁まで、単価、税額、送料は 0 以上の整数。明細の金額が 2,147,483,647 円を超えるときは、その数量で入れられる単価の上限を単価の欄で言い、合計が超えるときは、発注を分けるようフォームの上で言う
- **作ったあと**: 発注は下書きになる。発注の内容へ移り、作ったこと（発注番号と下書き）を知らせる。作った発注は読み直さずにそのまま見せ、発注の一覧のキーを捨てる
- **その間に削除された行**: 400（`items.<n>.inventoryId` の `not_found`）では、何も作られない。フォームの上でそう言い、在庫の行を読み直す。入れた数は、残った行の欄に残る
- **ほかのサロン**: ほかのサロンのアカウントには、API の 403 で、そのサロンの発注は見られないと言う。在庫の行のないサロンでは、発注を作れないことと、在庫の行を足せる人を言う
- **状態**: 発注の内容の、発注の上に「状態」を置く。ステータスの印と、いまできる操作のボタン。下書きは「承認を依頼する」、承認待ちは「承認する」、承認済みは「発注済みにする」、発注済みは「出荷済みにする」。納品済みと取り消し以外は「発注を取り消す」。承認と取り消しは、`owner`、`manager`、`admin` にだけ出し（API の `purchaseOrderApproverReachOf` と同じ）、スタイリストには、ボタンの下に、承認と取り消しをできる人を言う。納品済みと取り消しの発注には、ステータスがもう変わらないと言う。発注済みと出荷済みの発注には、どのロールにも「入荷を記録する」（入荷の画面へのリンク）を、進める操作のあと、取り消しの前に出す
- **進める操作**（承認の依頼、承認、発注済み、出荷済み）は、確かめずにすぐ送る。ステータスを進めるのは、仕入先とのやりとりを記録すること。承認の依頼、発注済み、出荷済みは、`status` だけの更新（`PATCH`）で、承認は `POST …/approve`
- **取り消し**は、元に戻せないので、ダイアログで理由を書いてから送る。理由は必須で、空白だけなら送らずに欄で言う。出荷済みの発注では、返品の扱いを仕入先と決めてから取り消すよう、ダイアログの説明で言う。理由は、発注の内容の「取り消した理由」に残る
- **操作のあと**: 答えの発注で発注を置き換え（読み直さない）、した操作を発注番号とともに知らせ、「状態」の見出しにフォーカスを移す。発注の一覧のキーを捨てる（一覧の並びとステータスが変わる）。通信の失敗と、アクセスの多すぎは、「状態」の上（取り消しはダイアログの中）で言い、もう一度押せる
- **その間に変わった発注**: 409 は、何も変わっていない。「状態」の上で、ほかの画面か端末で変わっていたと言い、発注を読み直して、見出しにフォーカスを移す。API は、今と同じステータスへの更新を受けるので、ほかの人が同じ一歩を先に進めたときは、そのまま進めたと知らせる
- **納品予定日とメモを直す**: ヘッダーの「納品予定日とメモを直す」から、`…/purchase-orders/:purchaseOrderId/edit` へ。納品済みと取り消しの発注には出さない（API が変えない）。フォームは、開くたびに読んだ発注で開き、変えた欄だけを送る（変えていない欄は送らず、空にした欄は null）。何も変えずに送ると、API を呼ばずに、変更がなかったと知らせて発注の内容へ戻る。納品予定日は、サロンの日付で選び、その日の始まりを送る。直したら、答えの発注を見せて、発注の内容へ戻る。その間に納品か取り消しになった発注（409）は、読み直して、直せないと言う
- **入荷**: 発注済みか出荷済みの発注の「状態」の「入荷を記録する」から、`…/purchase-orders/:purchaseOrderId/receive` へ。サロンの誰でも記録できる（届いた品を受け取るのは、その場にいるスタッフ）。フォームは、開くたびに読んだ発注で開き、在庫の行が残っている明細ごとに、届いた数量の欄を出す。はじめの値は発注した数量で、届かなかった明細は空にする。空の明細は受け取らず、入荷のあと発注は納品済みになるので、あとから届いた分と、発注より多く届いた分は、在庫の移動（仕入れ）で記録する（フォームの説明でそう言う）。在庫の行が削除された明細は、名前と、入荷できないことを言う。ほかのステータスの発注と、すべての明細の行が削除された発注には、フォームを出さずに理由を言い、「発注へ戻る」を出す
- **送る前に確かめること**（入荷）は API と同じ規則: 届いた数量は 0 より大きく、発注した数量以下で、小数 2 桁まで（その欄で言う）。1 件も入れなければ、最初の明細の欄で言う。納品のメモは、変えたときだけ送る（API は null でメモをそのままにする）ので、いまのメモを空にしたときは、入荷では消せないと欄で言う
- **入荷のあと**: 答えの発注を見せて発注の内容へ移り、在庫に入れた明細の件数を知らせる。発注の一覧と提案のキー、サロンの在庫のキー（在庫の行、アラート、在庫評価額）と、受け取った在庫の行のキー（その行と在庫の移動）を捨てる。その間に明細の行が削除された（400 の `items.<n>.inventoryId` の `not_found`）か、発注が変わったか、入荷すると在庫数が 99,999,999.99 を超える（409）ときは、何も記録されない。フォームの上でそう言い、発注を読み直す（入れた数は、残った明細の欄に残る）
- **発注の提案**: 発注の一覧のヘッダーの「発注の提案」から。提案は API のまま（在庫と発注中の数の和が発注点以下の商品と、最大在庫数、ない商品は発注点まで補う数。商品コードの順）で、仕入先ごとのカードにまとめる（発注は仕入先ごとに作る。仕入先の名前の順で、仕入先の決まっていない商品は最後）。開くたびに読み、発注を作るか進めると、発注のキーと一緒に捨てる（発注中の数が変わる）。提案がなければ、そう言う
- **提案から作る発注**: カードのリンクは `…/purchase-orders/new?suggested=<仕入先>`（仕入先の決まっていない商品は、空の値）。発注を作る画面は、提案も読み、その仕入先と、その仕入先の提案の数量で始まる。提案は商品を言い、明細は在庫の行を言うので、数量は、その商品の、フォームの順で最後の在庫の行（ロットで分ける商品は、最後のロット）に入れる。フォームの上で、何行に入れたか（ないときは、いまは提案がないこと）を言い、数量と単価を確かめてもらう。小計は、はじめの数量から言う。「やめる」は提案へ戻る
- **API を呼ぶ関数**は `src/purchase-orders/purchase-orders-api.ts`（発注の 1 ページ、発注、作る、ステータスを進める、承認する、取り消す、直す、入荷を記録する、すべての発注の提案）にある。reject せず、画面が区別する結果の直和型を返す。条件の読み方は `order-search.ts`、発注の名前は `order-format.ts`、フォームの読み方と、断られたあとに言うことは `order-entry.ts`、ステータスごとの操作と、それをできるロール、取り消しの理由の読み方、操作のあとに言うことは `order-actions.ts`、直すフォームの読み方は `order-change.ts`、入荷のフォームの読み方と、入荷できない理由と、断られたあとに言うことは `order-receipt.ts`、提案の仕入先ごとのまとめと、提案から始める発注の数量は `order-suggestions.ts` の純粋な関数
- **表示するだけの部品**は、探す条件（`OrderFilter`）、表（`OrderTable`）、発注の内容（`OrderRecord`）、フォーム（`OrderForm`）、状態と取り消しのダイアログ（`OrderStatusActions`）、直すフォーム（`OrderChangeForm`）、入荷のフォーム（`OrderReceiptForm`）、仕入先ごとの提案（`ReorderSuggestions`）。`ui` のカタログに、`Admin/PurchaseOrders/…` として並ぶ

### 店舗のレビューの画面

admin-app の `src/reviews/` に、サロンのレビューと評価のまとめを見る画面、レビューの内容、サロンからの返信を書いて直す画面と、返信の取り下げと運営への通報の操作があります。レビューは、だれでも読める（API が公開する）ので、サロンの `owner`、`manager`、`staff` と `admin` のだれもが見ます。返信はサロンの公式の発言なので、書いて直すのは `owner` と `manager` だけです。運営への通報も、サロンを代表する `owner` と `manager` だけです。`admin` は、規約に反する返信を取り下げるだけです（API と同じ）。レビューの決まりは[レビュー](./reviews.md)にあります。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/salons/:salonId/reviews` | レビュー。評価のまとめ（平均と件数、評価ごとの件数）、探す条件（評価の下限と上限、担当スタッフ、並び順）と、表（レビュー、投稿日、評価、コメント、担当スタッフ、返信、通報）。表は 20 件ずつ読み、「さらに表示」で続きを読む | `GET /salons/{id}`、`GET /salons/{salonId}/reviews/summary`（開くたびに）、`GET /reviews`（`salonId` を付けて、開くたびに）、`GET /staff-profiles`（担当スタッフの名前のために、最後まで） |
| `…/reviews/:reviewId` | レビューの内容。レビュー（総合の評価、投稿日、来店確認済みの印、タイトル、本文、項目ごとの評価、お客様、来店の予約、担当スタッフ、投稿日時と修正日時、写真、参考になった人数、未処理の通報の件数）、サロンからの返信（返信と返信日時、「返信を書く」か「返信を直す」、「返信を取り下げる」）、運営への通報（「通報する」）と、「レビューへ」 | `GET /salons/{id}`、`GET /reviews/{id}`（開くたびに）、`GET /customers/{id}`、`GET /staff-profiles`（最後まで）、`POST /reviews/{id}/respond`（取り下げは `ownerResponse` が null）、`POST /reviews/{id}/report` |
| `…/reviews/:reviewId/response` | レビューに返信する。お客様のレビュー（総合の評価、投稿日、タイトル、本文）と、返信の欄 | `GET /salons/{id}`、`GET /reviews/{id}`（開くたびに）、`POST /reviews/{id}/respond` |

- **入口**は、サロンのナビゲーションの「レビュー」（「顧客」のあと）。どのロールにも出す
- **条件**は、アドレスのクエリに持つ（`min`、`max`、`staff`、`sort`）。評価の上限が下限より低ければ、送らずに欄で言う（アドレスにあっても、条件にしない）。並び順は、新しい順（既定）、評価の高い順、参考になった順。並び順だけを変えても絞り込みではないので、表の名前は「レビュー」のまま。同じ条件で「表示する」を押すと、今のレビューを読み直す。絞り込んで 1 件もなければ、そう言う。「条件をすべて外す」で、すべてのレビューに戻る
- **開くたびに読む**: 評価のまとめ、一覧、レビューの内容は、開くたびに読む（`staleTime` が 0）。お客様は、いつでもレビューを書き、直し、消し、ほかの人の「参考になった」と通報が数を変える
- **表**: タイトルのないレビューは、総合の評価で呼ぶ（「評価 3 のレビュー」）。コメントは、書かれた改行のまま。担当スタッフは、スタッフを読んだあとで名前を添える（指名のないレビューは「指名なし」、サロンがもう出していない人は「一覧にないスタッフ」）。返信の有無（未返信は警告、返信済みは成功の色の印）と、未処理の通報の件数（危険の色の印）を言う
- **レビューの内容**: 項目ごとの評価は、お客様が評価した項目と同じ言葉で言い、つけなかった項目は「評価なし」。項目のスタッフの評価と、担当したスタッフの名前は、言い分ける（「スタッフの評価」「担当スタッフ」）。お客様の名前は、顧客台帳を読んで、そのお客様の台帳へのリンクにする（台帳から削除されたお客様は、そう言う）。予約は、その来店の予約の内容へのリンク。写真は、お客様が書いたアドレスへのリンクで、ページは何も読み込まない（`rel='noreferrer nofollow ugc'`）。修正日時は、修正されたレビューにだけ出す。アドレスのサロンと違うサロンのレビューと、ない（削除された）レビューは、「レビューが見つかりません」と言う（どのサロンのレビューも、だれでも読める）
- **ロールごとの操作**（`review-actions.ts` の `speaksForTheSalon`、`withdrawsAnswers`）: `owner` と `manager` には、「返信を書く」か「返信を直す」、「返信を取り下げる」と、「運営への通報」を出す。`admin` には「返信を取り下げる」だけを出し、返信を書くことと通報はサロンのオーナーとマネージャーがすると言う。`staff` には何も出さず、返信と通報をできる人を言う。返信の画面のアドレスを `staff` と `admin` が開くと、フォームの代わりに、返信を書ける人と「レビューへ戻る」を出す。ほかのサロンのオーナーが、そのサロンのアドレスで返信や通報を送ったときは、API の 403 を、フォーム（ダイアログ）の上で言う
- **返信**は、開くたびに読んだレビューのいまの返信で開き、書いたまま（前後の空白と改行も）送る。空白だけの返信は、送らずに欄で言う。いまと同じ返信は、API を呼ばずに、変更がなかったと知らせてレビューへ戻る。返信したら、答えのレビューを見せてレビューの内容へ戻り、返信したか、直したかを知らせる。書いている間にレビューが削除された（404）ときは、レビューを読み直して、見つからないと言う
- **取り下げ**は、元に戻せないので、ダイアログで確かめてから送る（返信は、あとからもう一度書けると言う）。`ownerResponse` に null を送り、答えのレビューを見せて、「サロンからの返信」の見出しにフォーカスを移す。送れなかったときは、ダイアログの中で言う
- **通報**は、ダイアログで理由（ポータルと同じ 5 つ）と詳しい内容を書いてから送る。詳しい内容は、前後の空白を除いて 2000 文字まで、「その他」では必須で、空なら null。誤りは欄で言い、最初の誤りの欄へフォーカスを移す。通報したら、ダイアログを閉じて知らせ、レビューを読み直す（未処理の通報の件数が増える）。このアカウントで通報してあった（409）ときは、フォームの代わりに、通報は 1 つのレビューに 1 回だと言い、「閉じる」だけを残して、そこへフォーカスを移す（API は、だれが通報したかを返さないので、押す前にはわからない）。通報しても、レビューは掲載されたままで、通報の内容を読むのは運営だけ（ダイアログの説明でそう言う）
- **書いたあと**: 返信、取り下げ、通報のあとは、サロンのレビューのキー（評価のまとめと、すべての一覧）を捨てる
- **API を呼ぶ関数**は `src/reviews/reviews-api.ts`（評価のまとめ、レビューの 1 ページ、レビュー、返信と取り下げ、通報）にある。reject せず、画面が区別する結果の直和型を返す。条件の読み方は `review-search.ts`、レビューの言葉は `review-format.ts`、ロールごとの操作、返信と通報のフォームの読み方、断られたあとに言うことは `review-actions.ts` の純粋な関数
- **表示するだけの部品**は、評価のまとめ（`ReviewSummary`）、探す条件（`ReviewFilter`）、表（`ReviewTable`）、レビュー（`ReviewRecord`）、サロンからの返信と取り下げのダイアログ（`ReviewAnswer`）、運営への通報とそのダイアログ（`ReviewReport`）、返信のフォーム（`ResponseForm`）。`ui` のカタログに、`Admin/Reviews/…` として並ぶ
- **この画面にないもの**: 通報の一覧と却下（`GET /review-reports`、`POST /review-reports/{id}/dismiss`）は、`admin` だけの運営の操作

### サロンのファイルの画面

admin-app の `src/attachments/` に、サロンのファイル（施術の前後の写真、お客様の同意書などの書類）の一覧とアップロードの画面と、ファイルを開き、保存し、削除する画面があります。ファイルは、サロンの `owner`、`manager`、`staff` と `admin` のだれもが見て、アップロードします。削除するのは、`owner`、`manager`、`admin` と、アップロードした本人です（API と同じ）。ファイルの決まりは[添付ファイル](./attachments.md)にあります。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/salons/:salonId/files` | ファイル。アップロードのフォーム（ファイル 1 つ）と、表（ファイル名、種類、サイズ、アップロードした人、アップロード日時）。表は 20 件ずつ読み、「さらに表示」で続きを読む | `GET /salons/{id}`、`GET /attachments`（`salonId` を付けて、開くたびに）、`GET /salons/{salonId}/staff`（`owner` と `admin` だけ、アップロードした人の名前のために、最後まで）、`POST /attachments/upload-url`、ストレージへの `PUT`（署名付き URL）、`POST /attachments/{id}/complete` |
| `…/files/:attachmentId` | ファイル。画像なら画像、「新しいタブで開く」と「保存する」、ファイル名、種類、サイズ、アップロードした人、アップロード日時、「ファイルを削除する」、その下の共有リンクと、「ファイルの一覧へ」 | `GET /salons/{id}`、`GET /attachments/{id}`（開くたびに）、`GET /attachments/{id}/download-url`（`inline` が true と false の 2 つ。開いたときと、4 分ごとに）、`GET /salons/{salonId}/staff`（`owner` と `admin` だけ）、`DELETE /attachments/{id}` |

- **入口**は、サロンのナビゲーションの「ファイル」（「レビュー」のあと）。どのロールにも出す
- **選んだファイル**は、選んだときに画面が持ち、送るときに API と同じ規則で確かめる: 名前の拡張子で決まる 4 つの種類（JPEG、PNG、WebP、PDF。大文字の拡張子も）、1 バイトから 10 MB、名前は 255 文字までで、制御文字と `/`、`\` を含まない。違えば、送らずに欄で言う。選ぶ欄が出すのは、4 つの種類のファイルだけ（`accept`）
- **アップロード**は 3 つのリクエスト: アップロード用 URL の発行（名前、種類、サイズ）、ブラウザーからストレージへの `PUT`（API が返したヘッダーをそのまま付ける。ストレージへのリクエストなので、セッションのトークンは付けない）、完了。ストレージが受け取らなかったときは、送れなかったと言う（もう一度送れる）。中身が拡張子の種類と違う（409。API はその添付ファイルを終わらせる）ときと、選んだあとでファイルが読めなくなったときは、欄で言う。アップロードしたら、フォームを空にしてその見出しにフォーカスを移し（次のファイルのため）、一覧を読み直して、ファイル名で知らせる
- **開くたびに読む**: 一覧とファイルは、開くたびに読む（`staleTime` が 0）。サロンのだれもが、いつでもアップロードし、削除する
- **アップロードした人**: このアカウントなら「あなた」。スタッフ台帳を読める `owner` と `admin` には、台帳の表示名で言う。そのほかのロールと、台帳にない人（管理者、台帳から削除された人）は「ほかのアカウント」
- **開く、保存する**: 5 分で切れるダウンロード用 URL を、画面を開いたときに 2 つ読み、4 分ごとに読み直す（タブが裏にあっても）。前の画面で読んだ URL は使わない（`gcTime` が 0）。リンクはストレージの URL を指すふつうの `<a>` で、「新しいタブで開く」（`inline`、`target='_blank'`、`rel='noopener noreferrer'`）と「保存する」（アップロードした名前で保存される）。押してから URL を読むと、新しいタブがポップアップとして止められるため。画像は、`inline` の URL で `<img>` に出す（代替テキストはファイル名）。PDF は出さない。URL が読めなかったときは、そう言って読み直せる
- **削除**は、元に戻せないので、ダイアログで確かめてから送る（そのファイルの共有リンクも使えなくなると言う）。削除できないアカウント（ほかの人がアップロードしたファイルの `staff`）には、ボタンの代わりに、削除できる人を言う。削除したら、一覧のキーを捨てて一覧へ戻り、ファイル名で知らせる。その間にほかの人が削除していた（404）ときは、ファイルを読み直して、見つからないと言う。送れなかったときは、ダイアログの中で言う
- **見つからない**: ない ID、削除したファイル、アドレスのサロンと違うサロンのファイルは、「ファイルが見つかりません」と言う。ほかのサロンのスタッフがファイルの一覧を開くと、フォームを出さずに、見られないと言う
- **API を呼ぶ関数**は `src/attachments/attachments-api.ts`（一覧の 1 ページ、ファイル、ダウンロード用 URL、アップロードの 3 つのリクエスト、削除）にある。reject せず、画面が区別する結果の直和型を返す。ファイルの規則、種類とサイズの言い方、削除できる人、断られたあとに言うことは `attachment-file.ts` の純粋な関数。アップロードした人の名前は `use-uploader-name.ts`
- **表示するだけの部品**は、アップロードのフォーム（`AttachmentUpload`）、表（`AttachmentTable`）、ファイルと削除のダイアログ（`AttachmentRecord`）。`ui` のカタログに、`Admin/Attachments/…` として並ぶ
- **共有リンク**は、ファイルの画面の下にある（[共有リンクの発行と管理の画面](#共有リンクの発行と管理の画面)）。共有リンクを開く画面は、portal-app の[共有リンクの画面](#共有リンクの画面)
- **この画面にないもの**: サロンに属さないファイル（`salonId` が null）と掃除（`POST /attachments/purge`）は、`admin` だけの運営の操作

### 共有リンクの発行と管理の画面

admin-app の `src/share-links/` に、サロンのファイルの共有リンクを発行し、一覧し、取り消す画面があります。共有リンクは、アカウントを持たない人（お客様、取引先）にファイルを見せるリンクで、その人は portal-app の[共有リンクの画面](#共有リンクの画面)で開きます。共有リンクを発行し、一覧し、取り消すのは、サロンの `owner`、`manager` と `admin` です（API と同じ）。共有リンクの決まりは[添付ファイルの共有リンク](./attachments.md#共有リンク)にあります。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `…/files/:attachmentId`（ファイルの画面の下） | 共有リンク。「共有リンクを発行する」と、表（発行日時、有効期限、ダウンロード、パスワード、状態）。新しい順に 20 件ずつ読み、「さらに表示」で続きを読む。期限切れと、回数の上限に達したものも出す | `GET /attachments/{attachmentId}/share-links`（開くたびに） |
| `…/files/:attachmentId/share-links/new` | 共有リンクを発行する。有効期間（1、3、7、14、30 日。初めは 7 日）、ダウンロードの回数の上限（空なら上限なし）、パスワード（空ならなし）。発行したら、フォームの代わりに、発行したリンク（アドレスの欄、「リンクをコピーする」、有効期限、回数の上限、パスワードの有無）と、「共有リンクを見る」、「ファイルへ戻る」 | `GET /salons/{id}`、`GET /attachments/{id}`（開くたびに）、`POST /attachments/{attachmentId}/share-links` |
| `…/files/:attachmentId/share-links/:shareLinkId` | 共有リンク。状態、有効期限、ダウンロード、パスワード、発行した人、発行日時、「共有リンクを取り消す」と、「ファイルへ戻る」 | `GET /salons/{id}`、`GET /attachments/{id}` と `GET /attachments/share-links/{shareLinkId}`（どちらも開くたびに）、`GET /salons/{salonId}/staff`（`owner` と `admin` だけ、発行した人の名前のために）、`DELETE /attachments/share-links/{shareLinkId}` |

- **入口**は、ファイルの画面の下の「共有リンク」。`staff` には、表と発行のボタンの代わりに、共有できる人を言う。アップロードが済んでいないファイルには、共有できないと言う。発行のアドレスを開いたときも同じ
- **有効期限**は、選んだ日数（1 日は 24 時間）を端末の時計のいまに足し、分に切り捨てた時刻で送る（API が受け付ける 720 時間を超えない）。API が有効期限を断ったときは、端末の時計を確かめるよう、有効期間の欄で言う
- **回数の上限**は、全角の数字と桁区切りのカンマも受け付け、1 から 2,147,483,647 までの整数。空なら上限なし（null）
- **パスワード**は、API と同じに、NFC にした文字（コードポイント）を数えて 8 文字から 128 文字。入力したまま送り、空ならパスワードなし（null）。推測されやすいパスワード（API の `blocklisted`）は、そう欄で言う。ブラウザーのパスワードの管理には、新しいパスワードとして渡す（`autocomplete='new-password'`）。上限とパスワードが違えば、送らずに欄で言う
- **発行したリンク**は、API が発行の応答にだけ入れるトークンを、portal の `/share#token=<トークン>`（`VITE_PORTAL_APP_URL`）にしたアドレス。画面が開いている間だけ持ち、どこにも保存しない。この画面を離れると表示できないことと、パスワードはリンクとは別の方法で伝えることを言う。フォームの代わりに出し、その見出しにフォーカスを移す。アドレスの欄は読み取り専用で、フォーカスすると全体を選ぶ。「リンクをコピーする」はクリップボードに書き、書けたら状態の領域で言う。ブラウザーが書かせないときは、欄のアドレスを選んでコピーするよう言う。発行したら、そのファイルの共有リンクのキーを捨てる
- **状態**は、画面を出すときの時刻と回数から決める: 有効期限を過ぎたものは「期限切れ」、回数が上限に達したものは「回数の上限に達した」、そのほかは「使える」。パスワードを続けて間違えたためのロックは、API が返さないので出さない
- **取り消し**は、元に戻せないので、ダイアログで確かめてから送る。取り消したら、そのファイルの共有リンクのキーを捨ててファイルの画面へ戻り、知らせる。その間に取り消されていた（404）ときは、読み直して、見つからないと言う。送れなかったときは、ダイアログの中で言う
- **見つからない**: ない ID、取り消した共有リンク、アドレスのファイルと違うファイルの共有リンクは、「共有リンクが見つかりません」と言う。ファイルが見つからない（ほかのサロンのファイル、削除したファイル）ときは、ファイルの画面と同じに言う。`staff` が発行や共有リンクのアドレスを開くと、共有リンクを読まずに、共有できる人を言う
- **API を呼ぶ関数**は `src/share-links/share-links-api.ts`（一覧の 1 ページ、共有リンク、発行、取り消し）にある。reject せず、画面が区別する結果の直和型を返す。共有できるロール、フォームの読み取り、有効期限、アドレス、状態と、断られたあとに言うことは `share-link.ts` の純粋な関数
- **表示するだけの部品**は、ファイルの下の一覧（`ShareLinkList`）、発行のフォーム（`ShareLinkForm`）、発行したリンク（`IssuedShareLink`）、共有リンクと取り消しのダイアログ（`ShareLinkRecord`）。`ui` のカタログに、`Admin/ShareLinks/…` として並ぶ
- **この画面にないもの**: 共有リンクの変更（期限の延長、パスワードの変更。API にない。取り消して、発行し直す）と、発行したアドレスをあとで出すこと（API はトークンを一度しか返さない）

### 売上レポートの画面

dashboard-app の `src/reports/` に、サロンの売上レポートの画面があります。売上レポートを見るのは、サロンの `owner`、`manager` と `admin` です（API と同じ。dashboard-app を使えるロールも、この 3 つです）。集計の決まりは[売上レポート](./sales-reports.md)にあります。

| パス | 画面 | 呼ぶ API |
| --- | --- | --- |
| `/` | オーナーとマネージャーは、自分のサロンの売上レポートへ（アドレスを置き換える）。管理者は、売上レポートを開くサロンを選ぶ（キーワードで探す） | `GET /staff-profiles/me`（オーナーとマネージャー）、`GET /salons`（管理者） |
| `/salons/:salonId/reports` | 売上レポート。集計する期間と「集計する」、集計した期間、「CSV に出力する」、期間の合計（売上、返金、純売上、会計の件数、客単価、消費税、値引き）、支払い方法別の入金、メニューの区分別の売上、スタッフ別の売上の上位 5 人。どの部分も、その数え方を下に書く | `GET /salons/{id}`、`GET /sales-reports`（開くたびと、集計するたびに）、`GET /sales-reports/export` |
| `/salons/:salonId/reports/trends` | 売上の推移。集計する期間と区切り（日、週、月。週は月曜日から）と「集計する」、集計した期間、区切りごとの売上のグラフと、区切りごとの売上、会計の件数、客単価の表 | `GET /salons/{id}`、`GET /sales-reports/trends`（開くたびと、集計するたびに） |
| `/salons/:salonId/reports/daily` | 1 日の売上。日付と「表示する」、前の日と次の日へのリンク、その日の売上、会計の件数、返金、純売上 | `GET /salons/{id}`、`GET /sales-reports/daily`（開くたびと、表示するたびに） |

- **期間**は、アドレスの `from` と `to`（サロンの日付。両端を含む）。アドレスにないか、日付でないか、終わりが始まりより前か、366 日を超えるときは、サロンの今日までの、その月。フォームは、日付でないこと、終わりが始まりより前のこと、366 日を超えることを、送る前に欄で言い、その欄にフォーカスを移す。期間を変えて集計すると、アドレスを置き換える。同じ期間で「集計する」を押すと、読み直す
- **開くたびに読む**: 売上は会計のたびに増えるので、レポートは画面を出すたびに読み、前の画面が読んだものは出さない（読み終わるまで、読み込み中を出す）
- **売上のない期間**は、表の代わりに「この期間の売上はありません」と言い、CSV のボタンを出さない
- **スタッフ別**の売上は、明細を担当したスタッフ（明細になければ、会計の担当）のもので、商品の売上も入る。施術の数と施術の平均単価は、施術の明細だけで数える。そのため、売上を施術の数で割っても、平均単価にならないことがある。このことを表の下で言う
- **CSV** は、API が作るファイル（1 日 1 行）を、API が付けた名前のまま保存し、その期間と名前を通知で言う。ボタンはそのまま残り、フォーカスもそこにある。保存できなかった理由（その間にサロンが削除された、ほかのサロン、多すぎるリクエスト、通信の失敗）は、ヘッダーの下で言う。期間を変えると消える
- **ほかのサロン**: オーナーとマネージャーが、ほかのサロンのアドレスを開くと（API が 403）、そのサロンの売上レポートは見られないことと、見られる人を言い、自分のサロンの売上レポートへのリンクを出す（`salon-screens` の `OtherSalonNotice`）
- **削除されたサロン**: 開いている間に削除されたサロン（API が、`salonId` の `not_found` で 400）は、売上レポートを見られないと言い、トップページへのリンクを出す。ない ID のサロンは「サロンが見つかりません」
- **売上の推移**の期間は、アドレスの `from` と `to`、区切りは `period`（`daily`、`weekly`、`monthly`）。期間がアドレスにないときは、サロンの今日までの 12 か月（11 か月前の月の 1 日から）。区切りがないか、API にない区切りのときは、月。期間の決まりと誤りは、売上レポートと同じ。区切りを変えて集計すると、アドレスを置き換える。表の区切りは、日なら「2026年11月21日（土）」、週なら「2026年11月16日（月）からの週」、月なら「2026年11月」。最初と最後の週や月は、期間の中の日だけを数えることを、表の下で言う。どの区切りにも会計がないときは、表の代わりに「この期間の売上はありません」
- **グラフ**は、区切りごとの売上の縦棒で、表と同じ数を描く絵（支援技術からは隠し、表が読まれる）。目盛りは 0 から、売上のいちばん多い区切りを超える 1、2、5 × 10 の累乗までの 1 本で、その半分にも線を引く。目盛りの額は、1 万円未満はそのまま、1 万円からは「￥2.5万」。軸には最初と最後の区切りだけを書き、棒にポインターを載せると、その区切りと売上を出す
- **1 日の売上**の日は、アドレスの `date`（サロンの日付）。ないか、API が数えない日（1900-01-01 より前、カレンダーにない日）のときは、サロンの今日。前の日と次の日はリンクで、今日より後には進まない（売上がまだない）。売上のない日も、0 を出す（それが答え）。日付を消して「表示する」を押すと、欄で言い、フォーカスを移す。言ったことは、ほかの日を出すと消える
- **ヘッダーのリンク**は、管理者には「サロンを選ぶ」と、サロンのアドレスの下では「売上レポート」「売上の推移」「1 日の売上」。オーナーとマネージャーには、この 3 つ（`src/navigation.ts`）。いまの画面に印を付ける
- **API を呼ぶ関数**は `src/reports/sales-report-api.ts`（レポート、CSV、推移、1 日の売上）にある。reject せず、画面が区別する結果の直和型を返す。件数、割合（小数第 1 位まで）、順位の言葉と、CSV に出力したあとに言うことは `sales-report.ts`、区切りとその名前、12 か月、目盛りの額は `sales-trends.ts`、アドレスの日と前後の日は `daily-sales.ts` の純粋な関数。ほかのサロンと削除されたサロンについて言うことは、3 つの画面の `ReportRefusal`。期間は `salon-screens` の `period.ts`（`periodIn`、`monthUntil`）、保存するファイルは `io` の `fileOfAnswer`
- **表示するだけの部品**は、レポートの 4 つの部分（`SalesReport`）、推移のグラフ（`TrendChart`）と、グラフと表（`SalesTrend`）、1 日の売上（`DailySales`）と、日付のフォーム（`DayChoice`）。`ui` のカタログに、`Dashboard/Reports/...` として並ぶ。区切りの選択は、`salon-screens` の `StatisticsPeriod` の `children`（期間の下、ボタンの上）
- **この画面にないもの**: スタッフ別、区分別のレポート（API にあり、まだ画面がない）。前の期間や前年との比較（API にない）

## TanStack Query の設定

3つのアプリとも `src/main.tsx` で同じ設定の `QueryClient` を作り、`QueryClientProvider` でアプリ全体を包んでいます（`frontend/apps/admin-app/src/main.tsx` より）。

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
})
```

`VITE_MODE` が `production` 以外のときは React Query Devtools も表示します。`QueryClient` を作ったあと、`keepQueriesOfOneUser(queryClient)` を呼びます（[セッション](#アプリのセッションbeauty-salon-frontendsession)）。クエリを実行するのは、`useSession`（`RequireSession` と `SessionAccount` が使います）と、portal-app のアカウントの画面（リンクの確認）、サロンの画面、予約の画面です。予約の画面の、空いている時刻と予約のクエリは、この設定の `staleTime` を使わず、表示するたびに読みます（[予約の画面](#予約の画面)）。

`retry: 3` が再試行するのは、クエリが失敗（reject）したとき、つまり通信そのものが失敗したときです。API のエラー応答は値として返るので、再試行の対象になりません。画面の API を呼ぶ関数（`account-api.ts`、`salons-api.ts`、`bookings-api.ts`）は、通信の失敗も値にして返すので、どの場合も再試行されません。読み直すのは、利用者が「もう一度読み込む」を押したときです。

## 環境変数（`VITE_*`）

変数は各アプリのディレクトリにある `.env.<mode>` に置き、Vite がビルド時（開発サーバーでは起動時）に値を埋め込みます。リポジトリ直下の `.env.*` はバックエンド用で、`VITE_*` は入っていません。

| 変数 | 使っている場所 |
|------|----------------|
| `VITE_MODE` | `App.tsx` の `EnvironmentBanner`（本番以外で、画面の隅に環境名を表示する）、`main.tsx` の Devtools の表示判定 |
| `VITE_APP_TITLE` | `App.tsx` のヘッダーとトップページの見出し（portal-app のトップページは、サロンを探す画面） |
| `VITE_BACKEND_BASE_URL` | API サーバーのオリジン（パスは付けない）。`config` パッケージの `env` を通して `customInstance` が使う。アプリのコードからは使われていない |
| `VITE_ADMIN_APP_URL` | portal-app だけにある。admin-app のオリジン。招待を受けたあとの「店舗向けの画面を開く」のリンク先 |
| `VITE_PORTAL_APP_URL` | admin-app と dashboard-app にある。portal-app のオリジン。サインインの画面の「パスワードを忘れた場合」のリンク先（`/forgot-password`） |

- どのファイルが読まれるかは Vite のモードで決まります。開発サーバー（`pnpm dev`）と `build:dev` は `development`、`build:localhost` は `localhost`、`build:test` は `test`、`build:stg` は `staging`、`build:prod` は `production` です。3つのアプリとも、この 5 つのモードの `.env.<mode>` を持っています。
- ローカル用の 3 つ（`localhost`、`development`、`test`）の `VITE_BACKEND_BASE_URL` は `http://localhost:3000` で、リポジトリ直下の `.env.*` の `PORT` と同じです。ほかのアプリのオリジンは、開発サーバーのもの（portal-app は `http://localhost:3001`、admin-app は `http://localhost:3002`）です。
- `config` パッケージの `env` は、設定されていない変数を `undefined` として返します。

## アプリから使う

API を読む画面の例は、portal-app の[サロンの画面](#サロンの画面)です。フォームから API に書く画面の例は、[アカウントの画面](#アカウントの画面)です。

準備:

- 使うアプリの `package.json` に `@beauty-salon-frontend/api-client` と `ts-pattern` を追加する（portal-app にはある）
- API サーバーの `CORS_ORIGIN` にそのアプリのオリジンが含まれていることを確認する。リポジトリ直下の `.env.localhost` と `.env.development` は、3つのアプリのオリジン（`http://localhost:3001`〜`3003`）を許可している

画面は、生成された関数と型だけを使います。API を呼ぶ関数は、応答を `status` で分岐し、`.exhaustive()` で網羅を保証して、画面が区別する結果の直和型にして返します。通信の失敗（reject）も、API 定義にないステータスの応答も、その関数の中で結果の 1 つにします（`frontend/apps/portal-app/src/salons/salons-api.ts` より）。

```ts
const REFUSED = P.union(null, { status: 400 }, { status: 429 }, { status: 500 })

export const findSalons = async (
  conditions: SalonConditions,
  cursor: string | undefined,
): Promise<SalonPage> => {
  const answer = await salonCrudList({
    ...conditions,
    ...from(cursor),
    isActive: true,
    limit: SALONS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<SalonPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}
```

画面は、その関数をクエリの関数にして、結果の種類ごとに表示を決めます（`salon-search-screen.tsx` より）。

```tsx
const found = useInfiniteQuery({
  queryKey: ['salons', 'search', searched],
  queryFn: ({ pageParam }) => findSalons(conditions, pageParam),
  initialPageParam: firstCursor(),
  getNextPageParam: cursorAfter,
})
```

この分岐（200 と、400・429・500、応答なし）は、現在の生成クライアントの型に対して網羅になっています。API 定義に新しいステータスが増えると、`.exhaustive()` が型エラーになって気づけます。

`.exhaustive()` に渡している `outsideTheContract`（`frontend/apps/portal-app/src/outside-the-contract.ts`）は、API 定義にないステータスの応答を `{ type: 'failed' }` にする関数です。API の前に置いたゲートウェイやロードバランサーは、API に届かないときに 502、503、504 を返します。`customInstance` はどのステータスも値として返すので、この応答は分岐まで届きます。関数を渡さない `.exhaustive()` は、どのパターンにも合わない値で例外を投げます。そうなると、API を呼ぶ関数が reject し、読む画面は「読み込み中」のまま止まり、フォームは何も表示しません。関数を渡しても、型の上の網羅の検査は変わりません。

- 型は生成されたものをそのまま使う。`ModelsSalonResponse` と同じ形の型を手書きしない。`any` と型アサーションも使わない
- 登録・更新・削除は `useSalonCrudCreate` などのミューテーションフックを使い、結果も同じく `status` で分岐する。成功したら `getSalonCrudListQueryKey()` を使って一覧のキャッシュを無効化する。ただし、この 3 つはアクセストークンが必要である。トークンは、サインインしていれば `customInstance` が付ける（[セッション](#セッション)）。サインインしていなければ 401 が返る
- サーバーの検証エラーは `ModelsProblemDetails` の `errors`（項目ごとの `field`・`rule`・`message`）から表示する
- 429 のときは、レスポンスの `headers` から `Retry-After`（秒）を読める
- `endpoints/bookings/bookings.ts` のフックには、すべてサーバーに実装がある。`BookingCrud` の 11 個、`BookingServiceCrud` の 3 個、`AvailableSlotCrud` の 2 個、`CustomerBookings` の 5 個である。`BookingCrud` のフックは、一覧、作成、1 件の取得、更新、削除の 5 つ（`useBookingCrudList`、`useBookingCrudCreate`、`useBookingCrudGet`、`useBookingCrudUpdate`、`useBookingCrudDelete`）、ステータスの 5 つの操作（`useBookingCrudConfirm`、`useBookingCrudCancel`、`useBookingCrudStart`、`useBookingCrudComplete`、`useBookingCrudNoShow`）、日時の変更（`useBookingCrudReschedule`）である。どれも `admin` か、予約のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。削除は、サロンの `staff` でも 403 になる。サインインしていなければ 401 が返る。作成に渡すのは、サロン、顧客、担当スタッフ、施術明細（サービス、スタッフ、開始日時）と、内金、要望、メモ、受付経路だけである。終了日時、所要時間、金額、予約番号、来店日はサーバーが決めて返すので、画面で計算した値を送らない。`services[].startTime` は UTC（`Z`）の分単位で送る。作成の 409 は、スタッフがその時間に空いていないことを表す（`detail` にスタッフの ID が入る）。ステータスの操作は、操作のあとの予約を返すので、その値で表示を更新する。操作の 409 は、予約がその操作のできるステータスでないこと（`detail` に、いまのステータスと、操作できるステータスが入る）、または開始日時の前に無断キャンセルを記録しようとしたことを表す。別の画面が先にステータスを変えたときにも返るので、予約を読み直して表示する。どの操作ができるかは、予約の `status` から決まる（[予約台帳](./bookings.md#ステータスの操作)）。キャンセルと完了は本文が必須で、理由や実際の日時を記録しないときも、項目を null で送る。更新に渡すのは、内金、要望、メモ、受付経路のうち、変える項目だけである（値を消すときは null）。ステータスと日時は、更新では変えられない（400）。日時の変更には、新しい開始日時（`startTime`。UTC の分単位）と担当スタッフ（`staffId`）の両方を渡す。担当を変えないときも、いまの担当スタッフを渡す。サーバーが、施術明細を同じ時間だけ動かし、変更前の担当スタッフの明細を新しい担当スタッフに付け替えるので、返ってきた予約で表示を更新する。日時の変更の 409 は、予約が動かせるステータス（`draft`・`pending`・`confirmed`）でないこと、スタッフがその時間に空いていないこと、またはサロンのタイムゾーンをサーバーが知らないことを表す。`staffId` の 400 は、予約のサロンのスタッフでないことを表す。削除の成功は 204 で、本文がない。売上か施術記録が参照する予約の削除は 409 になる（[予約台帳](./bookings.md#削除)）。顧客、スタッフ、サービス、サロンの削除（`useCustomerCrudDelete`、`useStaffCrudDelete`、`useServiceCrudDelete`、`useSalonCrudDelete`）も、終わっていない予約（`draft`・`pending`・`confirmed`・`in_progress`）が参照している間は 409 になる（[予約台帳](./bookings.md#予約が参照するものの削除)）。画面は、予約の一覧を `customerId`・`staffId`・`salonId` と `status` で絞り込んで、妨げている予約を示す。`BookingServiceCrud` のフックは、施術明細の追加（`useBookingServiceCrudCreate`）、1 件の取得（`useBookingServiceCrudGet`）、削除（`useBookingServiceCrudDelete`）である。必要なアクセストークンは `BookingCrud` と同じで、明細の削除は、サロンの `staff` にもできる。追加に渡すのは、作成の `services[]` の 1 件と同じ形（サービス、スタッフ、UTC の分単位の開始日時、メモ）である。追加と削除ができるのは、終わっていない予約（`draft`・`pending`・`confirmed`・`in_progress`）だけで、サーバーが、予約の日時と金額を明細から算出し直す。追加が返すのは明細だけで、削除の成功は 204 なので、どちらのあとも、予約を読み直して表示する。追加の 409 は、予約が終わっていること、明細がすでに 20 件あること、明細が最も早い明細の開始から 24 時間以内に始まらないこと、スタッフがその時間に空いていないこと、金額が上限を超えること、またはサロンのタイムゾーンをサーバーが知らないことを表す。削除の 409 は、予約が終わっていること、予約の最後の明細であること（来店がなくなった予約は、キャンセルする）、またはサーバーが予約を算出し直せないこと（タイムゾーン、金額の上限）を表す。明細を書き換えるフックはない。明細の担当スタッフや開始日時を変えるには、新しい明細を追加してから、古い明細を削除する（[予約台帳](./bookings.md#施術明細の追加と削除)）。
- 空き枠のフックは 2 つある。`useAvailableSlotCrudList` は、サロン、サービス、日付（サロンのタイムゾーンでの日付）を渡すと、スタッフがそのサービスを始められる開始日時の一覧を返す。サインインしていれば、どのロールでも呼べる。`staffId` を渡すと、そのスタッフの枠だけになる。枠は `startTime`（UTC）の早い順で、1 ページは `limit` 件（既定は 20）。続きは `meta.nextCursor` を `cursor` に渡して読む。予約できない日（休業日、サービスを受け付けない日、過ぎた日）は、エラーではなく空の一覧なので、空の状態を表示する。サロンのタイムゾーンをサーバーが知らないときは 409 が返る。`useAvailableSlotCrudCheck` は、スタッフ、サービス、開始日時（UTC の分単位）を渡すと、その時間にスタッフが空いているか（`isAvailable`）と、重なっている予約の ID（`conflicts`）を返す。予約台帳と同じアクセストークンが必要で、顧客のアカウントでは 403 になる。確かめるのはスタッフの占有だけで、営業時間や勤務スケジュールは確かめない。どちらのフックも枠を押さえないので、そのあとの予約の作成が 409 になることがある。そのときは、空き枠を読み直す（[予約台帳](./bookings.md#空き枠)）
- 顧客が自分で入れる予約のフックは 5 つある。どれも、プロフィールのある、ロール `customer` のアカウントのアクセストークンが必要で、ほかのロールでは 403、プロフィールを作る前は 404 になる。`useCustomerBookingsCreate` は、空き枠の一覧の枠を 1 つ渡す（`salonId`、`serviceId`、枠の `staffId` と `startTime`、`customerRequest`。すべて必須で、要望がなければ `customerRequest` は null）。成功は 201 で、予約は `pending`（サロンの確定を待つ）なので、確定した予約としては表示しない。409 は、その時間が空き枠でなくなったこと、同じ時間に自分のほかの予約があること、サロンがこの顧客の予約をオンラインで受け付けていないことのどれかで、`detail` を表示して、空き枠を読み直す。`useCustomerBookingsList`（`status`、`bookingDateFrom`、`bookingDateTo` で絞り込み、`meta.nextCursor` で続きを読む）と `useCustomerBookingsGet` は、どのサロンの予約も、サロンが台帳に入れた予約も返す。レスポンスは `CustomerBookingResponse` で、サロン内のメモ、キャンセルした人と理由は含まない。`useCustomerBookingsCancel` は、`draft`・`pending`・`confirmed` の予約を、開始日時より前にだけキャンセルできる（そのあとは 409）。`useCustomerBookingsReschedule` は、`draft`・`pending`・`confirmed` の予約を、開始日時より前にだけ、別の空き枠に移す（`startTime` と `staffId`。どちらも必須で、担当を変えないときは、いまの `staffId` を渡す）。移せる先は、空き枠の一覧を、予約の明細の `serviceId` と `duration` で読んで出す。成功は 200 で、確定済みだった予約は `pending` に戻る（サロンの確定を待つ表示に戻す）。409 は、枠でなくなった、開始日時を過ぎた、明細が 2 件以上ある（サロンだけが移せる）、などで、`detail` を表示して、空き枠を読み直す。サービスは変えられない。キャンセルして、入れ直す（[予約台帳](./bookings.md#顧客による日時の変更)）
- `endpoints/sales/sales.ts` のフックには、すべてサーバーに実装がある。台帳の 5 つは、`useSaleCrudList`、`useSaleCrudCreate`、`useSaleCrudGet`、`useSaleCrudUpdate`、`useSaleCrudVoidSale` である。どれも、`admin` か、売上のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。`useSaleCrudVoidSale` は、サロンの `staff` でも 403 になる。`useSaleCrudCreate` には、明細の金額を計算して渡す。サーバーは、明細の `totalAmount` が `quantity` × `unitPrice` − `discountAmount` + `taxAmount` と合わなければ 400 を返し、黙って直さない。売上の `subtotal`、`taxAmount`、`totalAmount`、`saleNumber`、`saleDate` は、サーバーが決めて返す。400 の `errors` の `field` は、`details.0.totalAmount` のように、明細の番号を含む。409 は、その予約に取り消していない売上がすでにあるか、サロンのタイムゾーンをサーバーが知らないことを表す。一覧は会計日時の新しい順で、取り消した売上も含む。`useSaleCrudUpdate` には、変える項目だけを渡す。`details` を渡すと、明細の全体が置き換わり、売上の金額が計算し直されるので、残す明細も含める。取り消した売上の更新と、支払い状態が `pending` でない売上の `details` は 409 になる。`useSaleCrudVoidSale` の本文は `voidReason` だけで（null でもよいが、キーは必須）、取り消し済みの売上と、返金していない支払いがある売上は 409 になる。取り消しは、元に戻せない（[売上台帳](./sales.md)）。`useSaleCrudProcess` は、受け取った支払いを記録する（本文は `paymentMethodId`、`amount`、`cardLastFour`、`cardBrand` で、どのキーも必須。カードの 2 項目は、支払い方法の区分が `credit_card` か `debit_card` でなければ null）。決済代行会社とは接続していないので、お金を受け取ってから呼ぶ。分けて支払うときは、もう一度呼ぶ。`amount` が未払い残額を超えると 400、取り消した売上、返金のある売上、未払い残額のない売上は 409 になる。レスポンスは決済取引（`PaymentResponse`）なので、売上の `paymentStatus` と `payments` は、売上を読み直して表示する。`endpoints/payments/payments.ts` の `usePaymentCrudRefund` は、`completed` の決済取引を 1 回だけ返金する（本文は `refundAmount` と `refundReason` で、どちらのキーも必須）。`staff` では 403、`completed` でない決済取引（返金済みを含む）は 409 になる（[支払い](./payments.md)）。`useSaleCrudGetReceipt` は、売上のレシートを返す（`receiptNumber` は売上番号、`sale` は 1 件の取得と同じ売上、`issuedAt` は作った時刻）。レシートは保存されないので、印刷し直すときも、もう一度呼ぶ。取り消した売上と、受け取った金額が合計金額に達していない売上は 409 になる。`useSaleCrudCalculate` は、売上を入れる前に金額を計算する（本文は `salonId`、`bookingId`（予約がなければ null）、`services`（加えるサービスの ID。加える数だけ書く）で、どのキーも必須）。何も書かない。`breakdown` は売上と同じ名前の金額（`subtotal`、`discountAmount`、`taxAmount`、`totalAmount`）、`recommendedMethods` は合計金額を 1 回で受け取れる支払い方法の種類である。サロンのものでない予約やサービスと、数える明細がないリクエストは 400 になる。売上の作成は、計算の結果と比べないので、作成には明細の金額を渡す（[売上台帳](./sales.md#金額の計算)）。`endpoints/sales-reports/sales-reports.ts` のフック（`useSalesReportCrudGet`、`useSalesReportCrudGetDaily`、`useSalesReportCrudGetByStaff`、`useSalesReportCrudGetByCategory`、`useSalesReportCrudGetTrends`、`useSalesReportCrudExport`）は、すべて使える。使えるのは `admin` と、サロンの `owner`・`manager` で、`staff` は 403 になる。クエリの `salonId` と期間（`startDate`、`endDate`。`YYYY-MM-DD`。両方とも必須で、366 日まで）に既定値はないので、「今月」などは、サロンのタイムゾーンの日付にして渡す。存在しないサロンは 400（`salonId` の `not_found`）になる。`percentage` は小数第 1 位までで、行の合計が 100 にならないことがある（[売上レポート](./sales-reports.md)）。`salesReportCrudExport` は、期間の売上の CSV を、文字列のまま `data` に返す（`fetcher` は、JSON でない本文を文字列で返す）。ダウンロードさせるには、`new Blob([data], { type: 'text/csv' })` にして、`Content-Disposition` の名前（`sales-report-<startDate>-<endDate>.csv`）を付ける。サーバーは、ファイルを保存しない。`endpoints/points/points.ts` のフック（`usePointCrudGetBalance`、`usePointCrudListTransactions`、`usePointCrudGetExpiring`、`usePointCrudEarn`、`usePointCrudUse`、`usePointCrudAdjust`、`usePointCrudExpire`）は、すべて使える。使えるのは `admin` と、どのサロンの `owner`・`manager`・`staff` も（調整は `staff` には 403、失効は `admin` のほかは 403）で、顧客のアカウントは 403 になる。`usePointCrudGetExpiring` は、有効期限が今日（UTC）から `days` 日後（既定は 30、1〜365）までの、使われずに残っているポイントを返し、期限を過ぎて、まだ失効させていないものも含む。残高は、顧客のプロフィール（`/api/v1/customers/me`）の `loyaltyPoints` でも読める。付与と利用は、会計を記録したあとで、その売上を `referenceType: 'sale'` と `referenceId` で参照して送る。同じ記録への 2 回目の付与と利用、取り消した売上、残高を超える利用は 409 になる（[ポイント台帳](./points.md)）
- `endpoints/payment-methods/payment-methods.ts` の 5 つのフック（`usePaymentMethodCrudList`、`usePaymentMethodCrudCreate`、`usePaymentMethodCrudGet`、`usePaymentMethodCrudUpdate`、`usePaymentMethodCrudDelete`）は、サーバーに実装がある。サロンが受け付ける支払い方法の設定で、どれも、パスに `salonId` を渡す。読む 2 つは、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる（顧客に見せる支払い方法の一覧は、まだない）。作成には、すべてのキーを渡す（値がないものは null）。更新には、変える項目だけを渡す。`method` は、作成のあとで変えられず、更新に渡すと 400 になる。`minimumAmount` が `maximumAmount` より大きくなる作成と更新は 400 で、片方だけを渡した更新では、渡した項目の `errors` になる。削除の 409 は、その支払い方法を指す支払いがあることを表す。画面は、削除の代わりに、`isActive` を false にする更新を勧める。一覧は `sortOrder` の順で、使っていないものも含む。使っているものだけを読むには、`isActive: true` を渡す（[支払い](./payments.md)）
- `endpoints/products/products.ts` の 5 つのフック（`useProductCrudList`、`useProductCrudCreate`、`useProductCrudGet`、`useProductCrudUpdate`、`useProductCrudDelete`）は、サーバーに実装がある。サロンの商品で、どれも、パスに `salonId` を渡す。読む 2 つは、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる。作成には、すべてのキーを渡す（値がないものは null）。更新には、変える項目だけを渡す。在庫の水準が `minimumStock` ≦ `reorderPoint` ≦ `maximumStock` の順に並ばない作成と更新は 400 で、片方だけを渡した更新では、保存されている水準と比べ、渡した項目の `errors` になる。商品コードが、そのサロンの削除されていない商品と重なると 409 になる。削除の 409 は、その商品に在庫のレコードがあることを表す。画面は、削除の代わりに、`isActive` を false にする更新を勧める。一覧は `productCode` の順で、取り扱いをやめたものも含む（[商品](./products.md)）
- `endpoints/reviews/reviews.ts` のフックのうち、サーバーに実装があるのは、`useReviewCrudList`、`useReviewCrudGet`、`useReviewCrudCreate`、`useReviewCrudUpdate`、`useReviewCrudDelete`、`useReviewCrudMarkHelpful`、`useReviewCrudReport`、`useReviewCrudRespond`、`useReviewReportCrudList`、`useReviewReportCrudDismiss`、`useSalonReviewSummaryGetSummary`、`useStaffReviewSummaryGetStaffSummary` の 12 個である。読む 4 つは、認証なしで呼べるので、サロンを選ぶ画面に使える。サロンのレビューは `useReviewCrudList({ salonId })` で読み、並び順は `sortBy`（`recent`、`rating`、`helpful`）で選ぶ。集計の `ratingDistribution` は、キー `"1"`〜`"5"` を 0 件でも必ず含むので、そのまま棒グラフにできる。`averageRating` は小数第 2 位までで、サロンの `rating` と同じ値になる。`useReviewCrudCreate` には、ロール `customer` で、顧客のプロフィールがあるアカウントのアクセストークンが要り、`admin` とサロンのメンバーは 403 になる。本文の `customerId` には自分の顧客 ID を、`bookingId` には、ステータスが `completed` の自分の予約を、`salonId` には、その予約のサロンを渡す。`staffId` は、その予約を担当したスタッフか null で、null なら `staffRating` も null にする。画像がなければ `imageUrls` は空の配列にする（null は 400）。済んでいない予約と、レビューがすでにある予約は 409 になるので、画面は、自分の予約のうち `completed` のものだけに投稿の操作を出す。`useReviewCrudUpdate` は、レビューを書いた顧客のアカウントだけが呼べ、変える項目だけを送る（空の本文は 400）。`staffId` が null のレビューに `staffRating` を送ると 400 になる。`useReviewCrudDelete` は、書いた顧客のアカウントと `admin` が呼べ、サロンのメンバーは 403 になるので、サロンの画面には削除の操作を出さない。`useReviewCrudMarkHelpful` は、顧客のプロフィールがあるアカウントだけが呼べ、自分のレビュー、`admin`、サロンのメンバーは 403 になるので、ほかの顧客のレビューにだけ操作を出す。1 人 1 回で、2 回目は数を変えずに 200 で今の `helpfulCount` を返すので、何度押されても、返った数を表示すればよい。取り消しはない。`useReviewCrudReport` は、顧客のプロフィールがあるアカウント（ほかの顧客のレビュー）と、サロンの `owner`・`manager`（自分のサロンのレビュー）が呼べ、`admin`、`staff`、自分のレビュー、ほかのサロンのレビューは 403 になる。`reason` は一覧の値から選ばせ、`other` のときは `details` を必須にする（null は 400）。1 つのアカウントで 1 回だけで、2 回目は、却下のあとも 409 なので、409 は「通報済み」と表示する。通報しても、レビューは変わらない。`useReviewCrudRespond` で返信を書けるのは、レビューのサロンの `owner`・`manager` だけで、`staff`、顧客、ほかのサロンは 403 になるので、サロンの管理画面で、自分のサロンのレビューにだけ返信の操作を出す。`ownerResponse` に null を送ると返信を取り下げ、`admin` は取り下げだけができる（文字列は 403）。同じ返信をもう一度送っても、`ownerRespondedAt` は変わらない。`useReviewReportCrudList` と `useReviewReportCrudDismiss` は `admin` だけが呼べ、ほかのアカウントは 403 になる。一覧は古い順で、`status=pending` で未処理の通報を読む。規則に反するレビューは `useReviewCrudDelete` で削除し、その通報も消える（[レビュー](./reviews.md)）
- `endpoints/inventory/inventory.ts` のうち、在庫の行の 7 つのフック（`useInventoryCrudList`、`useInventoryCrudCreate`、`useInventoryCrudGet`、`useInventoryCrudUpdate`、`useInventoryCrudDelete`、`useInventoryCrudListLowStock`、`useInventoryCrudListExpiring`）は、サーバーに実装がある。読む 4 つは、`admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる。作成には、すべてのキーを渡す（値がないものは null）。在庫の数は渡せず、作成した行の数は 0 になる。ロットで分ける商品（`requiresLotTracking`）はロット番号を、分けない商品は null を渡し、合わなければ 400 になる。同じ商品の同じロット（ロット番号のない行は 1 つまで）は 409 になる。削除の 409 は、在庫数が 0 でないことを表す。在庫僅少と期限切れ間近には `salonId` を渡す（[在庫](./inventory.md)）
- 在庫の移動の 2 つのフック（`useInventoryCrudRecordMovement`、`useInventoryCrudListMovements`）も、サーバーに実装がある。記録は、在庫を読める人が使えるが、`staff` の `adjustment`、`disposal`、`transfer` は 403 になる。`quantity` は、入庫が正、出庫が負で、区分に合わない符号は 400 になる。`adjustment` と `disposal` には `reason` を渡す。在庫が引き当てた数を下回るか、99,999,999.99 を超える記録は 409 になる。レスポンスは 200 で、`balanceAfter` が移動後の在庫数である。履歴は新しい順で、`startDate` と `endDate` には、レスポンスの `createdAt` をそのまま渡せる（[在庫の移動](./inventory.md#在庫の移動)）
- 棚卸しのフック（`useInventoryCrudPerformStockCount`）と在庫評価額のフック（`useInventoryCrudGetValueReport`）も、サーバーに実装がある。どちらも、`staff` には 403 になる。棚卸しは、数えた行だけを `items` に渡し、差のあった行の調整の在庫の移動と差を、`items` の順に返す。数えた数が引き当てた数を下回る行があると 409 で、何も書かない。在庫評価額は、カテゴリごとの評価額（円）と、在庫のある商品の数を返す（[棚卸し](./inventory.md#棚卸し)、[在庫評価額](./inventory.md#在庫評価額)）
- `endpoints/purchase-orders/purchase-orders.ts` のうち、6 つのフック（`usePurchaseOrderCrudList`、`usePurchaseOrderCrudCreate`、`usePurchaseOrderCrudGet`、`usePurchaseOrderCrudUpdate`、`usePurchaseOrderCrudApprove`、`usePurchaseOrderCrudCancel`）は、サーバーに実装がある。一覧、作成、取得、更新は、`admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、承認と取り消しは、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる。作成の明細には、在庫の行の ID、数量、単価、メモを渡す。商品の名前と金額は渡せず、サーバーが明細の金額、小計、合計を計算して返す。更新は、ステータスを 1 つだけ進める（`draft` → `pending`、`approved` → `ordered`、`ordered` → `shipped`）か、納品予定日とメモだけを書き、ほかのステータスへの更新は 409 になる。承認は `pending` の発注だけで、本文は要らない。取り消しには `cancellationReason` を渡す。`delivered` と `cancelled` の発注は、どれも 409 になる。入荷（`usePurchaseOrderCrudReceive`）は、`ordered` か `shipped` の発注に、届いた明細の在庫の行と数量を渡し、発注を `delivered` にして在庫を増やす。書かなかった明細は受け取らない。発注の提案（`usePurchaseOrderCrudListReorderSuggestions`）は、`salonId` のサロンで頼むとよい商品と数量を、商品ごとに返す。提案は商品を返すので、発注を作るときは、その商品の在庫の行を選んで渡す（[発注](./purchase-orders.md)）
- `endpoints/inventory-alerts/inventory-alerts.ts` の 3 つのフック（`useInventoryAlertCrudList`、`useInventoryAlertCrudAcknowledge`、`useInventoryAlertCrudGetSummary`）も、サーバーに実装がある。どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。一覧と件数には `salonId` を渡す。アラートには ID がなく、確認には、種類（`alert`）、商品の ID、在庫の行の ID（商品のアラートでは null）、メモを渡す。今出ていないアラートは 404、確認がまだ効いているアラートは 409 になる。確認は、在庫が補充されたあとにまた減るなど、状態が変わると効かなくなるので、画面は、一覧の `acknowledgement` が null のアラートを、まだ誰も見ていないものとして表示する（[在庫のアラート](./inventory-alerts.md)）
- `endpoints/treatments/treatments.ts` の 8 つのフック（`useTreatmentRecordCrudList`、`useTreatmentRecordCrudCreate`、`useTreatmentRecordCrudGet`、`useTreatmentRecordCrudUpdate`、`useTreatmentRecordCrudDelete`、`useTreatmentRecordCrudAddPhotos`、`useTreatmentRecordCrudRemovePhoto`、`useTreatmentRecordCrudGetStatistics`）は、どれもサーバーに実装がある。どれも `admin` か、予約のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、削除は `staff` では 403、顧客のアカウントでは、自分の来店の記録も含めて、どれも 403 になる。作成には、すべてのプロパティを渡し、書かない項目は null か空配列にする。施術中か完了でない予約と、施術記録がすでにある予約は 409 になる。更新には変える項目だけを渡し、`materials` は一覧全体を置き換える。写真は保存先の URL で、施術記録 1 件に 20 枚まで、同じ URL は 1 枚。公開する写真には顧客の同意が要る。統計には `salonId` が必須（[施術記録](./treatments.md)）
- `endpoints/medical-charts/medical-charts.ts` のうち、4 つのフック（`useMedicalChartCrudList`、`useMedicalChartCrudCreate`、`useMedicalChartCrudGetByCustomer`、`useMedicalChartCrudUpdate`）は、サーバーに実装がある。どれも `admin` か、どのサロンの `owner`・`manager`・`staff` のアクセストークンでも使え、顧客のアカウントでは、自分のカルテも含めて 403 になる。カルテは顧客の ID で読み、カルテの ID で更新する。作成には、すべてのプロパティを渡し、書かない項目は null か空配列にする。カルテのある顧客は 409 になる。顧客のアレルギーの 4 つ（`useMedicalChartCrudListAllergies`、`useMedicalChartCrudAddAllergy`、`useMedicalChartCrudUpdateAllergy`、`useMedicalChartCrudRemoveAllergy`）にも実装がある。追加は、顧客がすでに持つアレルゲンなら 409 になり、削除は `staff` では 403 になる（[カルテ](./medical-charts.md)）
- `endpoints/attachments/attachments.ts` のうち、添付ファイルの 7 つのフック（`useAttachmentCrudGetUploadUrl`、`useAttachmentCrudComplete`、`useAttachmentCrudList`、`useAttachmentCrudGet`、`useAttachmentCrudGetDownloadUrl`、`useAttachmentCrudDelete`、`useAttachmentCrudPurge`）は、サーバーに実装がある。どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる（削除は、`staff` では自分がアップロードしたものだけ。掃除は `admin` だけ）。**ファイルの中身は、フックでは送らない**。`useAttachmentCrudGetUploadUrl` に名前・種類・サイズ・サロンを渡し、返ってきた `uploadUrl` に、`uploadHeaders` のヘッダーをそのまま付けて、ファイルを `fetch` の `PUT` で送る（送り先はストレージなので、`customInstance` は使わず、`Authorization` ヘッダーも付けない）。そのあと `useAttachmentCrudComplete` を呼ぶ。409 は、ファイルがまだ届いていない（もう一度呼べる）か、申告と違うファイルだった（添付ファイルは削除されるので、発行からやり直す）かで、`detail` で区別する。表示とダウンロードには、`useAttachmentCrudGetDownloadUrl(id, { inline })` の `downloadUrl` を使う。5 分で切れるので、保存せず、使う直前に取得する（[添付ファイル](./attachments.md)）
- `endpoints/attachments/attachments.ts` の共有リンクの 4 つのフック（`useShareLinkCrudCreate`、`useShareLinkCrudList`、`useShareLinkCrudGet`、`useShareLinkCrudDelete`）も、サーバーに実装がある。`admin` か、添付ファイルのサロンの `owner`・`manager` のアクセストークンが必要で、`staff` と顧客のアカウントでは 403 になる。**トークンは、発行の応答（`data.token`）にだけある**。一覧や取得では得られないので、発行した画面で閲覧者に渡す。`endpoints/share/share.ts` の 2 つのフック（`useSharedFileCrudGet`、`useSharedFileCrudGetDownloadUrl`）は、認証なしで呼べる。どちらも `POST`（ミューテーション）で、トークンとパスワードを本文で渡す（`password` は、保護されていなければ null）。保護された共有リンクで、パスワードがないか違うと 403（`password-required`）、開けないトークンは、理由によらず 404 になる。画面の URL でトークンを受け取るときは、フラグメント（`#` のあと）を使う。portal-app の `/share#token=<トークン>` が、そうして受け取る（[共有リンク](./attachments.md#共有リンク)）。`endpoints/services/services.ts` のフックは、カテゴリーのもの（`useServiceCategoryCrudList` など）も、サービスのもの（`useServiceCrudList` など）も、サーバーに実装がある
- `endpoints/customers/customers.ts` のフックには、すべてサーバーの実装がある。一覧、登録、1 件の取得、更新、削除の 5 つ（`useCustomerCrudList`、`useCustomerCrudCreate`、`useCustomerCrudGet`、`useCustomerCrudUpdate`、`useCustomerCrudDelete`）は、どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要である（削除は `staff` を除く）。サインインしていなければ 401 が返る。顧客本人のプロフィールの 3 つ（`useCustomerProfileGet`、`useCustomerProfileCreate`、`useCustomerProfileUpdate`）にも実装があり、ロール `customer` のアクセストークンが必要である。一括の操作の 4 つ（`useCustomerCrudBatchGet`、`useCustomerCrudBulkCreate`、`useCustomerCrudBulkUpdate`、`useCustomerCrudBulkDelete`）にも実装があり、どれも 100 件までを、すべてか何もしないかで扱う（一括削除は `staff` を除く。[一括の操作](./customers.md#一括の操作)）。統計の `useCustomerCrudGetStatistics(id, { salonId, startDate, endDate })` にも実装があり、`admin` か、`salonId` のサロンの `owner`・`manager`・`staff` のアクセストークンが必要である（[顧客台帳](./customers.md#統計)）。変更履歴の `useCustomerCrudGetHistory(id, { limit, cursor })`、版の `useCustomerCrudGetVersion(id, version)`、復元の `useCustomerCrudRestore`、統合の `useCustomerCrudMerge`、台帳の CSV 出力の `useCustomerCrudExport`、顧客のデータの出力の `useCustomerCrudExportData`、削除の依頼の受け付け・確認・取り消しの `useCustomerCrudRequestDeletion`、`useCustomerCrudGetDeletionRequest`、`useCustomerCrudCancelDeletionRequest` にも実装があり、`admin` か、サロンの `owner`・`manager` のアクセストークンが必要である。消去の実行の `useCustomerCrudExecuteDeletionRequests` は、`admin` のアクセストークンが必要である（[削除の依頼](./customers.md#削除の依頼)）。削除した顧客の変更履歴と版も読める（[顧客台帳](./customers.md#変更履歴と版)）。好み設定の 4 つにも実装がある。台帳を扱うユーザーのための `useCustomerCrudGetPreferences(id)` と `useCustomerCrudUpdatePreferences`、顧客本人のための `useCustomerProfileGetPreferences` と `useCustomerProfileUpdatePreferences`（引数に ID はなく、どの顧客かはトークンが決める）である。何も設定していない顧客にも、200 で空の好み設定（一覧は `[]`、ほかは null）が返るので、404 を「未設定」として扱わない。台帳のフックの 404 は顧客がいないことを、本人のフックの 404 はプロフィールをまだ作っていないことを表す。更新には変える項目だけを渡し、`stylePreferences` は 4 項目をまとめて渡す。保存されているスタッフの ID は、そのスタッフが削除されても残るので、画面は、スタッフのプロフィール（`useStaffProfileGet`）が 404 のスタッフを表示しない
- `endpoints/staff/staff.ts` のフックのうち、サーバーに実装があるのは、台帳の一覧、登録、1 件の取得、更新、削除の 5 つ（`useStaffCrudList`、`useStaffCrudCreate`、`useStaffCrudGet`、`useStaffCrudUpdate`、`useStaffCrudDelete`）、勤務スケジュールの一覧と更新の 2 つ（`useStaffSchedulesList`、`useStaffSchedulesUpdate`）、招待の取得、作成、取り消しの 3 つ（`useStaffInvitationsGet`、`useStaffInvitationsCreate`、`useStaffInvitationsDelete`）、アカウントの取得、ロールの変更、紐づけの解除の 3 つ（`useStaffAccountsGet`、`useStaffAccountsUpdate`、`useStaffAccountsDelete`）、プロフィールの一覧と 1 件の取得の 2 つ（`useStaffProfileList`、`useStaffProfileGet`）、本人のプロフィールの取得と更新の 2 つ（`useStaffOwnProfileGet`、`useStaffOwnProfileUpdate`）で、このファイルのフックのすべてである。台帳の 5 つは、どれも `admin` か、そのサロンの `owner` のアクセストークンが必要で、レスポンスは給与と個人の連絡先を含むので、顧客に見せる画面には使わない。顧客に見せる画面は、認証なしで呼べるプロフィールの 2 つを使う。1 つのサロンのスタッフは `useStaffProfileList({ salonId })` で読む。本人のプロフィールの 2 つは、サロンに届く `owner`・`manager`・`staff` のアクセストークンが必要で、どのスタッフかはトークンが決める（引数に ID はない）。`useStaffOwnProfileUpdate` には、変える項目だけを渡す。渡せるのは `specialties`、`bio`、`imageUrl`、`yearsOfExperience`、`certifications` の 5 つで、`displayName` などの台帳の項目を渡すと 400 になる。レスポンスの `links.profile` は、顧客が同じプロフィールを読むパスである。勤務スケジュールの 2 つは、`admin` か、そのサロンの `owner`・`manager` のアクセストークンが必要で、`staff` は自分のスケジュールだけを `useStaffSchedulesList` で読める。`useStaffSchedulesUpdate` は、送った配列でスケジュール全体を置き換えるので、1 行だけを変える画面も、読んだ全体に変更を加えて送る（読んだ `data` は、そのまま本文にできる）。`useStaffSchedulesList(salonId, id, { date })` は、その日付に適用される行だけを返し、`data` は 0 個か 1 個である。スケジュールは顧客に見せる画面には使わない。招待の 3 つは、台帳と同じく `admin` か、そのサロンの `owner` のアクセストークンが必要である。`useStaffInvitationsCreate` は、スタッフに、ログインアカウントを作るためのリンクをメールで送る（本文はアカウントのロールだけで、宛先は台帳のメールアドレス）。`useStaffInvitationsGet` の 404 は、スタッフが招待を持っていないことを表す。招待されたスタッフがリンクから開く画面（`/accept-staff-invitation`）は、URL のフラグメントからトークンを取り出し、`endpoints/authentication/authentication.ts` の `useAuthCrudVerifyStaffInvitation` で招待の内容（宛先とロール）を表示する。次に何をするかは、そのレスポンスの `links` で決める。`links.accept` があれば、パスワードを尋ねて、`useAuthCrudAcceptStaffInvitation` でトークンと新しいパスワードを送る。どちらもアクセストークンは要らない。受け入れのあと、スタッフは、招待の宛先のメールアドレスとそのパスワードでログインする。`links.join` があれば、その宛先のスタッフのアカウントがすでにあるので、パスワードは尋ねず、そのアカウントでのログインを求めてから、`useAuthCrudJoinStaffInvitation` でトークンを送る（アクセストークンが要る）。参加のあと、同じアクセストークンのまま、新しいサロンの画面を開ける。409 は、ログインしているアカウントがすでにサロンに属しているか、招待の宛先と違うメールアドレスのアカウントであることを表す（`detail` で区別する）。アカウントの 3 つは、台帳と同じく `admin` か、そのサロンの `owner` のアクセストークンが必要である。`useStaffAccountsGet` の 404 は、スタッフにアカウントがないことを表す（まだ招待を受け入れていないか、紐づけを解除した）。`useStaffAccountsUpdate` の本文はロールだけで、`owner` を指定できるのは `admin` である。`useStaffAccountsDelete` は、アカウントを消さずに、スタッフとの紐づけだけを外す。ロールの変更と紐づけの解除は、そのアカウントの次のリクエストから効くので、操作した側の画面は、アカウントを読み直して表示する

## UI とテストの規則

スタイルは CSS Modules で書き、色や余白はデザイントークンから取り、レイアウトは CSS Grid で組みます（flex は使いません）。複数のアプリが使うコンポーネントは `ui` パッケージに置き、状態ごとにストーリーを書いて、そのストーリーからテストします。

規則と手順は、次の 2 つのスキルにあります。`frontend/` 以下を変更する前に読みます。

- [frontend-ui](../.claude/skills/frontend-ui/SKILL.md): トークン、CSS Modules、Grid によるレイアウト、コンポーネントの作り方、フォームの部品と画面の骨組みの部品の使い方、API を読む画面の作り方
- [frontend-testing](../.claude/skills/frontend-testing/SKILL.md): ストーリーからのテスト、アクセシビリティの検査、Vitest の設定

検査できる規則は `theme` パッケージの `src/style-rules.ts` が検査するので、違反はテストの失敗になります。カタログは `pnpm --filter @beauty-salon-frontend/ui run storybook` で起動します（`http://localhost:6006`）。

## テスト

フロントエンドのテストは Vitest です（`pnpm test:frontend`）。パッケージをまたぐ import はソースから解決するので（エクスポート条件 `@beauty-salon-frontend/source`）、ビルドなしで実行できます。`io`、`api-client`、`session` のテストも jsdom で実行します（セッションを `localStorage` に置くため）。

- `ui` のコンポーネント: ストーリー（`*.stories.tsx`）を `composeStories` で読み込み、jsdom に描画して検証する（`*.test.tsx`）。どのストーリーにも、アクセシビリティの検査（axe-core、WCAG 2.2 AA）がある
- 各アプリの `src/App.test.tsx`: `MemoryRouter` で枠を描画し、サインインしていない人に見えるもの（admin-app と dashboard-app ではサインインの画面、portal-app では、存在しないパスのページと `/sign-in`。トップページは API を読むので、結合テストにある）、共有コンポーネントのリンクがページを読み込み直さずに移動すること、アクセシビリティを検証する。API は呼ばない
- `theme` の `src/style-rules.test.ts`: すべてのパッケージとアプリのスタイルシートとコンポーネントが、スタイルの規則を守っていることを検証する。`src/tokens.test.ts`: 文字と背景、コントロールの縁に使う色のトークンの組が、必要なコントラスト比を満たすことを検証する
- `config` と `testing` の各パッケージ: モジュールの隣に `*.test.ts`
- `io` の `src/libs/fetcher/fetcher.test.ts`: `customInstance` を、スタブにした `fetch` に対して検証する（URL、本文、ステータスごとの戻り値、problem details、reject する条件）。`fetcher.session.test.ts`: セッションがあるときの動作（トークンを付けること、期限切れのあとの再発行と送り直しが 1 回ずつであること、同時のリクエストで再発行が 1 回であること、ほかのタブが先に替えたセッションを通信せずに使うこと、断られた再発行と失敗した再発行の違い）。`src/libs/session/stored-session.test.ts`: 保存、購読、ほかのタブからの変更
- `api-client` の `src/salons.test.ts`: 生成された Salon の関数を、実際の `customInstance` を通して検証する（リクエストの形、ステータスごとに型が絞られること、通信の失敗、TanStack Query との組み合わせ）。`src/session.test.ts`: `io` が持つ再発行のパスとエラーコードが、生成されたものと同じであること
- `session` の `src/session.test.tsx`: `useSession` を `renderHook` で描画し、`signIn`、`signOut`、`keepQueriesOfOneUser` と一緒に、実際の生成クライアントと `customInstance` を通して、スタブにした `fetch` に対して検証する。`src/components/` の部品（`SignInForm`、`SessionGate`、`AccountMenu`）は、`ui` と同じく、ストーリーから検証する。`sign-in-screen/sign-in-flow.test.ts`: フォームの値の確かめと、API の応答ごとのフォームの状態
- `session` の `src/security/`: 純粋な関数のテスト（`password-rule.test.ts`: 選ぶパスワードの規則。`security-flow.test.ts`: 変更のフォームの値の確かめ、API の応答ごとの表示、一覧のページの組み立て、サインアウトさせた端末を除くこと。`security-format.test.ts`: 日時と端末の言葉）、`security-api.test.ts`（実際の API では起こせない応答、送るパラメーター、続きの起点が断られたとき、すべての端末でのサインアウトでブラウザーのセッションを消すこと）。`components/` の部品は、ストーリーから検証する
- portal-app の `src/account/`: `account-flow.test.ts`（フォームの値の確かめと、API が断った値ごとの表示）、`mailed-token.test.tsx`（フラグメントのトークンと、同じタブで開いた後のリンクのトークン）、`account-api.test.ts`（実際の API では起こせない応答（429、500、応答なし）と、どのオペレーションも応答を同じように読むことを、スタブにした `fetch` に対して検証する）
- portal-app の `src/salons/`: 純粋な関数のテスト（`salon-search.test.ts`: 検索条件とアドレス。`salon-format.test.ts`: 日付、時刻、金額、営業時間の表示。`salon-menu.test.ts`: メニューの組み立てと料金。`pages.test.ts`: 一覧のページ）、`salons-api.test.ts`（実際の API では起こせない応答、送るパラメーター、一覧を最後まで読むことを、スタブにした `fetch` に対して検証する）。`components/` の部品は、`ui` と同じく、ストーリーから検証する。スタッフごとの評価をひとまとまりで読むこと（1 人ぶんでも読めなければ、どれも渡さないこと、見つからない人には評価がないこと）と、いくつかを読む部分が、読めなかったわけを 1 つにする `whyUnread` のテストも、`salons-api.test.ts` にある。レビューを名前で示す `postedOf` のテストは、`salon-format.test.ts` にある
- portal-app の `src/bookings/`: 純粋な関数のテスト（`booking-choice.test.ts`: アドレスにあるスタッフと日付、選べるスタッフ、時刻の表示。`booking-flow.test.ts`: フォームの値の確かめと、API の応答ごとの表示。`booking-format.test.ts`: 状態、日時、料金の表示）、`own-bookings.test.ts`（一覧のアドレス、API に渡す日付の範囲、キャンセルと日時の変更ができる予約、名前のそろった行と、その続き）、`bookings-api.test.ts`（実際の API では起こせない応答、送るパラメーター、空き枠を最後まで読むこと）。`components/` の部品（`BookingForm`、`BookingSummary`、`BookingList`、`BookingChanges`）は、ストーリーから検証する。`src/navigation.test.ts` は、ヘッダーのリンク（ロールごとに出るもの、どの画面でどれが現在の画面か）
- portal-app の `src/profile/`: 純粋な関数のテスト（`profile-flow.test.ts`: フォームの値の確かめ、開いたときと違う項目だけのリクエスト、API の応答ごとの表示。`profile-format.test.ts`: 会員ランク、日付、ポイント、住所の行、値のない項目の言葉）、`profile-api.test.ts`（実際の API では起こせない応答、断られた値、送るもの）。`components/` の部品（`MembershipDetails`、`ProfileDetails`、`ProfileForm`）は、ストーリーから検証する。API の関数のテストが使う、作った応答は、`src/__tests__/api-answers.ts` にある
- portal-app の `src/preferences/`: 純粋な関数のテスト（`preferences-flow.test.ts`: フォームの値の確かめ、時間帯の行の読み方、開いたときと違う項目だけのリクエスト、API の応答ごとの表示。`staff-choices.test.ts`: 選べるスタッフの並びと表示。`preferences-format.test.ts`: 時間帯とスタッフの言葉）、`preferences-api.test.ts`（読むものの順、どれかが読めなかったとき、実際の API では起こせない応答、断られた値、送るもの）。予約のあるサロンを求める `readBookedSalonIds` のテストは、`src/bookings/bookings-api.test.ts` にある。`components/` の部品（`PreferencesDetails`、`PreferencesForm`、`TimeSlotFields`）は、ストーリーから検証する。行を足したとき、消したときのフォーカスと、消したあとに誤りを出さないことは、`time-slot-fields.test.tsx` にある。1 行に 1 つずつ書く欄の読み方と、画像の URL の確かめ（`src/lines.ts`。レビューのフォームも使う）のテストは、`src/lines.test.ts` にある
- admin-app: 純粋な関数のテスト（`src/navigation.test.ts`: ヘッダーのリンク。`src/bookings/booking-day.test.ts`: 一覧の条件とアドレス。`src/bookings/booking-format.test.ts`: 状態、時刻。`src/bookings/day-bookings.test.ts`: 名前の引き方と行。`src/bookings/booking-actions.test.ts`: 状態ごとのボタン、無断キャンセルを出す時刻、完了とキャンセルのフォームの値、API の応答ごとの表示）、`src/salons/salons-api.test.ts`、`src/customers/customers-api.test.ts`、`src/bookings/bookings-api.test.ts`（実際の API では起こせない応答、送るパラメーター、一括取得を断られたときに 1 人ずつ読むこと）。`components/` の部品は、ストーリーから検証する。`salon-screens` の `salon-time.test.ts`（サロンのタイムゾーンでの今日、前後の日、時刻、入力した日時を UTC にすること、時計が飛ばす時刻）、`keyword.test.ts`、`salons-api.test.ts`、`salon-choice.test.ts`（サロンを探すキーワードとアドレス）、`period.test.ts`（集計する期間とアドレス）、`format.test.ts`（金額、支払い方法とメニューの区分の言葉）、`PagedTable`、`KeywordSearch`、`SalonChoices`、`StatisticsPeriod` のストーリーとそのテスト。`session` の `src/salon/own-salon.test.ts` は、所属するサロンを読む関数と、ロールごとの答え
- admin-app の `src/sales/`: 純粋な関数のテスト（`checkout.test.ts`: 会計を入れられる状態、予約の売上、会計の明細、消費税の分け方（割合、切り捨て、残りの円、税込の明細、合計 0）、計算と明細が合うか、計算できない理由、フォームの値と送る本文、API の応答ごとの表示。`payments.test.ts`: 使っている支払い方法とその順、1 回に受け付ける金額の言葉、金額とカードの項目の読み取り（全角の数字）、API の応答ごとの表示。`sale-format.test.ts`: 支払い状態と支払い方法の言葉、カード、受け取った金額、返金、未払い残額、支払いとレシートを出せない理由。`sales-ledger.test.ts`: 売上台帳の条件とアドレス）、`sales-api.test.ts`（実際の API では起こせない応答、送るパラメーター、予約の売上を最後まで読むこと、409 のあとに読み直すこと）。`components/` の部品は、ストーリーから検証する
- portal-app の `src/reviews/`: 純粋な関数のテスト（`review-flow.test.ts`: フォームの値の確かめ、開いたときと違う項目だけのリクエスト、API の応答ごとの表示、来店そのものについて断られたかどうか。`review-staff.test.ts`: 評価できるスタッフと、その順。`review-format.test.ts`: 一覧の言葉）、`reviews-api.test.ts`（読むものの順、どれかが読めなかったとき、実際の API では起こせない応答、断られた値、送るもの、ほかの人のレビューを変更の画面に出さないこと）。`components/` の部品（`ReviewForm`、`OwnReviewList`、`ReviewRemoval`）と、`src/salons/components/` の `ReviewContent` は、ストーリーから検証する。サロンの詳細でレビューを読む人については、`reader-flow.test.ts`（だれにボタンを出すか、通報のフォームの値の確かめ、API の応答ごとの表示）、`review-cache.test.ts`（書いたあと、「参考になった」のあと、レビューが消えていたあとに、読んであった内容をどうするかを、実際の `QueryClient` で確かめる）、`reviews-api.test.ts` の `sayHelpful` と `reportReview`、部品の `ReviewReport`（`components/review-report/`）と、`src/salons/components/` の `ReviewList`、`StaffProfiles` のストーリー。サインインのあとの戻る先（`src/sign-in-path.ts`）のテストは、`src/sign-in-path.test.ts` にある
- portal-app の `src/share/`: `shared-file.test.ts`（種類とサイズの言い方、パスワードの欄の確かめ、API の応答ごとの表示）、`share-api.test.ts`（実際の API とストレージでは起こせない応答（429、500、413、415、応答なし、契約にない状態）、本文で送るトークンとパスワード、URL の発行が 1 回だけで、ファイルをストレージから API を通さずに読み、API が言った種類で持つこと、ストレージが返さなかったファイル）、`SharedFileRecord` のストーリーとそのテスト
- dashboard-app: 純粋な関数のテスト（`src/navigation.test.ts`: ヘッダーのリンク。`src/reports/sales-report.test.ts`: 件数、割合、順位の言葉と、CSV に出力したあとに言うこと。`src/reports/sales-trends.test.ts`: アドレスとフォームの区切り、12 か月、区切りの名前、目盛りの上端と額。`src/reports/daily-sales.test.ts`: アドレスとフォームの日、前後の日）、`src/reports/sales-report-api.test.ts`（実際の API では起こせない応答（429、500、応答なし、契約にない状態）、名前のないファイル、送る条件）、`src/reports/components/sales-report/sales-report.test.tsx`（ストーリーごとのアクセシビリティ、期間の合計の項目、表の行と行の見出し、空の表）、`trend-chart.test.tsx`、`sales-trend.test.tsx`、`daily-sales.test.tsx`、`day-choice.test.tsx`（ストーリーごとのアクセシビリティ。棒の高さ、目盛り、軸の名前、ポインターで出る額、支援技術から隠すこと。表の行。1 日の項目。フォームが渡す日と、アドレスに合わせる欄）

### 実際の API と DB を使うテスト（`pnpm test:integration`）

API を呼ぶコードは、`fetch` も API も差し替えずに、本番と同じアプリケーション（`createApp`）と PostgreSQL に対しても確かめます。ファイル名は `*.integration.test.ts(x)` です。

- テストの実行ごとに、バックエンドの**テスト用のサーバー**（`backend/packages/api/src/__tests__/test-server/`）が 1 つ起動します。スキーマとシードのデータ（`pnpm db:seed` と同じもの）を入れたテンプレートの DB を作り、テストファイルごとに、その複製を持つ API を、そのファイルだけのポートで起動します
- テスト対象のコードは、その API を呼びます（`VITE_BACKEND_BASE_URL` が、その API のオリジンになります）。テストが終わるたびに、API の DB は新しい複製に替わり、`localStorage` と `sessionStorage` は空になります
- テストは `testApi()`（`@beauty-salon-frontend/testing/api`）から、API のオリジン、シードのアカウントのパスワード、DB への SQL の実行、API が送ったメール（`mails()` と、ある宛先への最後のメールのリンクを返す `mailedLink(to)`）を使えます。メールは、どこにも配送されません。SQL は、画面からも API からも、テストの中では起こせないこと（トークンの期限が切れるだけの時間の経過、一覧の 2 ページ目に要るだけの行、API の失敗など）のためのものです
- PostgreSQL は、`TEST_DATABASE_URL` があればそれを、なければコンテナを使います（バックエンドの結合テストと同じ）

いまあるのは、次のものです。

- `session` の `src/session.integration.test.tsx`: サインイン、誤ったパスワード、期限切れのあとの再発行（同時のリクエストで 1 回）、再発行できないセッション、API で終わったセッション、サインアウト
- `session` の `src/sign-in.integration.test.tsx`: サインインの画面を、利用者と同じように操作する（入力して、ボタンを押す）。サインインして開こうとした画面が出ること、「サインインしたままにする」、誤ったパスワードと未登録のメールアドレス、空の欄と形の誤ったメールアドレスでは何も送らないこと、2 要素認証（認証アプリのコード、誤ったコードのあとのバックアップコード、空のコード、最初の段階へ戻る）、サインイン済みの人、ヘッダーからのサインアウト、ロールの合わないアカウント
- portal-app の `src/account/account.integration.test.tsx`: アカウントの画面を、メールのリンクから開いて操作する。登録と確認メールの再送、メールアドレスの確認、使用済みのリンクと期限切れのリンク、再設定の要求と新しいパスワードの設定、同じタブで開いた後のメールのリンク、招待の受け入れ（アカウントを作る）と参加（サインインして受ける）、参加できないアカウント、アカウントのあるメールアドレスへの招待、取り消された招待。リンクを開いただけでは API に何も送らないこと（または、確認だけを送ること）も確かめる
- portal-app の `src/salons/salons.integration.test.tsx`: サロンを探す画面（条件ごとの検索、アドレスにある条件、同じ検索の読み直し、予約を受け付けていないサロン、続きの表示とフォーカス）と、サロンの詳細の画面（営業時間、メニュー、スタッフ、レビューの各部分、並び順、続きのレビュー、何も登録していないサロン、存在しないサロン、削除されたサロン）。API の失敗は、応答を差し替えずに、DB で起こす（テーブルの名前を一時的に変える、など）。読めなかった知らせと、「もう一度読み込む」で読み直せることを確かめる
- portal-app の `src/bookings/bookings.integration.test.tsx`: 予約する画面（メニューのリンクから開くこと、サインインしていない人とほかのロール、スタッフと日付の選択とアドレス、空いている時刻、予約できる時刻のない日、時刻を選ばずに送ったとき、予約を入れて DB に書かれること、ほかの顧客が先に取った時刻（API を通して、実際に予約を入れる）、はじめての予約のお客様の情報、予約できないサービス、存在しないサービス）と、予約の内容の画面（表示、確定とキャンセルの状態、税別のサービスの料金、ほかの顧客の予約、存在しない予約、掲載を終えたサービスとスタッフ、読めなかったとき）。営業時間とスタッフの勤務は、今日から 14 日後の日付に、SQL で用意する
- portal-app の `src/bookings/own-bookings.integration.test.tsx`: ヘッダーのリンク（顧客、サインインしていない人、ほかのロール）、予約の一覧（これからの予約とこれまでの予約、DB の行と同じ内容と順であること、続きの表示とフォーカス、予約のないアカウント、読めなかったとき、名前を読めなかったとき、掲載を終えたサロン、予約を入れた直後に前の一覧が出ないこと）、キャンセル（できる予約とできない予約、ダイアログ、理由のあるときとないとき、DB に書かれること、サロンが先に予約を始めたとき（SQL で状態を変える）、送れなかったとき、予約がなくなっていたとき）、日時の変更（開いたときのスタッフと日付、空いている時刻、同じスタッフとほかのスタッフと指名なしでの変更、確定していた予約、時刻を選ばずに送ったとき、ほかの顧客が先に取った時刻、変更できない予約）。2 つのテストが共有する用意は、`src/bookings/__tests__/arrangements.ts` にある
- portal-app の `src/profile/profile.integration.test.tsx`: マイページ（DB の行と同じ内容であること、プロフィールのないアカウント、サインインしていない人とほかのロール、読めなかったとき、サロンが変えた内容が、読み直さずに出ないこと）と、お客様の情報のフォーム（いまの内容で開くこと、多くの項目の変更が DB に書かれること、変えた項目だけを送り、その間にサロンが書いた項目が残ること、何も変えずに送ったとき、誤った値では何も送らないこと、前に読んだ内容で開かないこと、開いている間に読み直さないこと、送れなかったときと 2 回目の試行、顧客が台帳から削除されていたときと、そのあとの登録、空のフォームからの登録、台帳にいる顧客の引き継ぎ、ほかで先に登録されていたとき）。API が値を断る応答は、画面からは起こせないので（フォームが、断られる値を送らない）、単体テストにある
- portal-app の `src/preferences/preferences.integration.test.tsx`: マイページの部分（何も書いていない顧客、スタッフがサロンの名前とともに出ること、サロンが公開しなくなったスタッフが出ないこと、この部分だけが読めなかったとき、プロフィールのないアカウント、サロンが変えた内容が、表示のたびに読まれること）と、好みの設定のフォーム（保存されている内容で開き、予約のあるサロンのスタッフを、API の順で出すこと、書いた内容が DB に書かれ、マイページにすぐ出ること、変えた項目だけを送り、その間にサロンが書いた項目が残ること、何も変えずに送ったとき、行を消して足したときの順、すべてを消したとき、誤った値では何も送らないこと、出せないスタッフが保存されたまま残ることと、欄を変えたときに置き換わること、サロンがその間に避けたいスタッフにした人を指名したとき、選んだスタッフがその間に削除されたとき、前に読んだ内容で開かないこと、開いている間に読み直さないこと、送れなかったときと 2 回目の試行、顧客が台帳から削除されていたとき、予約のない顧客のフォーム）。準備は、顧客やサロンが行うとおりに、API へのリクエストで行う。フォームが送る前に確かめる値を API が断る応答は、画面からは起こせないので、単体テストにある
- portal-app の `src/reviews/`: `review-writing.integration.test.tsx` は、予約の内容の画面の「レビュー」の部分（レビューのない来店、レビューのある来店、来店が済んでいない予約、この部分だけが読めなかったとき、掲載を終えたサロン、サロンの返信が、表示のたびに読まれること）と、レビューを書く画面（来店と、予約の担当を選んだ状態で開くこと、書いた内容が DB に書かれ、自分のレビューの一覧に出ること、評価だけのレビュー、スタッフを評価しないレビュー、担当のスタッフが掲載を終えている来店、担当が 2 人いた来店、誤った値では何も送らないこと、書けない来店のそれぞれ、その間にほかで投稿されたとき（API を通して、実際に投稿する）、選んだスタッフがその間に削除されたとき、送れなかったとき、開いている間に読み直さないこと、投稿したあとの一覧、予約の内容、サロンの詳細、サロンを探す画面の結果に、前の内容が出ないこと、もう一度開いたフォームが、前に読んだ来店の内容で開かないこと）。`own-reviews.integration.test.tsx` は、マイページのリンク、自分のレビューの一覧（DB の行と同じ内容と順であること、レビューのない顧客、プロフィールのないアカウント、続きの表示とフォーカス、読めなかったとき、サロンの返信）、削除（ダイアログ、「戻る」、DB の行がなくなること、残りのレビュー、送れなかったとき、すでに削除されていたとき、削除したあとの予約の内容の画面）、レビューを変更する画面（いまの内容で開くこと、変えた項目だけを送り、その間にほかで変えた項目が残ること、何も変えずに送ったとき、スタッフを評価していないレビュー、掲載を終えたスタッフ、長すぎるタイトル、ほかの人のレビュー、その間に削除されたとき、読めなかったとき、送れなかったとき、前に読んだ内容で開かないこと）。`review-screens.integration.test.tsx` は、3 つの画面それぞれの、サインインしていない人とほかのロール、ヘッダーのリンク、ドキュメントのタイトル。テストが共有する用意は、`__tests__/arrangements.tsx` にある
- portal-app の `src/reviews/review-readers.integration.test.tsx`: サロンの詳細でレビューを読む人。だれに何が出るか（サインインしていない人への案内と、そこからサインインして、同じページへ戻ること、ほかのサイトを指すアドレスでは、トップページへ移ること、サロンのスタッフと `admin`、プロフィールのないアカウント、自分のレビューのリンク、ボタンの名前）、「参考になった」（数と DB の行、押したあとに一覧を読み直さないこと、押されたボタンでは何も送らないこと、開き直したページでの 2 回目、「参考になった順」で並びが変わらず、次に選んだときに読み直すこと、ほかの並びを前の内容で出さないこと、その間に消えたレビューと、見出しへのフォーカス、送れなかったとき）、通報（理由ごとのリクエストと DB の行、「その他」と詳しい内容、誤った値では何も送らないこと、すでに通報していたとき（通報が却下されたあとも）、その間に消えたレビュー、送れなかったときに書いた内容が残ること、開き直したダイアログが空であること）、スタッフごとの評価（DB の集計と同じであること、レビューのないスタッフ、読めなかったときと読み直し、レビューを書いたあとに、前の評価を出さないこと）。その顧客が前にしたこと（評価、通報）は、API を通して作る。シードの通報は、どのアカウントのものかが、シードのたびに違う
- portal-app の `src/share/share.integration.test.tsx`: オーナーが API でストレージへアップロードして共有したファイルを、リンクから開く。パスワードのない共有リンク（ファイルの言葉、開いても数えないこと、アドレスから消えるトークン、読み込んで出す画像と見出しへのフォーカス、2 回の保存とその中身、1 回と数えること、同じタブで開いた別のリンク、サインインしている人）、パスワードのある共有リンク（ファイルの言葉を出さないこと、空のパスワード、違うパスワードとその回数、正しいパスワードで開いて読み込み、保存する PDF、ロックのあいだの正しいパスワード、開いたあとのロックでもう一度尋ねること）、開けない共有リンク（失効、期限切れ、回数の上限、ファイルの削除、パスワードを入れているあいだと開いたあとの失効、上限に達したあと開き直すこと、トークンのないアドレス）、ストレージにないファイル（数えたと言うことと、読み込み直しでもう 1 回数えること）、アクセシビリティ
- `session` の `src/security/security.integration.test.tsx`: アカウントの安全の画面（DB の行と同じ内容であること、最後に変更した日時、2 要素認証の設定の途中と有効）、端末（API でもう 1 つサインインしておき、新しい順に 2 つ出ること、「この端末」にボタンがないこと、ほかの端末のサインアウトと DB の行、見出しへのフォーカス、その間にサインアウトしていた端末、サインアウトさせたあと、いっぱいだったページが、その後ろの端末で埋まること、21 件目の続きとフォーカス、続きの起点がサインアウトしていたときの読み直し、すべての端末でのサインアウトとダイアログ、サインアウトを DB が断ったとき）、パスワードの変更（DB のハッシュと日時が変わり、ほかのセッションが消え、このセッションが残り、メールが送られ、新しいパスワードでサインインできること、現在のパスワードの誤りと、ロックへの数え、推測されやすいパスワード、短すぎるパスワードと現在と同じパスワードでは何も送らないこと、変更を DB が断ったとき）。DB が断る書き込みは、例外を出すトリガーで起こす（セッションを持つテーブルを取り除くと、リクエストのセッションも断られるため）
- `session` の `src/security/two-factor.integration.test.tsx`: 設定の画面（誤ったパスワードと、ロックへの数え、空のパスワードでは何も送らないこと、QR コードと、画面に出たキー（そのキーから計算したコードを API が受け付けること）、段階の見出しへのフォーカス、DB の状態、誤ったコード、6 桁でないコードでは何も送らないこと、認証アプリのコードで有効になり、DB の状態とメール、10 個のバックアップコードが出て、そのコードで 1 回だけサインインできること、すでに有効なアカウント、設定の途中のアカウントの新しいキー、その間にほかで有効になったとき、その間にリセットされたとき、DB が設定を断ったとき）と、アカウントの安全の画面の 2 要素認証（未設定と設定の途中のリンク、認証アプリのコードとバックアップコードでの発行し直しと、前のコードが使えなくなること、使ったことのあるバックアップコード、パスワードとバックアップコードでの無効化と、見出しへのフォーカス、DB の状態とメール、誤ったパスワードと誤ったコード、その間にほかで無効になったとき、DB が発行し直しを断ったとき）。コードは `testApi().authenticatorCode(secret)` で得る。API は、同じ 30 秒のコードを 1 回しか受け付けないので、2 つ目は次の 30 秒のコード（`stepsAhead: 1`）か、バックアップコードを使う
- portal-app の `src/security/security.integration.test.tsx`: サインインしていない人とスタッフのアカウント（2 要素認証の設定の画面も）、マイページのカードからの行き来、アカウントの安全の画面から 2 要素認証の設定の画面への行き来、プロフィールのないアカウントのカード、パスワードを変えてアカウントの安全の画面に戻り、前に読んだ内容（変更していないこと、2 台の端末）を出さずに、変更した日時と、残った 1 台が出ること、「やめる」
- admin-app の `src/bookings/day-bookings.integration.test.tsx`: 始まりの画面（ロールごとに、所属するサロンのその日の一覧へ移ることと、見出しへのフォーカス、`admin` のサロンを選ぶ画面とキーワード、どのサロンにも属していないアカウント、ほかのサロンのアドレス、存在しないサロン）と、その日の一覧（DB の行と同じ内容、名前、時刻、開始の順、ほかのサロンとほかの日の予約が出ないこと、削除された顧客、状態と担当の絞り込みとアドレス、前後の日と今日、予約のない日、条件に合う予約のない日、アドレスの日付、55 件の続きの表示とフォーカス、`admin` が見るほかのサロン）。`src/bookings/booking.integration.test.tsx`: 予約の内容（DB の行と同じ内容）と、5 つの操作（DB に書かれたステータスと日時と理由、通知、「状態」の見出しへのフォーカス、確定したあとの一覧に前の状態が出ないこと、完了の日時をサロンの時計で入力して UTC で書かれること、記録した開始より前の終了では何も送らないこと、開始日時を過ぎた予約の無断キャンセル）、ほかで変えられていたとき（画面で操作したときと、ダイアログで操作したとき）、DB が書き込みを断ったとき（画面とダイアログ）、`admin` の操作、ほかのサロンの予約と存在しない予約。予約は、テストが SQL で入れる（シードのデータには、今日の予約がない）。用意は `src/bookings/__tests__/arrangements.ts` にある
- admin-app の `src/sales/sales.integration.test.tsx`: 予約の内容の画面から会計を入れる（施術を足し、金額、会計の担当とメモ、DB の売上と明細、応答の売上を移った最初の描画で出すこと、予約の「会計」に売上が出ること）、足した施術を外すことと、その間にメニューから削除された施術、税込でない明細の消費税の分け方（DB の明細）、その間に会計されたとき（409）、施術を始める前の予約とキャンセルした予約、会計の入った予約の会計の画面と、売上を取り消したあと、DB が書き込みを断ったとき。`staff` が支払いを分けて記録する（現金で一部、残りをカードで。DB の決済取引、支払い状態、通知）、レシート（印刷、見出しへのフォーカス、支払いとカード）、送る前に出す誤り（支払い方法の下限、未払い残額を超える金額）、その間に取り消された売上、DB が書き込みを断ったとき、合計を受け取る前のレシート。売上台帳（ヘッダーの「売上」、今日の売上と順、支払い状態の絞り込みとアドレス、範囲の誤り、売上の内容と「この日の売上へ」）、ほかのサロンのメンバー。売上は、テストが SQL で入れる（シードのデータには、売上がない）。用意は `src/sales/__tests__/arrangements.ts` にある
- admin-app の `src/customers/customers.integration.test.tsx`: 顧客台帳（ヘッダーの「顧客」から、台帳のすべてのお客様と人数、行の内容、フリガナのキーワード、2 つのタグとランクと、それがアドレスにあること、「条件を外す」、サロンの日付の登録日の範囲と、その最初と最後の日、条件に合うお客様のいないとき、範囲の誤りでは何も送らないこと、条件のあるアドレスで開くこと、21 人の続きの表示とフォーカス）、お客様を登録する（台帳から開き、多くの項目を入れて登録し、応答のお客様を移った最初の描画で出すこと、DB の行、通知、前に読んだ台帳の一覧に新しいお客様が出ること、必須の欄、大文字で書いたほかのお客様のメールアドレス、ほかのお客様の紹介コード、DB が書き込みを断ったとき、ダイアログで台帳を探して選んだ紹介元と、その DB の行と、お客様の台帳の名前のリンク、見つからないキーワードと、その間に登録されたお客様を同じキーワードで見つけること、「やめる」で紹介元が変わらないこと）、お客様の台帳（台帳の項目、来店とポイント、好み設定のスタッフの名前と削除されたスタッフ、この 1 年の利用の集計と、よく受けたメニューと担当、ほかの期間とそのアドレス、366 日より長い期間、予約の内容のお客様の名前から開き、「予約を入れる」でお客様を選んだ予約の画面へ移ること、台帳から削除されたお客様、ほかのサロンのメンバーには、このサロンでの利用だけが断られること、紹介元の名前のリンクから紹介元の台帳へ移ること、台帳から削除された紹介元をリンクにしないこと）、台帳を直す（顧客台帳から開き、変えた項目だけを送り、その間にほかのサロンが書いた備考が残ること、応答のお客様を移った最初の描画で出すこと、読んであった顧客台帳に、直した内容が出ること、フォームを、前に読んだ内容でなく、読み直した内容で開くこと、何も変えずに送ったとき、ほかのお客様のメールアドレス、開いている間に削除されたお客様、DB が書き込みを断ったとき、紹介元の名前で開き、外して送ること、そのお客様自身を選べないことと、ほかのお客様に変えること、台帳から削除された紹介元が、ほかの項目を変えても残ること、選んだ紹介元が開いている間に削除されたとき）。`src/customers/customer-preferences.integration.test.tsx`: 好み設定を直す（お客様の台帳から開き、保存されている内容と、このサロンのスタッフと、名指された、ほかのサロンのスタッフを、API の順で出すこと、直した内容が DB に書かれ、お客様の台帳の節が前の内容を出さずに読み直すこと、初めての好み設定、変えた項目だけを送り、その間にお客様が書いた項目と、ほかのサロンのスタッフが残ること、削除されたスタッフが出ずに、保存されたまま残ること、もう一度開いたフォームが、前に読んだ内容で開かないこと、何も変えずに送ったとき、選んだスタッフがその間に削除されたとき、開いている間に削除されたお客様、DB が書き込みを断ったとき、「やめる」）。`src/customers/customer-history.integration.test.tsx`: 台帳から削除して戻す（ダイアログの説明、削除されたお客様の画面への切り替えと見出しへのフォーカス、通知、そのときの台帳の項目、DB の行、アクセシビリティ、「台帳に戻す」でお客様の台帳に戻ること、前に読んだ顧客台帳を最初の描画で出さないこと、終わっていない予約、DB が書き込みを断ったとき、ダイアログを開いている間にほかで削除されたとき、削除のあとに同じメールアドレスで登録されたお客様と、そのお客様を探した顧客台帳、その間に戻されていたとき、統合されたお客様、だれも持たない ID）、変更履歴と版（お客様の台帳から開き、変更者の 3 つの言葉と変えた項目、件数、版の画面の前の版から変えた項目と台帳の項目、「変更履歴へ」、22 件を 20 件ずつ、削除されたお客様の履歴と削除の版、ない版）、スタッフ（お客様の台帳の節と、変更履歴のアドレスで、だれができるかを伝えること、削除されたお客様は「お客様が見つかりません」で、API が断る変更履歴を読まないこと）。登録日、紹介コード、紹介元、好み設定、削除、ほかのアカウントやお客様本人が書いた版、終わっていない予約のキャンセル、ポイントの取引と売上は、テストが SQL で用意する（版は、API と同じく、次の番号で、お客様のいまの値を写す。ポイントの取引は、シードの開始残高のあとに、残高を書いて並べ、台帳の残高を最後の残高にする）。用意は `src/customers/__tests__/arrangements.ts` と `src/sales/__tests__/arrangements.ts` にある。`src/customers/customer-points.integration.test.tsx`: ポイント（お客様の台帳の「ポイントの履歴」から開き、残高、期限が近いポイントと期限を過ぎたもの、履歴の内容と順、その売上と予約へのリンクと、ほかのサロンの売上、アクセシビリティ、21 件の続きとフォーカス）、ポイントを記録する（有効期限のある付与と、通知、履歴の最初の行、DB の行と残高、お客様の台帳の残高（お客様の読み直しを止めたまま台帳を開き、最初の描画が記録したあとの残高であること）、売上の内容から使ったポイントを、その売上に結びつけて記録すること、もう付与した売上（409）、開いている間に取り消された売上（409）、残高より多く使うとき（409）、オーナーの調整、スタッフに調整を出さないこと、ポイント数と有効期限の誤りで何も送らないこと、開いている間に削除されたお客様、DB が書き込みを断ったとき）、アドレスの売上（取り消した売上とお客様のいない売上を出さずに、売上に結びつけずに記録すること、ほかのサロンの売上、取り消した売上とお客様のいない売上の内容に節「ポイント」を出さないこと）。`src/customers/customer-bulk.integration.test.tsx`: CSV から登録する（顧客台帳から開き、ファイルの 2 人を読んで出し、登録して顧客台帳へ移ること、通知、DB の行（小文字にしたメールアドレス、タグ、ない列の値）、台帳の先頭に出ること、ファイルの誤りを行ごとに出して何も送らないことと、ファイルの欄へのフォーカス、ファイルを選ばずに押したとき、大文字で書いた、台帳にいるお客様のメールアドレス、ほかのお客様の紹介コード、台帳から削除された紹介元、DB が書き込みを断ったとき、アクセシビリティ）、選んだお客様（タグのないお客様だけに付けて、ほかのタグを残し、選んだままであること、タグのあるお客様だけから外すこと、だれも変わらないときに何も書かないこと、2 つのタグを書いた誤り、その間に台帳から削除されたお客様、DB が書き込みを断ったとき、スタッフに削除を出さないこと、オーナーの削除と、節の見出しへのフォーカス、終わっていない予約のあるお客様、選ぶのをやめることとフォーカス、条件を変えて戻したとき、ダイアログのアクセシビリティ）。`src/customers/customer-merge.integration.test.tsx`: ほかのお客様とまとめる（お客様の台帳から開き、相手を探して選ぶと、このお客様は選べないこと、アドレスのクエリ、見出しへのフォーカス、違う項目とまとめたあとの値、ほかに移るものとポイントの合計、ダイアログの説明、まとめて残すお客様の台帳へ移ること、通知、DB の行（まとめたお客様の削除、2 人の統合の版、合わせたポイント）、残すお客様を相手にして、まとめるお客様の値を選んだとき（予約が移ること）、2 人とも自分のアカウントを持つとき、削除の依頼とポイントの上限とカルテの件数、その間に削除の依頼が受け付けられた（409）ときに読み直して理由を出すことと、見出しへのフォーカス、その間に相手が台帳から削除された（400）ときと「相手を選び直す」、DB が書き込みを断ったとき、スタッフ、アクセシビリティ）。`src/customers/customer-export.integration.test.tsx` は、出力（タグの条件の顧客台帳から保存したファイルの名前、種類、BOM と改行、条件に合うお客様だけの行と、通知の人数、条件のない台帳のすべてのお客様、条件に合うお客様がいないとき、10,000 人を超えるときと、条件を変えると消えること、スタッフ、お客様のデータを保存したファイルの名前と中身と字下げ、その間に削除されたお客様、スタッフ、アクセシビリティ）。保存したファイルは、`testing` の `savedFiles()` で受け取る。`src/customers/customer-erasure.integration.test.tsx` は、削除の依頼（理由を書いて受け付け、消去の予定、通知、見出しへのフォーカス、DB の行と 336 時間後の予定、空白だけの理由と 1,000 文字を超える理由で何も送らないこと、その間にほかのアカウントが受け付けていたとき、ダイアログで確かめて取り消し、新しい依頼を受け付けられること、「戻る」で取り消さないこと、その間に取り消されていたとき、その間に消去が実行されていたときの削除されたときの台帳、その間に台帳から削除されたお客様、削除されたお客様の進行中の依頼の取り消しと、新しい依頼を受け付けないこと、消去したお客様、スタッフ、アクセシビリティ）。依頼、その間の取り消しと消去は、テストが SQL で用意する
- admin-app の `src/charts/charts.integration.test.tsx`: シードのカルテ（項目と過去の施術の表、お客様の台帳へのリンク）、カルテのないお客様の「カルテを作る」から、商材を「、」で区切り（同じ名前を 1 つに）、過去の施術を足して外して作ること（通知、DB の行）、送る前に出す誤り（未来の施術日、100 文字を超える商材の名前。欄へのフォーカス、何も書かれないこと）、直すときに変えた項目だけを送り、その間にほかのアカウントが書いた項目が残ること、何も変えずに送ること、その間にほかのアカウントが作っていたとき（書いた内容が残ることと、そのカルテを直す画面へのリンク）、作る前と直す前に台帳から削除されたお客様、カルテのあるお客様の作る画面とないお客様の直す画面、`staff` がアレルギーの記録の有無とキーワードで探すこと（大文字と小文字を区別しない、条件に合うカルテのないとき）、27 件の続きの表示、お客様の台帳と顧客台帳からのリンク、4 つの画面のアクセシビリティ。用意は `src/charts/__tests__/arrangements.ts` にある
- admin-app の `src/charts/allergies.integration.test.tsx`: シードのアレルギー（カルテの最初の節、重い順、重篤度の言葉、症状のないもの、確かめた日のないもの、件数）、カルテのないお客様にすべての項目で記録すること（前後の空白、通知、DB の行、一覧）、必須の項目だけで記録すること（ほかは null）、同じアレルゲン（アレルゲンの欄の誤りとフォーカス、書いた内容が残ること）、送る前に断る未来の確かめた日と 255 文字を超えるアレルゲン、変えた項目だけを送り、その間にほかのアカウントが書いた症状が残ること（確かめた日を空にして消すこと）、何も変えずに送ること、ほかのアレルギーと同じアレルゲンに直すこと、直す前にほかのアカウントが削除していたこと、記録する前と直す前に台帳から削除されたお客様、ほかのお客様のアレルギーの ID のアドレス、ダイアログで削除すること（見出しへのフォーカス、通知、一覧、DB の行）、「戻る」で何もしないこと、その間に削除されていたこと（見出しの下の文、一覧の読み直し）、スタッフが直せて「削除」が出ないこと、23 件の続きの表示（21 件目のリンクへのフォーカス）、3 つの画面のアクセシビリティ
- admin-app の `src/treatments/treatments.integration.test.tsx`: シードの施術記録の一覧（新しい順、お客様、担当、サービス、施術時間、満足度の言葉、書いた日時、件数）、担当の条件、書いた日の条件（終わりの日が始まりの日より前の誤りとフォーカス、条件に合わないとき）、お客様の台帳の「施術記録を見る」からそのお客様の一覧と「すべてのお客様にする」、24 件の続きの表示（21 件目のリンクへのフォーカス）、施術記録の内容（項目、使った商材とロット番号の表、予約とお客様へのリンク）、スタッフが完了した予約の節「施術記録」から、商材を足して外し、ロットで管理する商品のロット番号を求められてから書くこと（欄の誤りとフォーカス、通知、表、DB の行）、始まっていない予約の節と、書く画面にフォームが出ないこと、施術記録のある予約の書く画面から施術記録へ、その間にほかのアカウントが書いていたこと（書かれていた施術記録へのリンク、DB の行が残ること）、その間に取り消された予約（フォームの上の文へのフォーカス、書いた内容が残ること）、その間に削除されたスタッフと商品（欄の誤りとフォーカス）、台帳から削除されたお客様、削除された予約（「予約が見つかりません」）、ほかのサロンのアドレスの施術記録、変えた項目だけを送り、商材の一覧を置き換え、その間にほかのアカウントが書いた申し送りが残ること、何も変えずに送ること、直す前に削除されていたこと、一覧から開いてダイアログで削除すること（前の一覧を出さないこと、通知、一覧、DB の行）、施術記録の内容から直す画面への見出しのフォーカスと「やめる」、スタッフが直せて「削除」が出ないこと、4 つの画面のアクセシビリティ
- admin-app の `src/treatments/photos.integration.test.tsx`: シードの施術写真（順、キャプション、画像と「写真を開く」の URL）、スタッフが施術記録の「写真を足す」から 2 枚を足すこと（見出しへのフォーカス、通知、移った画面の最初の表示に写真があること、並び順と DB の行）、その間にほかのアカウントが同じ URL の写真を足していたこと（欄の誤りとフォーカス、ほかの URL で足せること）、その間に 19 枚足されていたこと（足せる枚数、欄を外して足すこと、20 枚で「写真を足す」が出ないこと）、20 枚ある施術記録の写真の画面、その間に削除された施術記録、スタッフがダイアログで写真を外すこと（節の見出しへのフォーカス、通知、DB の行）、その間に外されていた写真、一覧の「施術の統計」から今月の統計（期間、シードの数、平均、区分、サービスの順）、施術記録のない期間、終わりの日が始まりの日より前の誤りとフォーカス、3 つの画面のアクセシビリティ
- admin-app の `src/staff/staff.integration.test.tsx`: 登録した順の台帳（無効なスタッフ、スタッフの内容へのリンク、「スタッフを登録する」、ヘッダーの「スタッフ」）、続きのページ（最初の行へのフォーカス）、すべての項目でスタッフを登録すること（見出しへのフォーカス、通知、移った画面の最初の表示、DB の行）、必須の項目だけで登録すること（既定の値）、送る前の誤り（最初の誤りへのフォーカス、DB に行が増えないこと）、大文字の混じった、ほかのスタッフのメールアドレス、削除したスタッフのスタッフコード（そのメールアドレスは使えること）、スタッフの内容（「スタッフ情報を直す」と「削除」）、オーナーご自身のスタッフ情報（「削除」がないこと）、変えた項目だけを送ること（その間にほかのアカウントが書いた紹介文が残ること）、何も変えずに送ること、ご自身のスタッフ情報を無効にしようとすること、直す間に削除されたスタッフ、台帳から開いたスタッフをダイアログのあとで削除すること（台帳の見出しへのフォーカス、通知、DB の行、戻った台帳の最初の表示に、削除したスタッフも「スタッフを登録する」もないこと）、終わっていない予約を担当しているスタッフ、削除する前に削除されていたスタッフ、マネージャー（ヘッダーのリンクと台帳がないこと）、ほかのサロンのオーナー（API の 403）、4 つの画面のアクセシビリティ
- admin-app の `src/shifts/shifts.integration.test.tsx`: 週のシフト（登録した順の行、日付の行がその日だけに当たること、休み、勤務なし、休憩、無効なスタッフが出ないこと、勤務スケジュールへのリンク、ヘッダーの「シフト」）、今日の週で開くこと、「前の週」「今週」「次の週」、スタッフのアカウント（自分の行だけ、勤務スケジュールに「勤務スケジュールを直す」がないこと、ほかのスタッフの勤務スケジュールと、直す画面を使えないこと）、勤務スケジュール（毎週の表、今日から後の日付の行、今日より前の行の数）、毎週の時刻と休み、日付の休みを保存すること（見出しへのフォーカス、通知、DB の行、移った画面の最初の表示）、送る前の誤り（最初の誤りへのフォーカス、同じ日付の行、DB が変わらないこと）、その間にほかのアカウントが変えた勤務スケジュール（送らずに言うこと、もう一度押して置き換えること）、何も変えずに送ること（DB の行が書き直されないこと）、今日より前の行を残すことと消すこと、オーナーがスタッフ台帳から無効なスタッフの勤務スケジュールを直すこと、直す間に削除されたスタッフ、ほかのサロンのオーナー（シフトと勤務スケジュール）、3 つの画面のアクセシビリティ
- admin-app の `src/staff-accounts/staff-account.integration.test.tsx`: スタッフの内容から開いて招待すること（ロールの選択肢、宛先、見出しへのフォーカス、通知、DB の招待と 7 日の期限、送ったメールのリンク、ヘッダーの「スタッフ」）、ロールを選ばずに送ること、管理者がオーナーとして招待すること、期限切れの招待を前のロールで送り直すこと、台帳のメールアドレスが変わった招待、1 分以内の招待、招待の取り消し、その間に受け入れられた招待、無効なスタッフ（フォームを出さないことと、その間に無効にされたこと）、招待する間に削除されたスタッフ、アカウント（メールアドレス、ロール、状態とその説明、2 要素認証、最後のログイン）、ロールの変更、変えずに送ること、紐づけの解除、その間に解除された紐づけ、ご自身のアカウント、ほかのオーナーのアカウント、マネージャーとほかのサロンのオーナー、3 つの場合のアクセシビリティ
- admin-app の `src/own-profile/own-profile.integration.test.tsx`: スタイリストがヘッダーの「プロフィール」から開くプロフィール（項目、お客様からの見え方へのリンク、今の画面）、変えた項目だけを保存すること（見出しへのフォーカス、通知、すぐに出ること、DB の行）、空にした項目、変えずに送ること、経験年数と写真の URL の誤り（送らないこと）、プロフィールを読み直しても書きかけが残ることと、その間に台帳で変わった紹介文が残ること、その間に無効にされたスタッフと、無効なスタッフ、何も書いていないオーナー、オーナーが自分のプロフィールを直すこと、管理者、2 つの場合のアクセシビリティ
- admin-app の `src/menu/menu.integration.test.tsx`: スタイリストがヘッダーの「メニュー」から開くメニュー（カテゴリーの順、変える手段のないこと）、無効なものと未分類のサービス、サービスの内容とオプション、管理者が見るパッケージのサービス、マネージャーがほかのカテゴリーの下にカテゴリーを足すこと（最後の表示順、DB の行）、オーナーが変えた項目だけを直すことと、その間に書かれた説明が残ること、親に出さないカテゴリー、変えずに送ること、ダイアログのあとの削除（下のカテゴリーとサービスの行）、その間に削除された親と、その間に下に入った親、その間に削除されたカテゴリー、スタイリストに出さないフォーム、ほかのサロンのマネージャー、2 つの画面のアクセシビリティ
- admin-app の `src/menu/services.integration.test.tsx`: マネージャーがメニューからオプションのあるサービスを足すこと（全角の数字の料金、割引、予約の条件、担当できるスタッフ、タグ、最後の表示順、内容の画面、DB の行）と、選んだ順の 2 つのサービスのパッケージ、送る前に言う誤り（料金より高い割引とフォーカス、構成サービスの数）、オーナーが内容の画面から開いて変えた項目だけを直すことと、その間に書かれた説明が残ること、オプションを置き換えること（外した行と足した行、並びの順）、管理者がパッケージをやめること、変えずに送ること、ダイアログのあとの削除（メニューの表と DB の行）、パッケージに入ったサービスと終わっていない予約のあるサービスの削除を断られて言うこと、その間に削除されたカテゴリーと、その間に削除されたサービス、スタイリストに出さない「サービスを直す」と足す画面、ほかのサロンのマネージャー、サービスとパッケージのフォームのアクセシビリティ
- admin-app の `src/menu/services-change.integration.test.tsx`: マネージャーがメニューの「まとめて変える」から 2 つのサービスのオンライン予約を止めること（通知、メニューの表、DB の行と、選ばなかったサービスが変わらないこと）、オーナーが 2 つのサービスを別のカテゴリーに移して近日公開にすること、選ばず何も変えずに送ると API を呼ばないこと、選んだサービスがその間に削除されていたときに、どれも変えず、そのサービスを選択肢から消してほかの印を残すこと、選んだカテゴリーがその間に削除されていたこと、スタイリストに出さないフォーム、ほかのサロンのマネージャー、フォームのアクセシビリティ
- admin-app の `src/settings/settings.integration.test.tsx`: スタイリストがヘッダーの「設定」から開く設定（すべての節、曜日ごとの営業時間、直す手段のないこと）、営業日カレンダー（今日からの日付と、名前と備考のある休業日）、マネージャーが設定の画面から紹介と税率を直すこと（通知、設定の画面、DB の行と、ほかの項目が変わらないこと）、その間にほかの人が直した項目が残ること、変えずに送ると API を呼ばないこと、送る前の誤り、ほかのサロンが使っているメールアドレス、スタイリストに出さないフォーム、ほかのサロンのマネージャー、設定とフォームのアクセシビリティ
- admin-app の `src/settings/hours.integration.test.tsx`: マネージャーが設定の画面から曜日ごとの営業時間を直すこと（休憩、定休日、遅い閉店、設定の画面の表、DB の値、カレンダーが変わらないこと）、終日休業の日と祝日の営業の日を足すこと（今日より前の行が残ること）、日付の行を終日休業にすることと外すこと、変えずに送ると API を呼ばないこと、送る前の誤り、その間にほかの人が直したときと、もう一度送ったとき、スタイリストに出さないフォーム、ほかのサロンのマネージャー、フォームのアクセシビリティ
- admin-app の `src/payment-methods/payment-methods.integration.test.tsx`: スタイリストが設定の「支払い方法を見る」から開く一覧（シードの 7 つ、並び順、変える手段のないこと）と支払い方法の内容、マネージャーが支払い方法を足すこと（最後の並び順、内容の画面、DB の行、一覧の最後）、支払い方法の内容から直すこと（手数料率と決済代行会社。ほかの支払い方法と項目が変わらないこと）、使うのをやめること（一覧の「使っていない」）、受け取った支払いのない支払い方法を削除すること、その間に支払いを受け取った支払い方法の削除が断られること（409。フォームの上の言葉と、DB の行が残ること）、送る前の誤り、変えずに送ると API を呼ばないこと、スタイリストに出さないフォーム、ほかのサロンのマネージャー、ない支払い方法、一覧、内容、2 つのフォームのアクセシビリティ。支払いは、テストが SQL で入れる（用意は `src/payment-methods/__tests__/arrangements.ts`）
- admin-app の `src/products/products.integration.test.tsx`: スタイリストがヘッダーの「商品」から開く台帳（シードの 7 つ、商品コードの順、変える手段のないこと）と商品の内容、キーワード、カテゴリーと用途、バーコード、取り扱いで探すこと（アドレスの条件、カテゴリーの選択肢、条件を外すこと、条件に合う商品のないこと）、続きを読むこと（20 件のあと。続きの最初へのフォーカス）、マネージャーが台帳から商品を足すこと（初めの値、全角の数字とカンマ、通知、最初の描画、DB の行、台帳）、商品の内容から直すこと（変えた項目だけ。ほかの商品が変わらないこと）、オーナーが取り扱いをやめること（台帳の「取り扱いをやめた」）、在庫の記録のない商品を削除すること、在庫の記録がある商品の削除が断られること（409。フォームの上の言葉と、DB の行が変わらないこと）、取り扱いをやめた商品のコードが使えないこと（409。商品コードの欄）、送る前の誤り、その間に変わった発注点と比べて API が断った最低在庫数（400。その欄）、変えずに送ると API を呼ばないこと、その間に削除された商品、スタイリストに出さないフォーム、ほかのサロンのマネージャー、ない商品、台帳、内容、2 つのフォームのアクセシビリティ。その間の変更と、ページを超える商品は、テストが SQL で入れる（用意は `src/products/__tests__/arrangements.ts`）
- admin-app の `src/inventory/inventory.integration.test.tsx`: スタイリストがヘッダーの「在庫」から開く在庫（シードの 6 行、商品コードの順、期限切れの印、変える手段のないこと、見かたのリンク）と在庫の行の内容、商品とロット番号で絞ること（アドレスの条件、条件に合う行のないこと、条件を外すこと）、在庫僅少のないことと、最低在庫数にある商品のすべてのロットの行、期限切れ間近の期間（期限の過ぎた行が先、今日の行、使用期限のない行と期間の外の行が出ないこと、アドレスの `days`）、続きを読むこと（20 行のあと。続きの最初へのフォーカス）、オーナーがロット番号で分けない商品の行を足すこと（取り扱い中の商品の選択肢、通知、最初の描画、DB の行）、マネージャーがロットを足すこと（同じロット番号の 409 をロット番号の欄に言い、直して足す）、ロット番号のない 2 つめの行（409。フォームの上）、送る前の誤り、その間にロット番号で分ける印が付いた商品（400。読み直してロット番号の欄を出す）、行を直すこと（変えた項目だけ。変えずに送ると API を呼ばないこと）、ほかの行のロット番号に直すこと（409）、印を外した商品の行のロット番号を消すこと、在庫数 0 の行の削除、在庫のある行の削除が断られること（409。DB の行が変わらないこと）、その間に削除された行、スタイリストに出さないフォーム、ほかのサロンのマネージャー、ほかのサロンの行（`admin` が東京のアドレスで開くものも）、ない行、在庫、期限切れ間近、内容、2 つのフォームのアクセシビリティ。その間の変更と、ページを超える行は、テストが SQL で入れる（用意は `src/inventory/__tests__/arrangements.ts`）
- admin-app の `src/inventory/movements.integration.test.tsx`: スタイリストが在庫から開いた在庫の行で施術での使用を記録すること（スタイリストに出す区分、フォームの上の在庫数、通知、履歴の先頭、DB の在庫の移動、開き直した在庫の在庫数）、マネージャーの在庫の調整（理由が要ること、減らす向き、単価と金額）、使える数を超えて減らす記録を送らないこと、その間に引き当てられた在庫（409。数量の欄に言い、在庫の行を読み直す）、履歴を区分と記録した日で絞ること（アドレスの条件、発注の入荷、条件に合う在庫の移動のないこと、条件を外すこと）、続きを読むこと（20 件のあと）、在庫の移動のない行、その間に削除された行、ほかのサロンの行（`admin` が大阪のアドレスで開くもの）、在庫の行、履歴、フォームのアクセシビリティ。その間の変更と、それより前の在庫の移動は、テストが SQL で入れる（用意は `src/inventory/__tests__/arrangements.ts`）
- admin-app の `src/inventory/count.integration.test.tsx`: マネージャーが在庫の「棚卸しする」から 2 行を数えること（欄の説明、通知、見出しへのフォーカス、差のあった行の表、DB の在庫数と棚卸しの記録と数えた人、在庫の調整の在庫の移動と理由、開き直した在庫が読み直されること、在庫の行の数えた人の名前）、オーナーが続けて棚卸しすること（読み直した帳簿の在庫数、空の欄、差のないこと）、管理者の棚卸しを数えた人なしで記録すること（在庫の行に名前を出さないこと）、送る前に言う誤り（数えた行のないこと、引き当てた数を下回ること、フォーカス）、その間に引き当てられた在庫（409）と削除された行（400）で、行を読み直し、入れた数が残ること、スタイリストに出さないことと使えないこと、ほかのサロンの在庫、在庫評価額のカテゴリーごとの表と、棚卸しのあとに読み直されること、在庫のないサロン、フォームと結果と在庫評価額のアクセシビリティ
- admin-app の `src/inventory/alerts.integration.test.tsx`: スタイリストが在庫の「在庫のアラート」から開くこと（件数、商品コードの順の期限切れの行、在庫の行へのリンク）、メモ付きで確認済みにすること（通知、見出しへのフォーカス、読み直した件数と表、DB の確認の記録と確認した人、未確認に絞り込むこと）、どの種類のアラートも出ること（在庫僅少、在庫過剰、期限切れ間近、重要度で絞り込むこと、アドレスの条件、1 件もないこと、条件を外すこと）、同じ条件で読み直すこと、続きのページとフォーカス、その間に使い切られた行（404。代わりに出た在庫僅少）とその間にオーナーが確認したアラート（409）、管理者がメモなしで確認すること（名前を出さないこと）、棚卸しのあとに読み直されること、ほかのサロンのスタイリスト、在庫のないサロン、表とダイアログとアラートのないサロンのアクセシビリティ
- admin-app の `src/purchase-orders/purchase-orders.integration.test.tsx`: スタイリストがナビゲーションの「発注」から開くこと（シードの 2 件、新しい順、ステータス）と、発注の内容（管理者が作った発注で名前がないこと、明細、金額、在庫の行へのリンク）、管理者が承認した発注（承認、納品予定日、送料）、ステータス、仕入先、発注日で絞り込むこと（アドレスの条件、名前のすべてで探すこと、1 件もないこと、条件を外すこと）、終わりの日が始まりの日より前のこと、同じ条件で読み直すこと、続きのページとフォーカス、スタイリストが発注を作ること（仕入価格の単価、その場の小計と税額の目安、通知、見出しへのフォーカス、読み直さずに見せること、DB の発注と明細と作った人、読み直した一覧）、送る前の誤り（仕入先、発注する行がないこと、数量、単価、税額、合計の超過）、その間に削除された行（400。読み直しと、入れた数が残ること）、管理者が作る発注（作った人なし）、ほかのサロンの発注とアカウント、アドレスのサロンと違う発注と、ない発注、発注のないサロンと在庫のないサロン、一覧、発注の内容、誤りのあるフォーム、発注のないサロンのアクセシビリティ
- admin-app の `src/purchase-orders/purchase-order-steps.integration.test.tsx`: スタイリストが下書きの承認を依頼すること（すぐ送ること、通知、「状態」へのフォーカス、承認と取り消しをできる人の説明、DB）、マネージャーが一覧から開いた発注を承認すること（承認した人の名前、DB、読み直した一覧）、スタイリストが発注済みと出荷済みにすること、オーナーが理由を書いて取り消すこと（理由が空の誤り、通知、閉じたダイアログ、取り消した理由、直す操作がないこと、DB）、管理者の承認（名前なし）、その間に承認か取り消しになった発注（409。読み直しとフォーカス）、スタイリストが納品予定日とメモを直すこと（開いたときの値、空にしたメモ、DB）、何も変えずに送ること（DB が変わらないこと）、納品済みと取り消しの発注を直す画面、直している間に取り消された発注（409）、アドレスのサロンと違う発注と、ない発注を直す画面、状態、取り消しのダイアログの誤り、直すフォームのアクセシビリティ
- admin-app の `src/purchase-orders/purchase-order-receipt.integration.test.tsx`: スタイリストが在庫から開いた発注済みの発注の入荷を記録すること（「入荷を記録する」、はじめの値と欄の説明、通知、見出しへのフォーカス、納品済みの状態、DB の発注と在庫数と在庫の移動の仕入れ、読み直した一覧と在庫）、マネージャーが出荷済みの発注の一部の明細を受け取り、納品のメモを書くこと、送る前の誤り（発注より多い数、0、1 件もないこと）、いまの納品のメモを空にすること、承認待ち、納品済み、取り消し、すべての行が削除された発注の入荷の画面、入れている間に取り消された発注（409）、在庫数の上限を超える入荷（409）、その間に削除された行（400。読み直しと、入れた数が残ること、残った明細の入荷）、アドレスのサロンと違う発注と、ない発注、スタイリストが一覧から開く提案（仕入先ごと、表、最後の発注日）とそこから作る発注（仕入先、最後の行の数量、小計、DB の明細、提案から外れること）、仕入先の決まっていない商品の発注、いま提案のない仕入先、提案のないこと、ほかのサロンの提案、入荷の誤り、提案、提案から始める発注のアクセシビリティ。発注点と仕入先と在庫数の変更は、テストが SQL で入れる
- admin-app の `src/reviews/reviews.integration.test.tsx`: オーナーが顧客台帳からナビゲーションで開くレビュー（評価のまとめと評価ごとの件数、表の行、評価の高い順、評価の上限と参考になった順、担当スタッフで絞ること、条件を外すこと）、評価の上限が下限より低いこと、条件に合うレビューのないこと、スタイリストが開くレビューの内容（項目ごとの評価、お客様と台帳へのリンク、担当スタッフ、サロンからの返信、操作のないことと、その説明）、オーナーの返信（返信を書く画面、通知、DB、読み直した一覧）、マネージャーが直す返信、いまと同じ返信、空白だけの返信、DB が断る返信、書いている間に削除されたレビュー、ほかのサロンのレビューへの返信（403）、スタイリストが開く返信の画面、オーナーと管理者の取り下げ（ダイアログ、フォーカス、DB）、「戻る」、DB が断る取り下げ、マネージャーの通報（「その他」の詳しい内容、DB、未処理の通報の件数）、2 回目の通報（409）、DB が断る通報、ほかのサロンのレビュー、ない ID、削除されたレビュー、一覧、レビューの内容、返信の画面のアクセシビリティ
- admin-app の `src/attachments/attachments.integration.test.tsx`: マネージャーがレビューからナビゲーションで開くファイル（空の一覧、PNG のアップロード、通知、表の行、DB、空になったフォームと見出しへのフォーカス、ファイルの画像と言葉、保存と表示の URL でストレージが返す中身と `Content-Disposition`）、PDF のアップロード（画像を出さないこと）、選ばないこと、API が受け付けない種類、空のファイル、10 MB を超えるファイル（送らずに欄で言う）、拡張子と違う中身（409 と DB）、DB が断るアップロード、オーナーに台帳の名前で言うアップロードした人と新しい順、スタイリストには自分だけを言うこと、スタイリストが自分のファイルを削除すること（ダイアログ、通知、読み直した一覧、DB）、ほかの人のファイル（ボタンのないことと説明）、オーナーとマネージャーと管理者の削除、その間に削除されたファイル、DB が断る削除、ほかのサロンのスタッフ、ない ID、ほかのサロンのファイル、削除されたファイル、一覧とファイルの画面のアクセシビリティ。ファイルは、ブラウザーと同じに、API が署名した URL でテストサーバーのストレージに送る
- admin-app の `src/share-links/share-links.integration.test.tsx`: ファイルの画面の下の共有リンク（新しい順、発行日時、有効期限、ダウンロード、パスワード、状態）、21 件目からのページ、開くたびに読み直す一覧（その間にほかの人が発行した共有リンク）、共有リンクのないファイル、スタイリストに言う共有できる人（共有リンクを読まないこと）、アップロードが済んでいないファイル。マネージャーがファイルからフォームへ進んで発行する 7 日の共有リンク（DB の有効期限が分に切り捨てた範囲にあること、見出しへのフォーカス、portal のアドレス、そのトークンで API がファイルを開くこと、ファイルへ戻って読み直した一覧。発行の前に読んだ一覧は出さない）、30 日と全角の上限とパスワード（パスワードなしでは 403、ありで開くこと、DB の Argon2id）、クリップボードへのコピーと、書けないときに言うこと、推測されやすいパスワード（何も発行しないこと）、API を呼ばずに欄で言う短いパスワードと整数でない上限、DB が断る発行（入力が残ること）、フォームを開いている間に削除されたファイルと、フォームを開く前に削除されたファイル（フォームを開くときに読み直す）、管理者の発行、スタイリストとアップロードが済んでいないファイルの発行のアドレス、ほかのサロンのファイルと削除したファイル。一覧から開いて、ダイアログのあとで取り消す共有リンク（見出しのファイル名、通知、取り消しの前に読んだ一覧を出さないこと、ファイルの画面、そのトークンで API が開かないこと）、その間に取り消された共有リンクと、前の画面で読んだあとで取り消された共有リンク（読んだものを出さないこと）、DB が断る取り消し（ダイアログの中で言うこと）、取り消した共有リンクとほかのファイルの共有リンクとほかのサロンのファイルの共有リンク、スタイリストの共有リンクのアドレス、画面のアクセシビリティ。共有リンクは、テストが DB に入れる（トークンはだれも知らない）か、画面で発行する
- dashboard-app の `src/reports/sales-report.integration.test.tsx`: オーナーとマネージャーがトップページから開く自分のサロンの売上レポート（今日までの、その月。期間の合計、支払い方法別、区分別、スタッフ別の行。取り消した会計を数えないこと、返金、会計の担当に数える商品）、期間を変えて集計すること（アドレス、売上のない期間、CSV のボタンのないこと）、アドレスの 366 日の期間、送る前の誤り（366 日を超える期間、終わりが始まりより前。フォーカスと、読み直さないこと）、CSV（API が作る中身と名前、通知、ボタンに残るフォーカス）、その間に削除されたサロン（CSV の理由と、集計し直したレポート）、前の画面が読んだレポートを出さないこと、管理者がサロンを選ぶこと（ヘッダーのリンクの現在地）、ほかのサロン（自分のサロンへのリンク）、ない ID のサロン、アクセシビリティ
- dashboard-app の `src/reports/sales-trends.integration.test.tsx`: 売上レポートから開く 12 か月の推移（月ごとの行、40 日前の会計、取り消した会計を数えないこと、ヘッダーのリンクの現在地）、区切りと期間を変えて集計すること、アドレスの週の区切り（最初の週の月曜日）、API にない区切り、売上のない期間、送る前の誤り、集計し直すこと、前の画面が読んだ推移を出さないこと、ほかのサロン、その間に削除されたサロン、アクセシビリティ
- dashboard-app の `src/reports/daily-sales.integration.test.tsx`: オーナーとマネージャーが開く今日の売上（返金、取り消した会計、次の日のリンクのないこと）、前の日と次の日、日付を入れて出す日と売上のない日、日付のない誤りと、ほかの日を出すと消えること、アドレスの日とカレンダーにない日、出し直すこと、前の画面が読んだ売上を出さないこと、ほかのサロン、その間に削除されたサロン、アクセシビリティ
- dashboard-app の 3 つの画面のテストは、アプリをアドレスで出すことと、カードの項目と表の行の読み方を `src/__tests__/screens.tsx` で共有する
- 各アプリの `src/App.integration.test.tsx`: そのアプリを使えるロールと使えないロール、開こうとしたアドレスの画面がサインインのあとに出ること、画面の移動、サインアウト、サインインした状態でのアクセシビリティ。admin-app と dashboard-app は、ヘッダーの「アカウントの安全」から、パスワードを変えて戻るまでと、アカウントの安全の画面から 2 要素認証を設定し、戻ると「有効」と出るまで
- `testing` の `src/api/test-api.integration.test.ts`: この仕組みそのもの（シードのデータがあること、あるテストが書いたものが次のテストに残らないこと、トークンのないリクエストをテスト用のサーバーが受け付けないこと、テスト用のサーバーが返す認証アプリのコードを API が受け付けること、ブラウザーから呼ぶための API が、指定したポートで待ち受け、指定したオリジンだけを許可すること、API が送ったメールをテストが読めて、そのリンクのトークンを API が受け付けること）

画面を操作するテストは、`@testing-library/user-event` で入力し、ボタンを押します。認証アプリのコードは `testApi().authenticatorCode(secret)` で得ます（テストには認証アプリがないため、テスト用のサーバーが計算します）。サインインの画面のテストは、API で 2 要素認証を設定してから始め、設定の画面のテストは、画面に出たキーから計算します。

書き方は、スキル [frontend-testing](../.claude/skills/frontend-testing/SKILL.md) にあります。API のモックサーバーはありません。

### 実際のブラウザーで通すテスト（`pnpm test:e2e`）

`frontend/e2e` に、実際のブラウザー（Playwright の Chromium）を操作するテストがあります。ビルドした 3 つのアプリを、同じテスト用のサーバーの API と PostgreSQL に対して操作します。ここでも、何も差し替えません。ファイル名は `*.e2e.test.ts` です。

- 実行のはじめに、テスト用のサーバーを起動し、その上に API を 1 つ、ポート 4100 で起動します。この API は、3 つのアプリのオリジンからの呼び出しを許可し（CORS）、メールのリンクを、テスト中の portal-app に向けて書きます
- 3 つのアプリを、その API のために `vite build --mode test` でビルドして（`VITE_BACKEND_BASE_URL` と、ほかのアプリのオリジンは、環境変数が `.env.test` より優先されます）、配信します。portal-app は 4101、admin-app は 4102、dashboard-app は 4103 です。どれもこのマシンだけで待ち受け、開発サーバー（3000〜3003）とは別のポートなので、`pnpm dev` と同時に動かせます
- アプリは 1 つの API のためにビルドされるので、テストは 1 つずつ順に実行します。テストが終わるたびに、API の DB は新しい複製に替わります。ブラウザーの状態（`localStorage` など）は、テストごとに新しいものです
- アプリのビルドは、ワークスペースのパッケージの `dist/` を読みます。`pnpm test:e2e` は、先にパッケージをビルドします
- ブラウザーは、`pnpm test:e2e:install` で入れます（最初の 1 回と、Playwright を更新したあと）

ここで確かめるのは、主要な経路の全体と、jsdom では確かめられないことです。画面の状態の 1 つ 1 つ（メッセージ、断られた試行、ロールごとの表示）は、jsdom の結合テストで確かめます。

- `src/sign-in.e2e.test.ts`: 開こうとしたアドレスにサインインの画面が出て、サインインするとそのアドレスの画面が出ること、空の欄では何も送らず、最初の欄へフォーカスが移ること、誤ったパスワード、キーボードだけでのサインイン、読み込み直してもサインインが続くこと、別のタブでのサインアウトがこのタブにも及ぶこと、2 要素認証のコード
- `src/applications.e2e.test.ts`: アプリごとの、使えるロールと使えないロール、portal-app のサインインとサインアウト、スマートフォンの幅（390px）の画面
- `src/account.e2e.test.ts`: 登録から、メールのリンク、メールアドレスの確認、サインインまで。admin-app のサインインの画面から、portal-app での再設定、新しいパスワードでの admin-app へのサインインまで。招待のメールのリンクからアカウントを作り、admin-app にサインインするまで。使用済みのリンク、パスワードの表示、スマートフォンの幅の登録の画面
- `src/salons.e2e.test.ts`: サロンを探して、詳細を開くまで。戻る、進む、読み込み直しで、検索が保たれること。続きの表示とフォーカス、レビューの並び順、存在しないサロン、スマートフォンの幅の検索と詳細
- `src/bookings.e2e.test.ts`: サロンの詳細のメニューから、サインインを経て、日付と時刻を選び、予約を入れて、予約の内容が出るまで（DB の行と、読み込み直したあとの表示も）。スタッフと日付が、読み込み直しと「戻る」「進む」で保たれること、キーボードだけでの予約。登録したばかりのアカウントの、お客様の情報の登録。スマートフォンの幅の、時刻の多い日と、長い要望のある予約
- `src/own-bookings.e2e.test.ts`: 予約の一覧から予約の内容を開き、ほかのスタッフの別の時刻へ日時を変え、キーボードだけでキャンセルするまで（ダイアログを開いたときのフォーカス、Escape で閉じたあとのフォーカス、ボタンの順、DB の行）。一覧のリンクの下線。どちらの一覧かが、読み込み直しと「戻る」で保たれること、ヘッダーのリンク。スマートフォンの幅の、一覧、予約の内容、長い理由を書いたダイアログ、時刻の多い日。予約の画面のテストが共有する用意は、`src/bookings.ts` にある
- `src/mypage.e2e.test.ts`: マイページを開き、リンクからフォームへ移り、キーボードだけで項目を変えて保存し、マイページに変えた内容が出るまで（Tab で欄を進む順、Space でのチェック、Enter での送信、DB の行）。登録したばかりのアカウントが、マイページからフォームへ進み、登録して、マイページに戻るまで。姓と名の欄が、幅のあるときは横に並び、スマートフォンの幅では縦に並ぶこと。スマートフォンの幅の、改行できない長い建物名と長い文章のあるマイページと、誤りのあるフォーム
- `src/preferences.e2e.test.ts`: マイページからフォームへ移り、キーボードで、スタッフを選び、時間帯の行を足して消し、一覧を書いて保存し、マイページに書いた内容が出て、再読み込みしても出るまで（行を足したときと消したときのフォーカス、複数行の欄の Enter は改行で、1 行の欄の Enter は送信であること、DB の行）。スマートフォンの幅の、改行できない長い値のあるマイページとフォーム。時間帯の 2 つの欄が、どの幅でも横に並び、片方に誤りが出ても、もう片方の位置と高さが変わらないこと
- `src/reviews.e2e.test.ts`: 来店が済んだ予約の内容の画面からフォームへ移り、キーボードで評価を選び、書いて投稿し、自分のレビューの一覧とサロンの詳細に出て、変更し、読み込み直しても出て、キーボードだけで削除するまで（Tab で欄を進む順、評価のボタンの Space と矢印、複数行の欄の Enter は改行で、1 行の欄の Enter は送信であること、ダイアログを開いたときのフォーカス、Escape で閉じたあとのフォーカス、ボタンの順、DB の行）。スマートフォンの幅の、担当が 2 人いた来店のフォームと誤りのあるフォーム、改行できない長い値とサロンの返信のある一覧、ダイアログ、変更のフォーム。「変更する」と「削除する」が、その幅でも横に並ぶこと
- `src/review-readers.e2e.test.ts`: サロンの詳細の「サインイン」のリンクからサインインして、同じページへ戻り、キーボードだけで、レビューが参考になったと伝え、通報のダイアログで理由を選んで送り、もう一度通報して、すでに通報していると伝えられるまで（ダイアログを開いたときのフォーカス、Tab で欄からボタンへ進む順、誤りのある欄へのフォーカス、矢印での理由の選択、Escape で閉じたあとと、通報したあとのフォーカス、DB の行）。押されたボタンが、押す前と違って見えること。その間に `admin` が消したレビューを通報すると、ダイアログがなくなり、フォーカスが「レビュー」の見出しへ移って、Tab が並び順の欄へ進むこと。スマートフォンの幅の、スタッフごとの評価、改行できない長いタイトルのレビューのボタン（横に並ぶこと）とダイアログ、誤りのあるフォーム、すでに通報していたときのダイアログ、自分のレビューのリンク
- `src/shared-file.e2e.test.ts`: キーボードだけで、アカウントのない人が、パスワードのある共有リンクを開き（アドレスから消えるトークン）、パスワードを入れて、PDF をストレージから読み込み、元の名前で保存すること（中身、数えた回数）。スマートフォンの幅の、画像のファイルの言葉、読み込んだ画像と、新しいタブで開いた画像（もう数えないこと）

- `src/two-factor.e2e.test.ts`: アカウントの安全の画面から、キーボードだけで、2 要素認証を設定し（Tab で欄を進む順、段階の見出しへのフォーカス、真ん中に空白のあるコード、DB の状態）、サインアウトして、次の 30 秒のコードでサインインし直し、バックアップコードで発行し直し（ダイアログを開いたときのフォーカス、新しいコードの説明へのフォーカス、閉じたあとに、開いたボタンへフォーカスが戻ること）、パスワードと新しいバックアップコードで無効にするまで（見出しへのフォーカス、DB の状態）。スマートフォンの幅の、QR コード（欠けず、正方形で、160px 以上あること）、キー、誤りのあるコードの欄、バックアップコード、2 つのダイアログ
- `src/admin-bookings.e2e.test.ts`: キーボードだけで、admin-app にサインインし、その日の予約の一覧から予約の内容を開いて、確定し、施術を始め、ダイアログで完了にし、一覧に戻るまで（見出しと「状態」の見出しへのフォーカス、ダイアログを開いたときのフォーカス、DB の行）。キャンセルのダイアログ（Escape で閉じたあとに、開いたボタンへフォーカスが戻ること、理由を書いてキャンセルすること）。ダイアログを開いている間に予約が変えられていたとき。ブラウザーのタイムゾーンがサロンと違うとき（`Pacific/Honolulu`。サロンの今日、時刻、サロンの時計で入力した日時が DB に UTC で書かれること）。スマートフォンの幅の、一覧、改行できない長いメモのある予約の内容、2 つのダイアログ、サロンを選ぶ画面
- `src/admin-checkout.e2e.test.ts`: キーボードだけで、`staff` が予約の内容から会計を入れる画面へ移り、施術を足して会計を入れ、現金で一部、残りをカード（Space で選ぶ支払い方法、カードの下 4 桁とブランド）で支払いを記録し、レシートを出すまで（見出しへのフォーカス、金額、DB の売上と決済取引）。印刷のときに、レシートだけが出ること（ヘッダー、ナビゲーション、通知、見出し、ボタンとリンクが隠れること）。ヘッダーの「売上」から売上台帳へ。スマートフォンの幅の、会計の画面、売上の内容、支払いの画面と下限の誤り、レシート、売上台帳
- `src/admin-customers.e2e.test.ts`: キーボードだけで、`staff` が予約を入れる画面でお客様を探して見つからず、「お客様を登録する」から台帳に登録し、お客様の台帳の「予約を入れる」で、そのお客様を選んだ予約の画面へ移り、ヘッダーの「顧客」から顧客台帳で探して、台帳を直すまで（見出しへのフォーカス、通知、DB の行）。スマートフォンの幅の、顧客台帳、誤りのある登録のフォーム、紹介元を選ぶダイアログと探した結果、改行できない長い値（タグ、メモ、参考の画像）のあるお客様の台帳と好み設定のフォーム。キーボードだけで、台帳を直す画面で紹介元を選び（ダイアログを開いてキーワードの欄へのフォーカス、Esc キーで閉じて「紹介元を選ぶ」へ戻るフォーカス、探して選んで戻るフォーカス）、お客様の台帳の紹介元のリンク、「好み設定を直す」でスタッフと接客の好みを直すまで（通知、DB の行）。キーボードだけで、オーナーがお客様の台帳の「台帳から削除する」でダイアログを開き（「戻る」へのフォーカス、Esc キーで閉じて戻るフォーカス）、削除して、削除されたお客様の画面から変更履歴と削除の版を開き、「お客様の台帳へ」で戻って「台帳に戻す」まで（見出しへのフォーカス、通知、DB の行）。スマートフォンの幅の、削除のダイアログ、削除されたお客様の画面、変更履歴、電話番号を変えた版
- `src/admin-customer-points.e2e.test.ts`: キーボードだけで、`staff` が売上の内容の節「ポイント」から、使ったポイントをその売上に結びつけて記録し、ポイントの画面で残高と履歴の売上へのリンクを確かめ、お客様の台帳の残高から「ポイントの履歴」へ戻って、有効期限のあるポイントを付与するまで（見出しへのフォーカス、通知、DB の行）。スマートフォンの幅の、ポイントの画面と、誤りのあるフォーム
- `src/admin-customer-bulk.e2e.test.ts`: キーボードだけで、オーナーが顧客台帳の「CSV から登録する」から、UTF-8 のファイルの 2 人を登録し、台帳で 2 人を選んで、ダイアログでタグを付け（ダイアログを開いたときのフォーカス、閉じたあとに、開いたボタンへフォーカスが戻ること）、台帳から削除するまで（見出しと、選んだお客様の節の見出しへのフォーカス、通知、DB の行）。スマートフォンの幅の、ファイルを選ぶ画面、誤りのあるファイル、読んだファイル、選んだお客様の節、削除のダイアログ
- `src/admin-customer-merge.e2e.test.ts`: キーボードだけで、オーナーがお客様の台帳の「ほかのお客様とまとめる」から、電話で登録し直された同じお客様を探して選び、ダイアログで確かめてまとめ、残したお客様の台帳へ移るまで（見出しへのフォーカス、通知、DB の行、まとめたお客様のアドレスに出る削除されたときの台帳）。ノートパソコンの幅で、長いメモのある違う項目の表が横に動かずに収まること。スマートフォンの幅の、違う項目の表とダイアログ
- `src/admin-customer-export.e2e.test.ts`: キーボードだけで、オーナーがタグの条件の顧客台帳から CSV ファイルを、お客様の台帳からデータの JSON ファイルを保存すること（ブラウザーが保存したファイルの名前と中身、BOM、通知。別のオリジンの API から、ファイルの名前が届くこと）。スマートフォンの幅の、見出しの 3 つのボタンと出力しなかった理由、ご本人からの請求の節
- `src/admin-customer-erasure.e2e.test.ts`: キーボードだけで、オーナーがお客様の台帳の「データの消去」から、ダイアログで理由を書いて消去の依頼を受け付け、確かめるダイアログのあとで取り消すまで（ダイアログを開いたときのフォーカス、消去の予定、通知、節の見出しへのフォーカス、DB の行）。スマートフォンの幅の、進行中の依頼と、取り消しのダイアログ
- `src/admin-medical-charts.e2e.test.ts`: キーボードだけで、オーナーがお客様の台帳の「カルテを見る」から、カルテのないお客様のカルテを、過去の施術を足して作り、「カルテを直す」で施術を外して直し、顧客台帳の「カルテを探す」でキーワードで探すまで（見出しと、足した施術の欄と、外したあとの「施術を足す」へのフォーカス、通知、DB の行、カルテへのリンク）。スマートフォンの幅の、過去の施術のあるカルテ、カルテのフォーム、カルテを探す画面
- `src/admin-allergies.e2e.test.ts`: キーボードだけで、オーナーがカルテの「アレルギーを記録する」から、アレルギーのないお客様にアレルギーを記録し（ラジオボタンをスペースキーで選ぶ）、「直す」で重篤度を矢印キーで重くし、「削除」のダイアログを「戻る」で閉じて（「削除」へ戻るフォーカス）、もう一度開いて削除するまで（見出しへのフォーカス、通知、表、DB の行）。スマートフォンの幅の、アレルギーの表、削除のダイアログ、アレルギーのフォーム
- `src/admin-treatments.e2e.test.ts`: キーボードだけで、オーナーが施術中の予約の節「施術記録」から、施術時間を書き、「商材を足す」で商品（フォーカス、単位が入ること）、量、ロット番号を書いて施術記録を書き（見出しへのフォーカス、通知、表、DB の行）、「施術記録を直す」で施術時間を変えて商材を外し（「商材を足す」へ戻るフォーカス、通知、DB の行）、ヘッダーの「施術記録」から担当で探すまで。スマートフォンの幅の、施術記録の一覧、施術記録の内容、削除のダイアログ、施術記録のフォーム
- `src/admin-treatment-photos.e2e.test.ts`: キーボードだけで、オーナーが写真のない施術記録の「写真を足す」から、区分、URL、お客様の同意を書いて写真を足し（見出しへのフォーカス、通知、キャプション、ブラウザーが URL の画像を出すこと、DB の行）、ダイアログで外し（節の見出しへのフォーカス、通知、DB の行）、ヘッダーの「施術記録」から「施術の統計」を開いて、期間を変えて数えるまで（アドレスのクエリ）。スマートフォンの幅の、写真のある施術記録、外すダイアログ、2 つの欄の写真のフォーム、統計
- `src/admin-staff.e2e.test.ts`: キーボードだけで、オーナーが台帳の「スタッフを登録する」から必須の項目でスタッフを登録し（見出しへのフォーカス、通知、レベル、DB の行）、「スタッフ情報を直す」で無効にし（通知、状態、DB の行）、ダイアログで削除する（台帳の見出しへのフォーカス、通知、台帳の人数、DB の行）まで。スマートフォンの幅の、台帳、スタッフの内容、削除のダイアログ、フォーム
- `src/admin-shifts.e2e.test.ts`: キーボードだけで、マネージャーが 2 週あとのシフトからスタッフの勤務スケジュールを開き、「勤務スケジュールを直す」で月曜日の終わりを早め、土曜日を「勤務しない」にし、「日付の行を足す」で水曜日の研修の休みを入れて保存し（見出しへのフォーカス、通知、DB の行）、ヘッダーの「シフト」と「次の週」でその週に移って、行に出るまで。スマートフォンの幅の、シフト、勤務スケジュール、フォーム
- `src/admin-staff-accounts.e2e.test.ts`: キーボードだけで、オーナーがスタッフの内容から、アカウントのないスタッフを招待し（見出しへのフォーカス、通知）、招待されたスタッフがメールのリンクからポータルでアカウントを作って店舗向けの画面にサインインし、オーナーがそのアカウントを開いて、ロールをマネージャーに変えるまで（DB のロール）。スマートフォンの幅の、アカウント、紐づけの解除のダイアログ、解除のあとの招待のフォーム
- `src/admin-own-profile.e2e.test.ts`: キーボードだけで、スタイリストがヘッダーの「プロフィール」から専門と紹介文を書き直して保存し（見出しへのフォーカス、通知、DB の行）、お客様からの見え方へのリンクで portal-app のサロンの詳細を開き、書いた専門と紹介文が出ていることまで。スマートフォンの幅の、プロフィールとフォームと、写真の URL の誤り
- `src/admin-menu.e2e.test.ts`: キーボードだけで、マネージャーがヘッダーの「メニュー」から、Hair Cut の下にカテゴリーを足し（通知、見出しへのフォーカス、メニューの表、DB の行）、カテゴリーの表から開いて、ダイアログのあとに削除するまで。スマートフォンの幅の、メニューとサービスの内容と、色の誤りのあるフォーム
- `src/admin-services.e2e.test.ts`: キーボードだけで、マネージャーがメニューの「サービスを足す」から、2 つのサービスのパッケージを足し（通知、見出しへのフォーカス、パッケージのサービス、DB の行）、内容の画面の「サービスを直す」から料金を直し、ダイアログのあとに削除するまで。スマートフォンの幅の、構成サービスとオプションの行に誤りのあるフォーム
- `src/admin-services-bulk.e2e.test.ts`: キーボードだけで、マネージャーがメニューの「まとめて変える」から 2 つのサービスを近日公開にし、通知、見出しへのフォーカス、メニューの表、DB の行まで。スマートフォンの幅の、誤りのあるフォーム
- `src/admin-salon-settings.e2e.test.ts`: キーボードだけで、オーナーが設定の画面の「サロンの情報を直す」から紹介と税率を書き直して保存し、通知、見出しへのフォーカス、設定の画面の税率、DB の行まで。ほかの画面へ移ったあいだに変わった税率が、設定を開き直すと出ること（アプリは、読んだものを 5 分のあいだ使い回すので、設定の画面だけは開くたびに読み直す）。スマートフォンの幅の、設定と、誤りのあるフォーム
- `src/admin-salon-hours.e2e.test.ts`: キーボードだけで、オーナーが設定の画面の「営業時間を直す」から休業日の行を足して保存し、通知、見出しへのフォーカス、設定の営業日カレンダー、DB の行まで。スマートフォンの幅の、誤りのあるフォーム
- `src/admin-payment-methods.e2e.test.ts`: キーボードだけで、オーナーが設定の「支払い方法を見る」から支払い方法を足し、通知、見出しへのフォーカス、内容の画面、DB の行まで。使うのをやめた支払い方法が、そのあと支払いを記録する画面に出ないこと（売上の画面は、読んだ一覧を 5 分のあいだ使い回すので、書いたあとに一覧を捨てることは、ブラウザーでだけ確かめられる）。スマートフォンの幅の、誤りのあるフォーム
- `src/admin-products.e2e.test.ts`: キーボードだけで、オーナーがヘッダーの「商品」から商品を足し、通知、見出しへのフォーカス、内容の画面、DB の行まで。その間にほかのアカウントが取り扱いをやめた商品が、開き直した台帳に出ること。取り扱いをやめた商品が、そのあと施術記録のフォームの材料に出ないこと（施術記録の画面は、読んだ商品の一覧を 5 分のあいだ使い回すので、書いたあとに一覧を捨てることは、ブラウザーでだけ確かめられる）。スマートフォンの幅の台帳と、誤りのあるフォーム
- `src/admin-inventory.e2e.test.ts`: キーボードだけで、オーナーがヘッダーの「在庫」からロットの行を足し、通知、見出しへのフォーカス、内容の画面、DB の行まで。その間にほかのアカウントが使い切った行が、開き直した期限切れ間近に出ないこと、再読み込みのあとも見かたが残ること、使い切った行の削除。スマートフォンの幅の在庫と、誤りのあるフォーム
- `src/admin-stock-movements.e2e.test.ts`: キーボードだけで、スタイリストが在庫の行から仕入れを記録し、通知、見出しへのフォーカス、履歴の先頭、DB の在庫の移動、開き直した在庫の在庫数まで。履歴を区分で絞り、再読み込みのあとも条件が残ること。スマートフォンの幅の、誤りのあるフォームと履歴
- `src/admin-stock-count.e2e.test.ts`: キーボードだけで、マネージャーが在庫の「棚卸しする」からカラーを数え、通知、見出しへのフォーカス、差のあった行、DB の在庫数と棚卸しの記録、読み直した在庫評価額まで。スマートフォンの幅の、誤りのあるフォームと在庫評価額。その間にほかのアカウントが使った在庫が、開き直した在庫評価額に出ること（アプリは、読んだものを 5 分のあいだ使い回すので、在庫評価額は開くたびに読み直す）
- `src/admin-stock-alerts.e2e.test.ts`: キーボードだけで、スタイリストが在庫の「在庫のアラート」から、カラーの期限切れをメモ付きで確認済みにし、ダイアログのメモの欄へのフォーカス、通知、見出しへのフォーカス、読み直した件数、DB の確認の記録と確認したスタッフまで。スマートフォンの幅の、未確認に絞り込んだ表と、ダイアログ（戻ると何も記録しないこと）
- `src/admin-purchase-orders.e2e.test.ts`: キーボードだけで、スタイリストが在庫からナビゲーションの「発注」へ移り、「発注を作る」からシャンプーの発注を作り、その場の小計、通知、見出しへのフォーカス、明細、DB の発注と作った人、読み直した一覧まで。スマートフォンの幅の、一覧、フォームとその誤り、発注の内容
- `src/admin-purchase-order-steps.e2e.test.ts`: キーボードだけで、オーナーが下書きの承認を依頼し、承認し、発注済みにすること（通知と「状態」へのフォーカス、DB）。取り消しのダイアログのフォーカスと Escape、理由を書いて取り消すこと。スマートフォンの幅の、状態、誤りのある取り消しのダイアログ、直すフォーム
- `src/admin-purchase-order-receipt.e2e.test.ts`: キーボードだけで、オーナーが発注の一覧から発注の提案を開き、ColorTech Japan への発注を提案の数量で作り、発注済みまで進め、入荷を記録すること（見出しへのフォーカス、納品済み、DB の在庫数と発注）。スマートフォンの幅の、誤りのある入荷のフォームと、発注の提案
- `src/admin-reviews.e2e.test.ts`: キーボードだけで、オーナーがレビューの一覧から未返信のレビューを開いて返信し（見出しへのフォーカス、通知、DB）、その返信が portal-app のサロンの詳細に出ること。マネージャーがキーボードだけで通報すること（DB、未処理の通報の件数）。スマートフォンの幅の、レビューの一覧、レビューの内容、誤りのある通報のダイアログ
- `src/admin-attachments.e2e.test.ts`: キーボードだけで、マネージャーが PDF を選び（ファイルを選ぶダイアログ）、ブラウザーからテストサーバーのストレージへ送ってアップロードし（フォームの見出しへのフォーカス、通知、DB）、ファイルの画面から、アップロードした名前で保存すること（中身）。スマートフォンの幅の、ファイルの一覧、ストレージから読んだ画像（読めたこと）、削除のダイアログ
- `src/admin-share-links.e2e.test.ts`: キーボードだけで、マネージャーが、回数の上限とパスワードのある共有リンクを発行し（見出しへのフォーカス、portal のアドレス、DB）、そのアドレスをクリップボードにコピーし、アカウントのない人がそのアドレスを portal の別のタブで開いてパスワードを入れ、ファイルを元の名前で保存すること（中身）。そのあとマネージャーが見る、回数の上限に達した共有リンクと、その取り消し（通知、空になった一覧、DB、もう開けない共有リンク）。スマートフォンの幅の、ファイルの下の共有リンク、発行のフォーム、発行したリンク、取り消しのダイアログ。ファイルは、オーナーが API でストレージへアップロードする（`src/files.ts`）
- `src/dashboard-sales-report.e2e.test.ts`: キーボードだけで、マネージャーが期間を変えて集計し（アドレス）、CSV を保存すること（名前と中身、通知、フォーカス）。管理者がサロンを選んで開く売上レポート。スマートフォンの幅の、売上レポート、サロンを選ぶ画面と売上のない期間
- `src/dashboard-trends.e2e.test.ts`: キーボードだけで、マネージャーが推移を週で集計し（アドレス）、1 日の売上の前の日へ進むこと。ポインターを載せた棒の売上。スマートフォンの幅の、推移と 1 日の売上。今日の会計を入れることは、`src/sales.ts` で 2 つのファイルが共有する
- `src/security.e2e.test.ts`: マイページからアカウントの安全の画面へ移り、キーボードだけでパスワードを変え（Tab で欄を進む順、Enter での送信）、アカウントの安全の画面に戻り、サインアウトして、古いパスワードが断られ、新しいパスワードでサインインできるまで。別のブラウザーでサインインした端末をサインアウトさせ、その端末を読み込み直すとサインインの画面になること、ダイアログからすべての端末でサインアウトするまで（ダイアログを開いたときのフォーカス、ボタンの順、DB の行）。スマートフォンの幅の、改行できない長い User-Agent のある一覧、ダイアログ、誤りのあるフォーム

テストが開いた画面では、アクセシビリティ（WCAG 2.2 AA。ブラウザーが描画するので、色のコントラストを含む）、ページがウィンドウより広くならないこと、要素の中身が、その要素からはみ出さないこと（スクロールする要素と、切り落とす要素を除く）、flex で配置された要素がないことを確かめます（`src/checks.ts`）。

## 関連ドキュメント

- [Type Generation System](./type-generation-system.md)
- [OpenAPI TypeScript 型利用ガイド](./openapi-typescript-usage.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [認証と認可](./authentication.md)
- [Architecture Overview](./architecture-overview.md)
