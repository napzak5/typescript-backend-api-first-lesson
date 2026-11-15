import "@typespec/http";
import "./_shared/common.tsp";
import "./_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    予約ステータス区分 - 予約の詳細な進行状態を表す区分
    
    draft: 下書き - 予約内容を作成中、まだ確定していない状態
    pending: 保留中 - 予約リクエストを受付、確認待ちの状態
    confirmed: 確定 - 予約が確定し、スタッフが割り当てられた状態
    in_progress: 施術中 - 現在サービスを実施中の状態(start アクションで記録する)
    completed: 完了 - サービス提供が終了した状態
    cancelled: キャンセル - 予約がキャンセルされた状態
    no_show: 無断キャンセル - 顧客が連絡なしに来店しなかった状態(no-show アクションで、開始日時を過ぎてから記録する)
    """)
  enum BookingStatusType {
    draft,
    pending,
    confirmed,
    in_progress,
    completed,
    cancelled,
    no_show,
  }

  @doc("""
    予約の施術明細レスポンス - booking_services テーブルの1行。予約に含まれる1つの施術メニューと、
    その担当スタッフ・時間・料金を表す。プロパティ名と null 許可は DB カラムと一致させている
    """)
  model BookingServiceResponse {
    @doc("施術明細を一意に識別するID")
    id: BookingServiceId;

    @doc("予約された施術メニューのID")
    serviceId: ServiceId;

    @doc("この施術を担当するスタッフのID。担当スタッフが決まっていない場合はnull")
    staffId: StaffId | null;

    @doc("施術開始予定日時 (UTC)")
    startTime: utcDateTime;

    @doc("施術終了予定日時 (UTC)")
    endTime: utcDateTime;

    @doc("施術時間（分）。明細を追加した時点のサービスの施術時間")
    duration: int32;

    @doc("施術料金。明細を追加した時点のサービスの料金")
    price: int32;

    @doc("施術料金からの割引額。明細を追加した時点のサービスの割引後料金から算出する")
    discountAmount: int32;

    @doc("割引適用後の施術料金 (price − discountAmount)")
    finalPrice: int32;

    @doc("施術料金が消費税を含むかどうか。明細を追加した時点のサービスの設定。false の明細の finalPrice には、予約の taxAmount の消費税が加わる")
    taxIncluded: boolean;

    @doc("施術が完了したかどうか")
    isCompleted: boolean;

    @doc("施術が完了した日時。完了していない場合はnull")
    completedAt: utcDateTime | null;

    @doc("この施術に関するメモ。メモがない場合はnull")
    notes: string | null;

    @doc("予約内での表示順序。予約作成時は services の指定順になり、あとから追加した明細は末尾に並ぶ")
    sortOrder: int32;
  }

  @doc("""
    施術明細の追加リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    終了日時・施術時間・料金・割引額・税込かどうかは、指定したサービスの登録内容から決まる
    """)
  model BookingServiceCreateRequest {
    @doc("予約する施術メニューのID。予約と同じサロンのサービスを指定する")
    serviceId: ServiceId;

    @doc("この施術を担当するスタッフのID。予約と同じサロンのスタッフを指定する。担当スタッフを決めない場合はnull(その施術は、誰の時間も確保しない)")
    staffId: StaffId | null;

    @doc("施術開始予定日時 (UTC)。分単位で指定する(秒と小数は0)")
    startTime: utcDateTime;

    @doc("この施術に関するメモ。メモがない場合はnull")
    notes: string | null;
  }

  @doc("""
    予約レスポンス - bookings テーブルの公開カラムと、施術明細(booking_services)を返す。
    プロパティ名と null 許可は DB カラムと一致させている。監査用の ipAddress と userAgent は返さない
    """)
  model BookingResponse {
    @doc("予約を一意に識別するID")
    id: BookingId;

    @doc("予約番号。システムが BK-XXXX-XXXX の形式(X は数字か、I・L・O・U を除く英大文字)で採番し、すべての予約の間で一意")
    bookingNumber: string;

    @doc("予約が紐づくサロンのID")
    salonId: SalonId;

    @doc("予約を行った顧客のID")
    customerId: CustomerId;

    @doc("予約の担当スタッフのID")
    staffId: StaffId;

    @doc("来店日。startTime をサロンのタイムゾーンで表した日付")
    bookingDate: plainDate;

    @doc("予約の開始予定日時 (UTC)。施術明細の最も早い開始日時")
    startTime: utcDateTime;

    @doc("予約の終了予定日時 (UTC)。施術明細の最も遅い終了日時")
    endTime: utcDateTime;

    @doc("予約全体の所要時間（分）。startTime から endTime までの分数")
    duration: int32;

    @doc("予約の現在ステータス")
    status: BookingStatusType;

    @doc("小計。施術明細の料金(price)の合計")
    subtotal: int32;

    @doc("割引額の合計。施術明細の割引額(discountAmount)の合計")
    discountAmount: int32;

    @doc("料金に加える消費税額。税抜価格のサービス(taxIncluded が false)の施術明細の割引後料金の合計に、サロンの税率を掛け、1円未満を切り捨てる。税込価格のサービスの消費税は料金に含まれており、ここには入らない")
    taxAmount: int32;

    @doc("請求金額 (subtotal − discountAmount + taxAmount)")
    totalAmount: int32;

    @doc("事前に受領する内金・デポジット金額。未設定の場合はnull")
    depositAmount: int32 | null;

    @doc("この予約の支払いで利用したポイント数。未設定の場合はnull")
    pointsUsed: int32 | null;

    @doc("この予約で獲得したポイント数。未設定の場合はnull")
    pointsEarned: int32 | null;

    @doc("顧客からの要望や特記事項。要望がない場合はnull")
    customerRequest: string | null;

    @doc("サロン内で共有するメモ。メモがない場合はnull")
    internalNotes: string | null;

    @doc("リマインダーを送信済みかどうか")
    reminderSent: boolean;

    @doc("リマインダーを送信した日時。送信していない場合はnull")
    reminderSentAt: utcDateTime | null;

    @doc("予約がキャンセルされた日時。キャンセルされていない場合はnull")
    cancelledAt: utcDateTime | null;

    @doc("キャンセルを実行した利用者のID。キャンセルされていない場合、またはシステムがキャンセルした場合はnull")
    cancelledBy: UserId | null;

    @doc("キャンセルが発生した場合の理由。キャンセルされていない場合、または理由が記録されていない場合はnull")
    cancellationReason: string | null;

    @doc("キャンセル料。キャンセルされていない場合はnull。キャンセルされた予約では、料金を決める規則が未定義のため常に0")
    cancellationFee: int32 | null;

    @doc("予約の施術が完了した日時。完了していない場合はnull")
    completedAt: utcDateTime | null;

    @doc("実際の施術開始日時。記録されていない場合はnull")
    actualStartTime: utcDateTime | null;

    @doc("実際の施術終了日時。記録されていない場合はnull")
    actualEndTime: utcDateTime | null;

    @doc("予約の受付経路（例: online、phone）。未設定の場合はnull")
    source: string | null;

    @doc("施術明細の一覧。sortOrder の昇順で並ぶ。1件以上")
    services: BookingServiceResponse[];

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    予約新規作成リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    作成した予約のステータスは pending になる。予約番号、日時・所要時間、金額は、システムが採番・算出する
    """)
  model BookingCreateRequest {
    @doc("予約対象のサロンID")
    salonId: SalonId;

    @doc("予約を申し込む顧客ID")
    customerId: CustomerId;

    @doc("予約の担当スタッフのID。salonId のサロンのスタッフを指定する")
    staffId: StaffId;

    @doc("事前に受領する内金・デポジット金額。未設定の場合はnull")
    @minValue(0)
    depositAmount: int32 | null;

    @doc("顧客からの要望や特記事項。要望がない場合はnull")
    customerRequest: string | null;

    @doc("サロン内で共有するメモ。メモがない場合はnull")
    internalNotes: string | null;

    @doc("予約の受付経路（例: online、phone）。未設定の場合はnull")
    @maxLength(50)
    source: string | null;

    @doc("施術明細の一覧。1件以上20件以下で指定する。指定した順に sortOrder を振る。どの明細も、最も早い明細の開始から24時間以内に始める")
    @minItems(1)
    @maxItems(20)
    services: BookingServiceCreateRequest[];
  }

  @doc("""
    予約部分更新リクエスト - 指定した項目だけを更新する(1つ以上)。DB で NULL 許可のカラムは null でクリアできる。
    サロン・顧客は変更できない。日時と担当スタッフは reschedule、ステータスは confirm などのアクションで変更する
    """)
  model BookingUpdateRequest {
    @doc("事前に受領する内金・デポジット金額。nullでクリア")
    @minValue(0)
    depositAmount?: int32 | null;

    @doc("顧客からの要望や特記事項。nullでクリア")
    customerRequest?: string | null;

    @doc("サロン内で共有するメモ。nullでクリア")
    internalNotes?: string | null;

    @doc("予約の受付経路（例: online、phone）。nullでクリア")
    @maxLength(50)
    source?: string | null;
  }

  @doc("""
    予約一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model BookingSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("サロンのIDによる絞り込み(完全一致)")
    salonId?: SalonId;

    @query
    @doc("顧客のIDによる絞り込み(完全一致)")
    customerId?: CustomerId;

    @query
    @doc("スタッフのIDによる絞り込み。予約の担当スタッフ、またはいずれかの施術明細の担当スタッフが一致する予約に一致する")
    staffId?: StaffId;

    @query
    @doc("ステータスによる絞り込み(完全一致)")
    status?: BookingStatusType;

    @query
    @doc("来店日(bookingDate)の範囲の開始日。この日以降の予約に一致する。bookingDateTo より後の日付は指定できない")
    bookingDateFrom?: plainDate;

    @query
    @doc("来店日(bookingDate)の範囲の終了日。この日以前の予約に一致する")
    bookingDateTo?: plainDate;
  }

  @doc("""
    予約キャンセルリクエスト - キャンセル理由を受け取る。キーは必須
    """)
  model BookingCancelRequest {
    @doc("キャンセルが発生した場合の理由。理由を記録しない場合はnull")
    cancellationReason: string | null;
  }

  @doc("""
    予約完了リクエスト - 実際の施術開始・終了日時を受け取る。キーは必須で、記録しない日時は null を指定する
    """)
  model BookingCompleteRequest {
    @doc("実際の施術開始日時 (UTC)。nullの場合は、記録済みの日時(start アクションが記録したもの)を残す")
    actualStartTime: utcDateTime | null;

    @doc("実際の施術終了日時 (UTC)。実際の施術開始日時(このリクエストの値、nullの場合は記録済みの値)より後の日時を指定する。記録しない場合はnull")
    actualEndTime: utcDateTime | null;
  }

  @doc("""
    予約日時変更リクエスト - 変更後の開始日時と担当スタッフを受け取る。キーは必須
    """)
  model BookingRescheduleRequest {
    @doc("変更後の予約開始日時 (UTC)。分単位で指定する(秒と小数は0)")
    startTime: utcDateTime;

    @doc("変更後の担当スタッフのID。予約と同じサロンのスタッフを指定する。担当を変えない場合は現在の担当スタッフのIDを指定する")
    staffId: StaffId;
  }

  @doc("""
    空き枠検索リクエスト - サロンの指定日に、サービスを予約できる枠を算出する条件とページネーションを指定する。
    serviceId と date は必須
    """)
  model AvailableSlotSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する。ページの最後の枠を表す `<startTime>_<staffId>` の形で、その枠より後の枠から返す")
    cursor?: string;

    @query
    @doc("空き枠を探すスタッフのID。パスのサロンのスタッフを指定する。指定しない場合はサロンのすべてのスタッフの空き枠を返す")
    staffId?: StaffId;

    @query
    @doc("予約したい施術メニューのID。パスのサロンのサービスを指定する")
    serviceId: ServiceId;

    @query
    @doc("空き枠を探す日付。サロンのタイムゾーンでの日付。過去の日付には空の一覧を返す")
    date: plainDate;

    @query
    @doc("必要な施術時間（分）。指定しない場合はサービスの施術時間を使う")
    @minValue(1)
    @maxValue(1440)
    duration?: int32;
  }

  @doc("""
    空き枠レスポンス - 1人のスタッフがサービスを始められる開始日時と、その施術が終わる日時を表す。
    テーブルには保存せず、予約・スタッフのスケジュール・営業時間から算出する
    """)
  model AvailableSlotResponse {
    @doc("対象スタッフのID")
    staffId: StaffId;

    @doc("空き枠の開始日時 (UTC)")
    startTime: utcDateTime;

    @doc("空き枠の終了日時 (UTC)。開始日時に施術時間を足した日時")
    endTime: utcDateTime;
  }

  @doc("""
    空き状況確認リクエスト - 希望する日時・スタッフ・施術メニューの組み合わせを受け取る。キーは必須。
    希望する時間は、startTime から、サービスの施術時間(duration)のあいだ
    """)
  model AvailableSlotCheckRequest {
    @doc("担当を希望するスタッフのID。パスのサロンのスタッフを指定する")
    staffId: StaffId;

    @doc("予約したい施術メニューのID。パスのサロンのサービスを指定する")
    serviceId: ServiceId;

    @doc("希望する施術開始日時 (UTC)。分単位で指定する(秒と小数は0)")
    startTime: utcDateTime;
  }

  @doc("""
    空き状況確認レスポンス - 希望した時間にスタッフが占有されていないかどうかと、重なっている予約を返す
    """)
  model AvailableSlotCheckResponse {
    @doc("スタッフが占有されていないかどうか。予約台帳への作成が、スタッフの占有を理由に断られないこと")
    isAvailable: boolean;

    @doc("希望した時間(スタッフの前後の空け時間を含む)に、施術明細(同じく空け時間を含む)が重なっている予約のID一覧。早く始まる明細の予約から並ぶ。同時に複数の予約を受けられるスタッフでは、重なりがあっても isAvailable が true のことがある。重なりがない場合は空配列")
    conflicts: BookingId[];
  }
}
