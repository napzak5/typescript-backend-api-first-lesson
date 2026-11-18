import "@typespec/http";
import "./_shared/common.tsp";
import "./_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    支払い方法区分 - サロンで利用可能な決済手段の種類
    
    cash: 現金 - 現金による支払い
    credit_card: クレジットカード - クレジットカードによる支払い
    debit_card: デビットカード - 銀行口座から直接引き落としのカード支払い
    e_money: 電子マネー - Suica、PASMO等の電子マネーによる支払い
    qr_payment: QRコード決済 - PayPay、LINE Pay等のQRコード決済
    bank_transfer: 銀行振込 - 銀行口座への振込による支払い
    point: ポイント - サロンのポイントを使用した支払い
    """)
  enum PaymentMethodType {
    cash,
    credit_card,
    debit_card,
    e_money,
    qr_payment,
    bank_transfer,
    point,
  }

  @doc("""
    支払いステータス区分 - 決済取引(payment_transactions.status)と売上(sales.paymentStatus)の支払いの進行状態を表す区分
    
    pending: 支払い待ち - 売上では、何も受け取っていない状態
    processing: 処理中 - 売上では、合計金額の一部を受け取った状態
    completed: 完了 - 決済取引では、支払いを受け取った状態。売上では、合計金額を受け取った状態
    failed: 失敗 - 支払い処理が失敗した状態
    refunded: 返金済み - 決済取引では、全額を返金した状態。売上では、受け取った全額を返金した状態
    partial_refund: 部分返金 - 決済取引では、一部を返金した状態。売上では、受け取った金額の一部を返金した状態
    
    API が決済取引に書くのは completed・refunded・partial_refund だけで、売上に failed は書かない
    """)
  enum PaymentStatusType {
    pending,
    processing,
    completed,
    failed,
    refunded,
    partial_refund,
  }

  @doc("""
    ポイント取引種別区分 - 顧客ポイントの増減(customer_points の1行)の種類
    
    earned: 獲得 - 来店や購入などでポイントを付与した取引
    used: 利用 - 支払いなどでポイントを使用した取引
    expired: 失効 - 有効期限を過ぎたポイントを失効させた取引
    adjusted: 調整 - スタッフが手動でポイントを増減した取引
    transferred: 移行 - 顧客の統合で、統合して削除する顧客(サブ)の残高を、残す顧客(メイン)に移した取引。サブは残高を 0 にする負の取引、メインは残っている付与ごとの正の取引
    """)
  enum PointTransactionType {
    earned,
    used,
    expired,
    adjusted,
    transferred,
  }

  @doc("""
    ポイント取引の参照先区分 - ポイント取引のもとになった記録の種類(customer_points.referenceType)
    
    sale: 売上 - referenceId は売上の ID
    booking: 予約 - referenceId は予約の ID
    customer: 顧客 - 移行(transferred)の取引だけが持つ。referenceId は、ポイントを移した相手の顧客の ID
    """)
  enum PointReferenceType {
    sale,
    booking,
    customer,
  }

  @doc("""
    ポイントの付与・利用・調整の参照先区分 - リクエストで指定できる、ポイント取引のもとになった記録の種類
    
    sale: 売上 - referenceId は売上の ID
    booking: 予約 - referenceId は予約の ID
    """)
  enum PointMovementReferenceType {
    sale,
    booking,
  }

  // ---------------------------------------------------------------------------
  // 売上 (sales、sales_details)
  // ---------------------------------------------------------------------------

  @doc("""
    売上明細 - sales_details テーブルの1行。会計の1項目(サービス・商品など)を表す。
    売上の登録・更新リクエストとレスポンスで共通に使う。プロパティ名と null 許可は DB カラムと一致させている
    """)
  model SalesDetail {
    @doc("明細の種類。service(サービス)、product(商品)など。空白だけの文字列は指定できない")
    @minLength(1)
    @maxLength(50)
    itemType: string;

    @doc("itemType が service の明細では売上のサロンのサービスの ID、product の明細では売上のサロンの商品の ID。それ以外の itemType の明細と、手入力の項目など対象の記録がない明細の場合はnull")
    @format("uuid")
    itemId: string | null;

    @doc("明細名。会計時点の名称を記録する")
    @minLength(1)
    @maxLength(255)
    itemName: string;

    @doc("数量")
    @minValue(1)
    quantity: int32;

    @doc("税抜の単価")
    @minValue(0)
    unitPrice: int32;

    @doc("明細の値引額。quantity × unitPrice 以下")
    @minValue(0)
    discountAmount: int32;

    @doc("明細の消費税額")
    @minValue(0)
    taxAmount: int32;

    @doc("明細の税込合計金額。quantity × unitPrice - discountAmount + taxAmount と一致する必要がある")
    @minValue(0)
    totalAmount: int32;

    @doc("明細を担当したスタッフの ID。売上と同じサロンのスタッフを指定する。担当者を記録しない場合はnull")
    staffId: StaffId | null;

    @doc("担当スタッフの歩合率(%)。小数第2位まで。歩合を記録しない場合はnull")
    @minValue(0)
    @maxValue(100)
    commissionRate: float64 | null;

    @doc("担当スタッフの歩合額。歩合を記録しない場合はnull")
    @minValue(0)
    commissionAmount: int32 | null;

    @doc("明細の備考。未設定の場合はnull")
    notes: string | null;

    @doc("表示順序。1件の売上の明細の間で重複しない")
    @minValue(0)
    sortOrder: int32;
  }

  @doc("""
    売上レスポンス - sales テーブルの全カラムと、売上明細(sales_details)・決済取引(payment_transactions)を返す。
    1件の売上は1回の来店の会計を表す。プロパティ名と null 許可は DB カラムと一致させている
    """)
  model SaleResponse {
    @doc("売上 ID")
    id: SaleId;

    @doc("売上番号。システムが採番し、すべての売上の間で一意")
    saleNumber: string;

    @doc("会計を行ったサロン ID")
    salonId: SalonId;

    @doc("会計した顧客の ID。顧客登録のない来店客の場合はnull")
    customerId: CustomerId | null;

    @doc("会計を担当したスタッフの ID。担当者を記録しない場合はnull")
    staffId: StaffId | null;

    @doc("売上のもとになった予約の ID。予約のない来店の場合はnull")
    bookingId: BookingId | null;

    @doc("売上日。saleTime のサロンのタイムゾーンでの日付")
    saleDate: plainDate;

    @doc("会計日時")
    saleTime: utcDateTime;

    @doc("小計。明細の quantity × unitPrice の合計")
    subtotal: int32;

    @doc("値引額。明細の discountAmount の合計")
    discountAmount: int32;

    @doc("消費税額。明細の taxAmount の合計")
    taxAmount: int32;

    @doc("合計金額。明細の totalAmount の合計")
    totalAmount: int32;

    @doc("この会計で利用したポイント数。記録していない場合はnull")
    pointsUsed: int32 | null;

    @doc("この会計で付与したポイント数。記録していない場合はnull")
    pointsEarned: int32 | null;

    @doc("支払い状態。この売上の決済取引(payments)から決まり、支払いの記録と返金のたびにシステムが更新する。pending は何も受け取っていない、processing は合計金額の一部を受け取った、completed は合計金額を受け取った、partial_refund は受け取った金額の一部を返金した、refunded は受け取った全額を返金した状態")
    paymentStatus: PaymentStatusType;

    @doc("取り消された売上かどうか")
    isVoid: boolean;

    @doc("売上を取り消した日時。取り消していない場合はnull")
    voidedAt: utcDateTime | null;

    @doc("取消理由。取り消していない場合、または理由を記録していない場合はnull")
    voidReason: string | null;

    @doc("備考。未設定の場合はnull")
    notes: string | null;

    @doc("売上明細の一覧。sortOrder の昇順で並ぶ")
    details: SalesDetail[];

    @doc("この売上に対する決済取引の一覧。作成日時の昇順で並ぶ。支払いがない場合は空配列")
    payments: PaymentResponse[];

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    売上登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    売上番号・売上日・小計・値引額・消費税額・合計金額・支払い状態はシステムが設定する
    """)
  model SaleCreateRequest {
    @doc("会計を行うサロン ID")
    salonId: SalonId;

    @doc("会計する顧客の ID。顧客登録のない来店客の場合はnull")
    customerId: CustomerId | null;

    @doc("会計を担当するスタッフの ID。salonId のサロンのスタッフを指定する。担当者を記録しない場合はnull")
    staffId: StaffId | null;

    @doc("売上のもとになる予約の ID。salonId のサロンの、customerId の顧客の予約を指定する。1件の予約に対して、取り消していない売上は1件まで。予約のない来店の場合はnull")
    bookingId: BookingId | null;

    @doc("会計日時。UTC の日付で 1900-01-01 から 2999-12-31 まで")
    saleTime: utcDateTime;

    @doc("この会計で利用したポイント数。記録しない場合はnull。customerId がnullの場合はnull")
    @minValue(0)
    pointsUsed: int32 | null;

    @doc("この会計で付与したポイント数。記録しない場合はnull。customerId がnullの場合はnull")
    @minValue(0)
    pointsEarned: int32 | null;

    @doc("備考。未設定の場合はnull")
    notes: string | null;

    @doc("売上明細の一覧。1件以上100件以下")
    @minItems(1)
    @maxItems(100)
    details: SalesDetail[];
  }

  @doc("""
    売上部分更新リクエスト - 指定した項目だけを更新する。項目を1つ以上指定する。DB で NULL 許可のカラムは null でクリアできる。
    サロンは変更できない。details を指定した場合は明細全体を置き換え、小計・値引額・消費税額・合計金額を再計算する。
    指定しなかった項目は、いまの値のまま、更新後の売上の規則(顧客のいない売上はポイントを持たない、予約の顧客は売上の顧客と同じ)を確かめる
    """)
  model SaleUpdateRequest {
    @doc("会計した顧客の ID。売上が予約を持つ場合は、その予約の顧客を指定する。nullでクリア(pointsUsed と pointsEarned が null の売上だけ)")
    customerId?: CustomerId | null;

    @doc("会計を担当したスタッフの ID。売上と同じサロンのスタッフを指定する。nullでクリア")
    staffId?: StaffId | null;

    @doc("売上のもとになった予約の ID。売上と同じサロンの、売上の顧客の予約で、ほかの取り消していない売上がないものを指定する。nullでクリア")
    bookingId?: BookingId | null;

    @doc("会計日時。変更すると saleDate も再計算する。UTC の日付で 1900-01-01 から 2999-12-31 まで")
    saleTime?: utcDateTime;

    @doc("この会計で利用したポイント数。nullでクリア")
    @minValue(0)
    pointsUsed?: int32 | null;

    @doc("この会計で付与したポイント数。nullでクリア")
    @minValue(0)
    pointsEarned?: int32 | null;

    @doc("備考。nullでクリア")
    notes?: string | null;

    @doc("売上明細の一覧。指定した場合は全件を置き換える。1件以上100件以下")
    @minItems(1)
    @maxItems(100)
    details?: SalesDetail[];
  }

  @doc("""
    売上一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model SaleSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("サロン ID による絞り込み(完全一致)")
    salonId?: SalonId;

    @query
    @doc("顧客 ID による絞り込み(完全一致)")
    customerId?: CustomerId;

    @query
    @doc("予約 ID による絞り込み(完全一致)")
    bookingId?: BookingId;

    @query
    @doc("支払い状態による絞り込み(完全一致)")
    paymentStatus?: PaymentStatusType;

    @query
    @doc("売上日(saleDate)の下限。この日付以降の売上に一致する。1900-01-01 から 2999-12-31 まで")
    startDate?: plainDate;

    @query
    @doc("売上日(saleDate)の上限。この日付以前の売上に一致する。1900-01-01 から 2999-12-31 まで")
    endDate?: plainDate;
  }

  @doc("売上取消リクエスト - 売上を取り消す理由を指定する。キーは必須")
  model SaleVoidRequest {
    @doc("取消理由。空白だけの文字列は指定できない。理由を記録しない場合はnull")
    voidReason: string | null;
  }

  @doc("""
    売上の支払いリクエスト - 売上に対して受け取った1回の支払い(決済取引)の内容を指定する。全項目のキーが必須。
    取引番号・処理日時・状態はシステムが設定する
    """)
  model SaleProcessRequest {
    @doc("支払い方法の ID。売上と同じサロンの有効な支払い方法を指定する")
    paymentMethodId: PaymentMethodId;

    @doc("支払金額。売上の未払い残額以下で、支払い方法に minimumAmount・maximumAmount がある場合はその範囲内")
    @minValue(1)
    amount: int32;

    @doc("カード番号の下4桁(数字4桁)。支払い方法の区分が credit_card または debit_card の場合だけ指定できる。記録しない場合と、カード以外の支払いの場合はnull")
    @pattern("^[0-9]{4}$")
    cardLastFour: string | null;

    @doc("カードブランド(Visa など)。空白だけの文字列は指定できない。支払い方法の区分が credit_card または debit_card の場合だけ指定できる。記録しない場合と、カード以外の支払いの場合はnull")
    @maxLength(50)
    cardBrand: string | null;
  }

  @doc("""
    売上のレシート - 売上とその明細・決済取引から作成するレシートの内容。
    レシートは記録せず、呼び出すたびに同じ売上から作り直す(再発行)
    """)
  model SaleReceiptResponse {
    @doc("レシート番号。売上番号(saleNumber)と同じで、再発行しても変わらない")
    receiptNumber: string;

    @doc("レシートの対象となる売上。明細(details)と決済取引(payments)を含む。売上の取得と同じ内容")
    sale: SaleResponse;

    @doc("レシートを作成した日時。再発行すると変わる")
    issuedAt: utcDateTime;
  }

  @doc("""
    会計金額の試算リクエスト - 予約のサービス明細と、加えるサービスから、売上を登録する前に請求額を試算する。
    全項目のキーが必須
    """)
  model SaleCalculateRequest {
    @doc("会計を行うサロン ID。消費税率と支払い方法は、このサロンのものを使う")
    salonId: SalonId;

    @doc("会計する予約の ID。salonId のサロンの予約を指定する。予約のサービス明細を、明細に写した価格で数える。予約のない来店の場合はnull")
    bookingId: BookingId | null;

    @doc("予約のサービス明細に加えるサービスの ID の一覧。salonId のサロンの、削除されていないサービスを指定する。いまのメニューの価格で数える。同じIDを複数回指定すると、その回数だけ数える。0件以上100件以下で、予約のサービス明細と合わせて1件以上")
    @maxItems(100)
    services: ServiceId[];
  }

  @doc("""
    試算した請求金額の内訳 - 売上を登録したときに、売上の小計・値引額・消費税額・合計金額になる値。
    プロパティ名は sales テーブルのカラムと一致させている
    """)
  model SaleBreakdownResponse {
    @doc("小計。明細の価格の合計")
    subtotal: int32;

    @doc("値引額。サービスに割引価格(discountPrice)があれば、価格との差額の合計")
    discountAmount: int32;

    @doc("消費税額。税込みでない明細の割引後の金額の合計に、サロンの税率を掛けて1円未満を切り捨てた額。明細ごとではなく、合計に対して1回だけ計算する")
    taxAmount: int32;

    @doc("合計金額。subtotal - discountAmount + taxAmount")
    totalAmount: int32;
  }

  @doc("会計金額の試算結果 - 売上を登録する前の請求金額の見積もり。何も記録しない")
  model SaleCalculateResponse {
    @doc("試算の対象となるサロン ID")
    salonId: SalonId;

    @doc("試算の対象となる予約の ID。予約を指定しなかった場合はnull")
    bookingId: BookingId | null;

    @doc("請求金額の内訳")
    breakdown: SaleBreakdownResponse;

    @doc("合計金額を1回の支払いで受け取れる支払い方法区分の一覧。サロンの有効な支払い方法のうち、合計金額が minimumAmount 以上 maximumAmount 以下のものの区分を、sortOrder とIDの順に、同じ区分は1回だけ並べる。合計金額が0の場合は空")
    recommendedMethods: PaymentMethodType[];
  }

  // ---------------------------------------------------------------------------
  // 支払い方法 (payment_methods)
  // ---------------------------------------------------------------------------

  @doc("""
    支払い方法レスポンス - payment_methods テーブルの1行。サロンが会計で使う支払い方法を表す。
    決済代行会社との接続設定(processorConfig)は返さない。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model PaymentMethodResponse {
    @doc("支払い方法 ID")
    id: PaymentMethodId;

    @doc("支払い方法を持つサロン ID")
    salonId: SalonId;

    @doc("支払い方法区分。登録のあとは変わらない")
    method: PaymentMethodType;

    @doc("表示名")
    displayName: string;

    @doc("説明。未設定の場合はnull")
    description: string | null;

    @doc("決済代行会社の名称。決済代行会社を介さない場合、または記録していない場合はnull")
    processorName: string | null;

    @doc("決済手数料率(%)。記録していない場合はnull")
    fee: float64 | null;

    @doc("この支払い方法で受け付ける1回の支払いの最小金額。下限がない場合はnull")
    minimumAmount: int32 | null;

    @doc("この支払い方法で受け付ける1回の支払いの最大金額。上限がない場合はnull")
    maximumAmount: int32 | null;

    @doc("オンラインの決済で使えるか")
    isOnlineEnabled: boolean;

    @doc("店頭の会計で使えるか")
    isOfflineEnabled: boolean;

    @doc("表示順序")
    sortOrder: int32;

    @doc("有効フラグ。無効な支払い方法は新しい支払いに使えない")
    isActive: boolean;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    支払い方法新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    支払い方法を持つサロンはパスの salonId で指定する。決済代行会社との接続設定(processorConfig)は指定できない
    """)
  model PaymentMethodCreateRequest {
    @doc("支払い方法区分。登録のあとは変えられない")
    method: PaymentMethodType;

    @doc("表示名。空白だけの文字列は指定できない")
    @minLength(1)
    @maxLength(100)
    displayName: string;

    @doc("説明。空白だけの文字列は指定できない。未設定の場合はnull")
    description: string | null;

    @doc("決済代行会社の名称。空白だけの文字列は指定できない。決済代行会社を介さない場合、または記録しない場合はnull")
    @maxLength(100)
    processorName: string | null;

    @doc("決済手数料率(%)。小数第2位まで。記録しない場合はnull")
    @minValue(0)
    @maxValue(100)
    fee: float64 | null;

    @doc("この支払い方法で受け付ける1回の支払いの最小金額。maximumAmount 以下。下限がない場合はnull")
    @minValue(1)
    minimumAmount: int32 | null;

    @doc("この支払い方法で受け付ける1回の支払いの最大金額。minimumAmount 以上。上限がない場合はnull")
    @minValue(1)
    maximumAmount: int32 | null;

    @doc("オンラインの決済で使えるか")
    isOnlineEnabled: boolean;

    @doc("店頭の会計で使えるか")
    isOfflineEnabled: boolean;

    @doc("表示順序")
    @minValue(0)
    sortOrder: int32;

    @doc("有効フラグ")
    isActive: boolean;
  }

  @doc("""
    支払い方法部分更新リクエスト - 指定した項目だけを更新する。項目を1つも指定しないリクエストは受け付けない。
    DB で NULL 許可のカラムは null でクリアできる。支払い方法を持つサロンと支払い方法区分(method)は変更できない
    """)
  model PaymentMethodUpdateRequest {
    @doc("表示名。空白だけの文字列は指定できない")
    @minLength(1)
    @maxLength(100)
    displayName?: string;

    @doc("説明。空白だけの文字列は指定できない。nullでクリア")
    description?: string | null;

    @doc("決済代行会社の名称。空白だけの文字列は指定できない。nullでクリア")
    @maxLength(100)
    processorName?: string | null;

    @doc("決済手数料率(%)。小数第2位まで。nullでクリア")
    @minValue(0)
    @maxValue(100)
    fee?: float64 | null;

    @doc("この支払い方法で受け付ける1回の支払いの最小金額。更新後の maximumAmount 以下。nullでクリア(下限がなくなる)")
    @minValue(1)
    minimumAmount?: int32 | null;

    @doc("この支払い方法で受け付ける1回の支払いの最大金額。更新後の minimumAmount 以上。nullでクリア(上限がなくなる)")
    @minValue(1)
    maximumAmount?: int32 | null;

    @doc("オンラインの決済で使えるか")
    isOnlineEnabled?: boolean;

    @doc("店頭の会計で使えるか")
    isOfflineEnabled?: boolean;

    @doc("表示順序")
    @minValue(0)
    sortOrder?: int32;

    @doc("有効フラグ")
    isActive?: boolean;
  }

  @doc("""
    支払い方法一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model PaymentMethodSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("支払い方法区分による絞り込み(完全一致)")
    method?: PaymentMethodType;

    @query
    @doc("有効フラグによる絞り込み。指定しない場合は無効な支払い方法も返す")
    isActive?: boolean;
  }

  // ---------------------------------------------------------------------------
  // 決済取引 (payment_transactions)
  // ---------------------------------------------------------------------------

  @doc("""
    決済取引レスポンス - payment_transactions テーブルの1行。売上に対して受け取った1回の支払いを表す。
    決済代行会社の応答(processorResponse)と構造の定まっていない metadata は返さない。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model PaymentResponse {
    @doc("決済取引 ID")
    id: PaymentId;

    @doc("支払いの対象となる売上 ID")
    saleId: SaleId;

    @doc("使用した支払い方法の ID")
    paymentMethodId: PaymentMethodId;

    @doc("取引番号。システムが採番し、すべての決済取引の間で一意")
    transactionNumber: string;

    @doc("支払金額")
    amount: int32;

    @doc("決済の状態。completed は受け取った、refunded は全額を返金した、partial_refund は一部を返金した状態。API が記録する決済取引は、この3つのどれか")
    status: PaymentStatusType;

    @doc("決済代行会社の取引 ID。決済代行会社とは接続していないので、API が記録した決済取引ではnull")
    processorTransactionId: string | null;

    @doc("カード番号の下4桁。カード以外の支払いの場合はnull")
    cardLastFour: string | null;

    @doc("カードブランド。カード以外の支払いの場合はnull")
    cardBrand: string | null;

    @doc("決済が失敗したときのエラーコード。失敗していない場合はnull")
    errorCode: string | null;

    @doc("決済が失敗したときのエラーメッセージ。失敗していない場合はnull")
    errorMessage: string | null;

    @doc("支払いを受け取ったものとして記録した日時。受け取っていない決済取引の場合はnull")
    processedAt: utcDateTime | null;

    @doc("決済が失敗した日時。失敗していない場合はnull")
    failedAt: utcDateTime | null;

    @doc("返金した日時。返金していない場合はnull")
    refundedAt: utcDateTime | null;

    @doc("返金額。返金していない場合はnull")
    refundAmount: int32 | null;

    @doc("返金理由。返金していない場合、または理由を記録していない場合はnull")
    refundReason: string | null;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("決済取引の返金リクエスト - 返金額と理由を指定する。全項目のキーが必須")
  model PaymentRefundRequest {
    @doc("返金額。決済取引の amount 以下。amount と等しい場合は全額返金、少ない場合は部分返金になる")
    @minValue(1)
    refundAmount: int32;

    @doc("返金理由。空白だけの文字列は指定できない。理由を記録しない場合はnull")
    refundReason: string | null;
  }

  // ---------------------------------------------------------------------------
  // ポイント (customer_points)
  // ---------------------------------------------------------------------------

  @doc("""
    ポイント取引レスポンス - customer_points テーブルの1行。顧客ポイントの1回の増減と、その後の残高を表す。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model PointTransactionResponse {
    @doc("ポイント取引 ID")
    id: PointTransactionId;

    @doc("対象顧客の ID")
    customerId: CustomerId;

    @doc("取引の種別")
    transactionType: PointTransactionType;

    @doc("ポイントの変動量。獲得は正、利用・失効は負の値、調整・移行は0以外の値")
    points: int32;

    @doc("この取引の後のポイント残高。0 以上")
    balance: int32;

    @doc("取引内容の説明。未設定の場合はnull")
    description: string | null;

    @doc("取引のもとになった記録の種類。参照する記録がない場合はnull")
    referenceType: PointReferenceType | null;

    @doc("取引のもとになった記録の ID。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;

    @doc("ポイントの有効期限(この日まで使える)。付与(earned)と、メインに移した移行(transferred)の取引だけが持つ。移行の取引は、移したもとの付与の有効期限を引き継ぐ。有効期限のない付与・移行と、ほかの取引はnull")
    expiryDate: plainDate | null;

    @doc("取引の発生日時")
    createdAt: utcDateTime;
  }

  @doc("""
    ポイント取引の一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model PointTransactionSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する。その顧客のポイント取引の ID でなければならない")
    cursor?: PointTransactionId;

    @query
    @doc("取引の発生日時(createdAt)の下限。この日時以降の取引に一致する。UTC の日付で 1900-01-01 から 2999-12-31 まで")
    startDate?: utcDateTime;

    @query
    @doc("取引の発生日時(createdAt)の上限。この日時以前の取引に一致する。startDate より前の日時は指定できない。UTC の日付で 1900-01-01 から 2999-12-31 まで")
    endDate?: utcDateTime;
  }

  @doc("""
    ポイント残高レスポンス - 顧客の残高(customers.loyaltyPoints)を返す。
    残高は最新のポイント取引(customer_points)の balance と等しく、ポイント取引のない顧客の残高は 0
    """)
  model PointBalanceResponse {
    @doc("対象顧客の ID")
    customerId: CustomerId;

    @doc("現在のポイント残高")
    balance: int32;
  }

  @doc("""
    ポイント付与リクエスト - 種別 earned のポイント取引を登録する。全項目のキーが必須。
    DB で NULL 許可のカラムのみ null を指定できる。残高はシステムが計算する
    """)
  model PointEarnRequest {
    @doc("ポイントを付与する顧客の ID")
    customerId: CustomerId;

    @doc("付与するポイント数。付与の後の残高が 2,147,483,647 を超える値は指定できない")
    @minValue(1)
    points: int32;

    @doc("付与の理由。空白だけの文字列は指定できない。未設定の場合はnull")
    description: string | null;

    @doc("付与のもとになった記録の種類。referenceId と同時に指定する。参照する記録がない場合はnull")
    referenceType: PointMovementReferenceType | null;

    @doc("付与のもとになった記録の ID。referenceType と同時に指定する。その顧客の売上・予約で、取り消した売上と、ステータスが draft・cancelled・no_show の予約は指定できない。1 つの記録に付与できるのは1回。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;

    @doc("付与したポイントの有効期限(この日まで使える)。昨日(UTC)より前の日付は指定できない。有効期限を設けない場合はnull。1900-01-01 から 2999-12-31 まで")
    expiryDate: plainDate | null;
  }

  @doc("""
    ポイント利用リクエスト - 種別 used のポイント取引を登録する。全項目のキーが必須。
    DB で NULL 許可のカラムのみ null を指定できる。残高はシステムが計算する
    """)
  model PointUseRequest {
    @doc("ポイントを利用する顧客の ID")
    customerId: CustomerId;

    @doc("利用するポイント数。現在の残高以下。ポイント取引には負の値で記録する")
    @minValue(1)
    points: int32;

    @doc("利用の理由。空白だけの文字列は指定できない。未設定の場合はnull")
    description: string | null;

    @doc("利用のもとになった記録の種類。referenceId と同時に指定する。参照する記録がない場合はnull")
    referenceType: PointMovementReferenceType | null;

    @doc("利用のもとになった記録の ID。referenceType と同時に指定する。その顧客の売上・予約で、取り消した売上と、ステータスが draft・cancelled・no_show の予約は指定できない。1 つの記録で利用できるのは1回。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;
  }

  @doc("""
    ポイント調整リクエスト - 種別 adjusted のポイント取引を登録する。全項目のキーが必須。
    DB で NULL 許可のカラムのみ null を指定できる。残高はシステムが計算する
    """)
  model PointAdjustRequest {
    @doc("ポイントを調整する顧客の ID")
    customerId: CustomerId;

    @doc("調整するポイント数。増やす場合は正、減らす場合は負の値で、0 は指定できない。調整後の残高が負になる値と、2,147,483,647 を超える値は指定できない")
    points: int32;

    @doc("調整の理由。空白だけの文字列は指定できない。未設定の場合はnull")
    description: string | null;

    @doc("調整のもとになった記録の種類。referenceId と同時に指定する。参照する記録がない場合はnull")
    referenceType: PointMovementReferenceType | null;

    @doc("調整のもとになった記録の ID。referenceType と同時に指定する。その顧客の売上・予約で、取り消した売上やキャンセルした予約も指定できる。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;
  }

  @doc("失効予定ポイントの集計結果 - 有効期限が近い獲得ポイント(顧客の統合で移したものを含む)のうち、使われずに残っているポイントの合計と、その取引の一覧")
  model PointExpiringResponse {
    @doc("対象顧客の ID")
    customerId: CustomerId;

    @doc("有効期限が期間内(期限を過ぎて、まだ失効させていないものを含む)の獲得ポイントのうち、使われずに残っているポイント数の合計。残高を超えない")
    expiringPoints: int32;

    @doc("transactions の中で最も早い有効期限。該当するポイントがない場合はnull")
    expirationDate: plainDate | null;

    @doc("使われずに残っているポイントのある、有効期限が期間内の獲得(earned)と、顧客の統合で獲得の残りを移した移行(transferred)の取引の一覧。expiryDate の昇順で、同じ日付なら登録の古い順に並ぶ。各取引の points は獲得した、または移したポイント数で、残っている数ではない")
    transactions: PointTransactionResponse[];
  }

  @doc("ポイント失効処理リクエスト - 有効期限を過ぎたポイントを失効させる対象を指定する。全項目のキーが必須")
  model PointExpireRequest {
    @doc("対象顧客の ID。削除されていないすべての顧客を処理する場合はnull")
    customerId: CustomerId | null;

    @doc("有効期限がこの日付より前の獲得ポイントを失効させる。昨日(UTC)以前の日付で、null の場合は昨日(UTC)。有効期限は、その日まで使える日付で、付与は昨日(UTC)以降の有効期限を受け付けるため、どのタイムゾーンでも、有効期限の日が終わる前には失効しない。1900-01-01 から 2999-12-31 まで")
    processBefore: plainDate | null;
  }

  @doc("ポイント失効処理の結果")
  model PointExpireResponse {
    @doc("登録した失効(expired)のポイント取引の件数。ポイントを失効させた顧客の数と等しい")
    processedCount: int32;

    @doc("失効させたポイントの合計(0 以上)。すべての顧客の合計は int32 に収まらないことがあるため int64")
    totalPoints: int64;
  }

  // ---------------------------------------------------------------------------
  // 売上レポート (sales、sales_details、payment_transactions をリクエストのたびに集計する。対応するテーブルはない)
  // 金額はサロンの通貨(salons.currency)の整数値
  // ---------------------------------------------------------------------------

  @doc("""
    売上レポートの集計条件 - サロンと、売上日(saleDate)の期間を指定する。期間は両端を含み、366日まで
    """)
  model SalesReportGetRequest {
    @query
    @doc("集計対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("期間の最初の売上日(saleDate)。1900-01-01 から 2999-12-31 まで")
    startDate: plainDate;

    @query
    @doc("期間の最後の売上日(saleDate)。startDate 以降で、期間は startDate を含めて366日まで。1900-01-01 から 2999-12-31 まで")
    endDate: plainDate;
  }

  @doc("1日の売上の集計条件 - サロンと売上日(saleDate)を指定する")
  model DailySalesGetRequest {
    @query
    @doc("集計対象のサロン ID")
    salonId: SalonId;

    @query
    @doc("集計対象の売上日(saleDate)。1900-01-01 から 2999-12-31 まで")
    date: plainDate;
  }

  @doc("""
    売上推移区切り区分 - 売上推移の期間を区切る単位
    
    daily: 日 - 1日ごと。ラベルは YYYY-MM-DD
    weekly: 週 - 月曜日に始まる週ごと。ラベルは週の月曜日の YYYY-MM-DD
    monthly: 月 - 暦の月ごと。ラベルは YYYY-MM
    """)
  enum SalesTrendPeriodType {
    daily,
    weekly,
    monthly,
  }

  @doc("売上推移の集計条件 - 売上レポートの集計条件に、区切りの単位を加える")
  model SalesTrendsGetRequest {
    ...SalesReportGetRequest;

    @query
    @doc("区切りの単位")
    period: SalesTrendPeriodType;
  }

  @doc("""
    期間の売上レポート - サロンの、取り消していない売上のうち、売上日(saleDate)が期間内のものを集計する。支払いが済んでいない売上も数える。返金は、いつ返金したかによらず、返金した決済取引の売上の売上日の側で数える
    """)
  model SalesReportResponse {
    @doc("対象サロン ID")
    salonId: SalonId;

    @doc("期間の最初の売上日")
    startDate: plainDate;

    @doc("期間の最後の売上日")
    endDate: plainDate;

    @doc("売上の合計金額(totalAmount。税込み)の合計")
    totalSales: int64;

    @doc("売上の消費税額(taxAmount)の合計")
    totalTax: int64;

    @doc("売上の値引額(discountAmount)の合計")
    totalDiscounts: int64;

    @doc("売上の決済取引の返金額(refundAmount)の合計")
    totalRefunds: int64;

    @doc("totalSales から totalRefunds を引いた額")
    netSales: int64;

    @doc("売上の件数")
    transactionCount: int32;

    @doc("totalSales を transactionCount で割った額(1円未満を切り捨て)。売上がなければ0")
    averageTransactionValue: int64;

    @doc("支払い方法の区分ごとの入金。amount の多い順、同じなら区分の名前の順")
    salesByMethod: SalesByMethodResponse[];

    @doc("サービスのカテゴリーの区分ごとの売上。amount の多い順、同じなら区分の名前の順")
    salesByCategory: SalesByCategoryResponse[];

    @doc("スタッフ別の売上の上位5人(getByStaff の最初の5行)")
    topStaff: SalesByStaffResponse[];
  }

  @doc("""
    支払い方法の区分ごとの入金 - 売上の決済取引のうち、受け取ったもの(status が completed・partial_refund・refunded)を、支払い方法の区分ごとに合わせる
    """)
  model SalesByMethodResponse {
    @doc("支払い方法区分")
    method: PaymentMethodType;

    @doc("決済取引の金額(amount)から返金額(refundAmount)を引いた額の合計")
    amount: int64;

    @doc("決済取引の件数")
    count: int32;

    @doc("内訳のすべての行の amount の合計に対する割合(%)。小数第1位に丸める。合計が0なら0")
    percentage: float32;
  }

  @doc("""
    サービスのカテゴリーの区分ごとの売上 - 売上の明細のうち、itemType が service のものを、サービスのカテゴリーの区分(service_categories.category のいまの値)ごとに合わせる。カテゴリーのないサービスの明細と、itemId のない明細は other。サービスでない明細(商品、指名料など)は数えない
    """)
  model SalesByCategoryResponse {
    @doc("サービスカテゴリ区分")
    category: ServiceCategoryType;

    @doc("明細の合計金額(totalAmount)の合計")
    amount: int64;

    @doc("明細の数量(quantity)の合計")
    count: int32;

    @doc("内訳のすべての行の amount の合計に対する割合(%)。小数第1位に丸める。合計が0なら0")
    percentage: float32;
  }

  @doc("""
    スタッフ別の売上 - 売上の明細を、明細の担当スタッフ(staffId)ごとに合わせる。明細に担当スタッフがなければ、売上の担当スタッフの明細として数え、どちらもない明細は数えない。削除したスタッフも載る
    """)
  model SalesByStaffResponse {
    @doc("スタッフ ID")
    staffId: StaffId;

    @doc("スタッフの表示名(staff.displayName のいまの値)")
    displayName: string;

    @doc("担当した明細の合計金額(totalAmount)の合計")
    totalSales: int64;

    @doc("担当した、itemType が service の明細の数量(quantity)の合計")
    serviceCount: int32;

    @doc("担当した service の明細の合計金額の合計を serviceCount で割った額(1円未満を切り捨て)。service の明細がなければ0")
    averageServiceValue: int64;
  }

  @doc("1日の売上 - その売上日の、取り消していない売上を集計する")
  model DailySalesResponse {
    @doc("売上日")
    date: plainDate;

    @doc("売上の合計金額(totalAmount)の合計")
    sales: int64;

    @doc("売上の件数")
    transactions: int32;

    @doc("その日の売上の決済取引の返金額(refundAmount)の合計")
    refunds: int64;

    @doc("sales から refunds を引いた額")
    net: int64;
  }

  @doc("""
    売上推移 - 期間を区切った単位ごとの、取り消していない売上の時系列。各配列の同じ位置が同じ区切りを表す。最初と最後の区切りは期間の中の売上だけを数え、売上のない区切りも0で載せる
    """)
  model SalesTrendsResponse {
    @doc("各区切りのラベル(SalesTrendPeriodType の説明を参照)")
    labels: string[];

    @doc("各区切りの売上の合計金額(totalAmount)の合計")
    sales: int64[];

    @doc("各区切りの売上の件数")
    transactions: int32[];

    @doc("各区切りの sales を transactions で割った額(1円未満を切り捨て)。売上がなければ0")
    average: int64[];
  }
}
