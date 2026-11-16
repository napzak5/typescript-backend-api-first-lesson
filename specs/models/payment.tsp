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
    
    pending: 支払い待ち - 支払いが開始されたがまだ完了していない状態
    processing: 処理中 - 決済処理が進行中の状態
    completed: 完了 - 支払いが正常に完了した状態
    failed: 失敗 - 支払い処理が失敗した状態
    refunded: 返金済み - 全額返金が完了した状態
    partial_refund: 部分返金 - 一部金額の返金が完了した状態
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
    transferred: 移行 - 別の顧客との間でポイントを移した取引
    """)
  enum PointTransactionType {
    earned,
    used,
    expired,
    adjusted,
    transferred,
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

    @doc("支払い状態。決済取引(payments)の処理と返金に応じてシステムが更新する")
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

    @doc("会計日時")
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
    売上部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    サロンは変更できない。details を指定した場合は明細全体を置き換え、小計・値引額・消費税額・合計金額を再計算する
    """)
  model SaleUpdateRequest {
    @doc("会計した顧客の ID。nullでクリア")
    customerId?: CustomerId | null;

    @doc("会計を担当したスタッフの ID。売上と同じサロンのスタッフを指定する。nullでクリア")
    staffId?: StaffId | null;

    @doc("売上のもとになった予約の ID。売上と同じサロンの予約を指定する。nullでクリア")
    bookingId?: BookingId | null;

    @doc("会計日時。変更すると saleDate も再計算する")
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
    @doc("売上日(saleDate)の下限。この日付以降の売上に一致する")
    startDate?: plainDate;

    @query
    @doc("売上日(saleDate)の上限。この日付以前の売上に一致する")
    endDate?: plainDate;
  }

  @doc("売上取消リクエスト - 売上を取り消す理由を指定する")
  model SaleVoidRequest {
    @doc("取消理由。理由を記録しない場合はnull")
    voidReason: string | null;
  }

  @doc("""
    売上の支払いリクエスト - 売上に対する1回の支払い(決済取引)の内容を指定する。全項目のキーが必須。
    取引番号・決済代行会社の応答・処理日時・状態はシステムが設定する
    """)
  model SaleProcessRequest {
    @doc("支払い方法の ID。売上と同じサロンの有効な支払い方法を指定する")
    paymentMethodId: PaymentMethodId;

    @doc("支払金額。売上の未払い残額以下")
    @minValue(1)
    amount: int32;

    @doc("カード番号の下4桁(数字4桁)。カード以外の支払いの場合はnull")
    @minLength(4)
    @maxLength(4)
    cardLastFour: string | null;

    @doc("カードブランド(Visa など)。カード以外の支払いの場合はnull")
    @maxLength(50)
    cardBrand: string | null;
  }

  @doc("売上のレシート - 売上とその明細・決済取引から作成するレシートの内容")
  model SaleReceiptResponse {
    @doc("レシート番号")
    receiptNumber: string;

    @doc("レシートの対象となる売上。明細(details)と決済取引(payments)を含む")
    sale: SaleResponse;

    @doc("レシートの発行日時")
    issuedAt: utcDateTime;
  }

  @doc("""
    会計金額の試算リクエスト - 選択したサービスと割引・ポイントから、売上を登録する前に請求額を試算する。
    全項目のキーが必須
    """)
  model SaleCalculateRequest {
    @doc("試算の対象となるサービス ID の一覧")
    services: ServiceId[];

    @doc("適用する割引コード。割引コードを使わない場合はnull")
    discountCode: string | null;

    @doc("利用するポイント数。ポイントを使わない場合はnull")
    @minValue(0)
    pointsToUse: int32 | null;

    @doc("会計する顧客の ID。顧客を指定しない場合はnull")
    customerId: CustomerId | null;

    @doc("関連する予約の ID。予約がない場合はnull")
    bookingId: BookingId | null;
  }

  @doc("試算した請求金額の内訳")
  model SaleBreakdownResponse {
    @doc("サービス代金の税抜小計")
    subtotal: int32;

    @doc("適用される消費税額")
    tax: int32;

    @doc("割引金額")
    discount: int32;

    @doc("ポイント利用による値引額。ポイントを使わない場合はnull")
    pointsDiscount: int32 | null;

    @doc("支払総額")
    total: int32;
  }

  @doc("会計金額の試算結果 - 売上を登録する前の請求金額の見積もり")
  model SaleCalculateResponse {
    @doc("試算の対象となるサロン ID")
    salonId: SalonId;

    @doc("試算の対象となる顧客の ID。顧客を指定しなかった場合はnull")
    customerId: CustomerId | null;

    @doc("関連する予約の ID。予約を指定しなかった場合はnull")
    bookingId: BookingId | null;

    @doc("請求金額の内訳")
    breakdown: SaleBreakdownResponse;

    @doc("推奨する支払い方法の一覧")
    recommendedMethods: PaymentMethodType[];

    @doc("顧客・スタッフ向けの備考。備考がない場合はnull")
    notes: string | null;
  }

  // ---------------------------------------------------------------------------
  // 決済取引 (payment_transactions)
  // ---------------------------------------------------------------------------

  @doc("""
    決済取引レスポンス - payment_transactions テーブルの1行。売上に対する1回の支払いを表す。
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

    @doc("決済の状態")
    status: PaymentStatusType;

    @doc("決済代行会社の取引 ID。現金など決済代行会社を介さない支払いの場合、または決済代行会社が受け付けなかった場合はnull")
    processorTransactionId: string | null;

    @doc("カード番号の下4桁。カード以外の支払いの場合はnull")
    cardLastFour: string | null;

    @doc("カードブランド。カード以外の支払いの場合はnull")
    cardBrand: string | null;

    @doc("決済が失敗したときのエラーコード。失敗していない場合はnull")
    errorCode: string | null;

    @doc("決済が失敗したときのエラーメッセージ。失敗していない場合はnull")
    errorMessage: string | null;

    @doc("決済が完了した日時。完了していない場合はnull")
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

    @doc("返金理由。理由を記録しない場合はnull")
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

    @doc("ポイントの変動量。獲得は正、利用・失効は負の値")
    points: int32;

    @doc("この取引の後のポイント残高")
    balance: int32;

    @doc("取引内容の説明。未設定の場合はnull")
    description: string | null;

    @doc("取引のもとになった記録の種類(sale、booking など)。参照する記録がない場合はnull")
    referenceType: string | null;

    @doc("取引のもとになった記録の ID。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;

    @doc("獲得したポイントの有効期限。有効期限のない取引の場合はnull")
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
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("取引の発生日時(createdAt)の下限。この日時以降の取引に一致する")
    startDate?: utcDateTime;

    @query
    @doc("取引の発生日時(createdAt)の上限。この日時以前の取引に一致する")
    endDate?: utcDateTime;
  }

  @doc("""
    ポイント残高レスポンス - 顧客の最新のポイント取引(customer_points)の balance を返す。
    ポイント取引のない顧客の残高は 0
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

    @doc("付与するポイント数")
    @minValue(1)
    points: int32;

    @doc("付与の理由。未設定の場合はnull")
    description: string | null;

    @doc("付与のもとになった記録の種類(sale、booking など)。referenceId と同時に指定する。参照する記録がない場合はnull")
    @maxLength(50)
    referenceType: string | null;

    @doc("付与のもとになった記録の ID。referenceType と同時に指定する。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;

    @doc("付与したポイントの有効期限。有効期限を設けない場合はnull")
    expiryDate: plainDate | null;
  }

  @doc("""
    ポイント利用リクエスト - 種別 used のポイント取引を登録する。全項目のキーが必須。
    DB で NULL 許可のカラムのみ null を指定できる。残高はシステムが計算する
    """)
  model PointUseRequest {
    @doc("ポイントを利用する顧客の ID")
    customerId: CustomerId;

    @doc("利用するポイント数。現在の残高以下")
    @minValue(1)
    points: int32;

    @doc("利用の理由。未設定の場合はnull")
    description: string | null;

    @doc("利用のもとになった記録の種類(sale など)。referenceId と同時に指定する。参照する記録がない場合はnull")
    @maxLength(50)
    referenceType: string | null;

    @doc("利用のもとになった記録の ID。referenceType と同時に指定する。参照する記録がない場合はnull")
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

    @doc("調整するポイント数。増やす場合は正、減らす場合は負の値で、0 は指定できない。調整後の残高が負になる値は指定できない")
    points: int32;

    @doc("調整の理由。未設定の場合はnull")
    description: string | null;

    @doc("調整のもとになった記録の種類(sale、booking など)。referenceId と同時に指定する。参照する記録がない場合はnull")
    @maxLength(50)
    referenceType: string | null;

    @doc("調整のもとになった記録の ID。referenceType と同時に指定する。参照する記録がない場合はnull")
    @format("uuid")
    referenceId: string | null;
  }

  @doc("失効予定ポイントの集計結果 - 有効期限が近い獲得ポイントの合計と、その取引の一覧")
  model PointExpiringResponse {
    @doc("対象顧客の ID")
    customerId: CustomerId;

    @doc("期間内に失効する予定のポイント数の合計")
    expiringPoints: int32;

    @doc("期間内で最も早い有効期限。失効予定のポイントがない場合はnull")
    expirationDate: plainDate | null;

    @doc("期間内に有効期限を迎える獲得ポイントの取引の一覧。expiryDate の昇順で並ぶ")
    transactions: PointTransactionResponse[];
  }

  @doc("ポイント失効処理リクエスト - 有効期限を過ぎたポイントを失効させる対象を指定する。全項目のキーが必須")
  model PointExpireRequest {
    @doc("対象顧客の ID。すべての顧客を処理する場合はnull")
    customerId: CustomerId | null;

    @doc("この日付より前に有効期限を迎えたポイントを失効させる。null の場合は処理を実行した日")
    processBefore: plainDate | null;
  }

  @doc("ポイント失効処理の結果")
  model PointExpireResponse {
    @doc("登録した失効(expired)のポイント取引の件数")
    processedCount: int32;

    @doc("失効させたポイントの合計")
    totalPoints: int32;
  }

  // ---------------------------------------------------------------------------
  // 売上レポート (sales を集計して作成する。対応するテーブルはない)
  // 金額はサロンの通貨(salons.currency)の整数値
  // ---------------------------------------------------------------------------

  @doc("売上レポートの集計条件")
  model SalesReportGetRequest {
    @query
    @doc("集計対象のサロン ID")
    salonId: SalonId;

    ...DateRangeFilter;

    @query
    @doc("集計粒度(day: 日／week: 週／month: 月)")
    groupBy?: "day" | "week" | "month";

    @query
    @doc("返金取引を集計に含めるかどうか")
    includeRefunds?: boolean = true;
  }

  @doc("期間内の売上実績を集計したレポート")
  model SalesReportResponse {
    @doc("対象サロン ID")
    salonId: SalonId;

    @doc("集計期間の開始日時")
    periodStart: utcDateTime;

    @doc("集計期間の終了日時")
    periodEnd: utcDateTime;

    @doc("総売上額")
    totalSales: int64;

    @doc("累計税額")
    totalTax: int64;

    @doc("累計割引額")
    totalDiscounts: int64;

    @doc("累計返金額")
    totalRefunds: int64;

    @doc("返金考慮後の純売上額")
    netSales: int64;

    @doc("取引件数")
    transactionCount: int32;

    @doc("平均取引単価")
    averageTransactionValue: int64;

    @doc("支払い方法別の売上内訳")
    salesByMethod: SalesByMethodResponse[];

    @doc("サービスカテゴリ別の売上内訳")
    salesByCategory: SalesByCategoryResponse[];

    @doc("売上貢献度の高いスタッフ情報")
    topStaff: SalesByStaffResponse[];
  }

  @doc("支払い方法別の売上集計行")
  model SalesByMethodResponse {
    @doc("支払い方法区分")
    method: PaymentMethodType;

    @doc("売上金額")
    amount: int64;

    @doc("取引件数")
    count: int32;

    @doc("総売上に対する構成比率(%)")
    percentage: float32;
  }

  @doc("サービスカテゴリ別の売上集計行")
  model SalesByCategoryResponse {
    @doc("サービスカテゴリ区分")
    category: ServiceCategoryType;

    @doc("売上金額")
    amount: int64;

    @doc("提供件数")
    count: int32;

    @doc("総売上に対する構成比率(%)")
    percentage: float32;
  }

  @doc("スタッフ別の売上パフォーマンス指標")
  model SalesByStaffResponse {
    @doc("スタッフ ID")
    staffId: StaffId;

    @doc("スタッフ名")
    staffName: string;

    @doc("担当した売上金額")
    totalSales: int64;

    @doc("提供したサービス件数")
    serviceCount: int32;

    @doc("平均サービス単価")
    averageServiceValue: int64;

    @doc("顧客満足度評価。評価データがない場合はnull")
    customerSatisfaction: float32 | null;
  }

  @doc("日次の売上サマリー")
  model DailySalesResponse {
    @doc("集計対象日")
    date: plainDate;

    @doc("売上額")
    sales: int64;

    @doc("取引件数")
    transactions: int32;

    @doc("返金額")
    refunds: int64;

    @doc("返金考慮後の純売上額")
    net: int64;
  }

  @doc("売上推移 - 期間を区切った単位ごとの売上の時系列。各配列の同じ位置が同じ区切りを表す")
  model SalesTrendsResponse {
    @doc("各区切りのラベル")
    labels: string[];

    @doc("各区切りの売上額")
    sales: int64[];

    @doc("各区切りの取引件数")
    transactions: int32[];

    @doc("各区切りの平均取引単価")
    average: int64[];
  }

  @doc("""
    売上レポート出力形式区分 - 売上レポートを出力するファイルの形式
    
    csv: CSV - カンマ区切りのテキストファイル
    excel: Excel - Excel のブック
    pdf: PDF - 印刷・配布用の PDF ファイル
    """)
  enum SalesReportExportFormatType {
    csv,
    excel,
    pdf,
  }

  @doc("売上レポートの出力リクエスト - 出力する期間と形式を指定する")
  model SalesReportExportRequest {
    @doc("集計対象のサロン ID")
    salonId: SalonId;

    @doc("集計期間の開始日時")
    startDate: utcDateTime;

    @doc("集計期間の終了日時")
    endDate: utcDateTime;

    @doc("出力形式")
    format: SalesReportExportFormatType;
  }

  @doc("売上レポートの出力結果")
  model SalesReportExportResponse {
    @doc("出力したファイルのダウンロード URL")
    downloadUrl: string;
  }
}
