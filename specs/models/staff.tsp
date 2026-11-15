import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    スタッフ勤務スケジュール - staff_schedules テーブルの1行。勤務時間と休憩時間を表し、予約可能時間の算出に利用する。
    毎週繰り返す行(isRecurring が true)は dayOfWeek の曜日に、単日の行(isRecurring が false)は date の日付だけに適用する。
    同じ日付に単日の行がある場合は、その日付については毎週繰り返す行より単日の行を優先する。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model StaffSchedule {
    @doc("毎週繰り返す行が適用される曜日。単日の行の場合はnull")
    dayOfWeek: DayOfWeekType | null;

    @doc("単日の行が適用される日付。毎週繰り返す行の場合はnull")
    date: plainDate | null;

    @doc("勤務開始時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。endTimeより前の時刻を指定する")
    startTime: string;

    @doc("勤務終了時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）")
    endTime: string;

    @doc("休憩開始時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。breakEndTimeと組で、勤務時間内の時刻を指定する。休憩がない場合はnull")
    breakStartTime: string | null;

    @doc("休憩終了時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。breakStartTimeと組で指定する。休憩がない場合はnull")
    breakEndTime: string | null;

    @doc("毎週 dayOfWeek の曜日に繰り返す行かどうか。falseの場合は date の日付だけに適用する")
    isRecurring: boolean;

    @doc("勤務可能かどうか。falseの場合は休み(臨時休みなど)を表す")
    isAvailable: boolean;

    @doc("シフト変更の理由などの備考。特記事項がない場合はnull")
    notes: string | null;
  }

  @doc("""
    スタッフ台帳のレスポンス - staff テーブルの1行。雇用の情報(基本給、歩合率、雇用形態、入社日)と個人の連絡先を含むので、
    admin と、そのサロンの owner だけに返す。プロパティ名と null 許可は DB カラムと一致させている。
    勤務スケジュール(staff_schedules)は含まない
    """)
  model StaffResponse {
    @doc("スタッフを一意に識別するID")
    id: StaffId;

    @doc("所属サロンのID")
    salonId: SalonId;

    @doc("スタッフがログインに使うユーザーアカウントのID。ログインアカウントと紐づいていない場合はnull。登録と更新のリクエストでは指定できない")
    userId: UserId | null;

    @doc("名")
    firstName: string;

    @doc("姓")
    lastName: string;

    @doc("名のカナ表記。未設定の場合はnull")
    firstNameKana: string | null;

    @doc("姓のカナ表記。未設定の場合はnull")
    lastNameKana: string | null;

    @doc("顧客向けに表示するスタッフ名")
    displayName: string;

    @doc("連絡用メールアドレス。小文字で保存する。同じサロンの削除されていないスタッフの間で一意")
    email: string;

    @doc("連絡用電話番号")
    phoneNumber: string;

    @doc("予備の電話番号。未設定の場合はnull")
    alternativePhone: string | null;

    @doc("サロン内でスタッフを識別するコード(社員番号など)。同じサロンの削除済みを含むスタッフの間で一意。未設定の場合はnull")
    staffCode: string | null;

    @doc("技術レベル")
    level: StaffLevelType;

    @doc("役職名。未設定の場合はnull")
    position: string | null;

    @doc("得意分野や専門メニューの一覧。ない場合は空配列")
    specialties: string[];

    @doc("自己紹介や経歴の概要 - プロフィール未記入の新人スタッフの場合はnull")
    bio: string | null;

    @doc("プロフィール画像のURL - プロフィール画像未設定の場合はnull")
    imageUrl: string | null;

    @doc("実務経験年数 - 経験年数未記載またはアシスタントスタッフの場合はnull")
    yearsOfExperience: int32 | null;

    @doc("保有資格名の一覧 (テキスト管理)。ない場合は空配列")
    certifications: string[];

    @doc("入社日。未設定の場合はnull")
    hireDate: plainDate | null;

    @doc("雇用形態(full-time など)。未設定の場合はnull")
    employmentType: string | null;

    @doc("基本給。未設定の場合はnull")
    baseSalary: int32 | null;

    @doc("歩合率(%)。未設定の場合はnull")
    commissionRate: float64 | null;

    @doc("予約を受け付けるかどうか")
    canReceiveBookings: boolean;

    @doc("同時に担当できる予約の上限数")
    maxConcurrentBookings: int32;

    @doc("予約の前に確保する準備時間(分)。確保しない場合は0")
    bufferTimeBefore: int32;

    @doc("予約の後に確保する片付け時間(分)。確保しない場合は0")
    bufferTimeAfter: int32;

    @doc("在籍して勤務しているかどうか。falseの間、このスタッフに紐づくログインアカウントは、サロンへの権限を持たない")
    isActive: boolean;

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    スタッフ新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる。
    所属サロンはパスの salonId で指定する。ログインアカウントとの紐づけ(userId)は指定できない
    """)
  model StaffCreateRequest {
    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName: string;

    @doc("名のカナ表記。未設定の場合はnull")
    @maxLength(100)
    firstNameKana: string | null;

    @doc("姓のカナ表記。未設定の場合はnull")
    @maxLength(100)
    lastNameKana: string | null;

    @doc("顧客向けに表示するスタッフ名")
    @minLength(1)
    @maxLength(255)
    displayName: string;

    @doc("連絡用メールアドレス。小文字にして保存する。同じサロンの削除されていないスタッフの間で一意")
    @maxLength(255)
    email: string;

    @doc("連絡用電話番号")
    @maxLength(20)
    phoneNumber: string;

    @doc("予備の電話番号。未設定の場合はnull")
    @maxLength(20)
    alternativePhone: string | null;

    @doc("サロン内でスタッフを識別するコード(社員番号など)。同じサロンの削除済みを含むスタッフの間で一意。未設定の場合はnull")
    @maxLength(50)
    staffCode: string | null;

    @doc("技術レベル")
    level: StaffLevelType;

    @doc("役職名。未設定の場合はnull")
    @maxLength(100)
    position: string | null;

    @doc("得意分野や専門メニューの一覧。ない場合は空配列。空白だけの要素と、同じ要素の繰り返しは指定できない")
    specialties: string[];

    @doc("自己紹介や経歴の概要 - プロフィール未記入の新人スタッフの場合はnull")
    bio: string | null;

    @doc("プロフィール画像のURL - プロフィール画像未設定の場合はnull")
    @maxLength(500)
    imageUrl: string | null;

    @doc("実務経験年数 - 経験年数未記載またはアシスタントスタッフの場合はnull")
    @minValue(0)
    @maxValue(100)
    yearsOfExperience: int32 | null;

    @doc("保有資格名の一覧 (テキスト管理)。ない場合は空配列。空白だけの要素と、同じ要素の繰り返しは指定できない")
    certifications: string[];

    @doc("入社日。未設定の場合はnull")
    hireDate: plainDate | null;

    @doc("雇用形態(full-time など)。未設定の場合はnull")
    @maxLength(50)
    employmentType: string | null;

    @doc("基本給。未設定の場合はnull")
    @minValue(0)
    baseSalary: int32 | null;

    @doc("歩合率(%)。小数第2位まで。未設定の場合はnull")
    @minValue(0)
    @maxValue(100)
    commissionRate: float64 | null;

    @doc("予約を受け付けるかどうか")
    canReceiveBookings: boolean;

    @doc("同時に担当できる予約の上限数")
    @minValue(1)
    @maxValue(10)
    maxConcurrentBookings: int32;

    @doc("予約の前に確保する準備時間(分)。確保しない場合は0")
    @minValue(0)
    @maxValue(120)
    bufferTimeBefore: int32;

    @doc("予約の後に確保する片付け時間(分)。確保しない場合は0")
    @minValue(0)
    @maxValue(120)
    bufferTimeAfter: int32;

    @doc("在籍して勤務しているかどうか")
    isActive: boolean;
  }

  @doc("""
    スタッフ部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    項目を1つも指定しないリクエストは受け付けない。所属サロンと、ログインアカウントとの紐づけ(userId)は変更できない
    """)
  model StaffUpdateRequest {
    @doc("名")
    @minLength(1)
    @maxLength(100)
    firstName?: string;

    @doc("姓")
    @minLength(1)
    @maxLength(100)
    lastName?: string;

    @doc("名のカナ表記。nullでクリア")
    @maxLength(100)
    firstNameKana?: string | null;

    @doc("姓のカナ表記。nullでクリア")
    @maxLength(100)
    lastNameKana?: string | null;

    @doc("顧客向けに表示するスタッフ名")
    @minLength(1)
    @maxLength(255)
    displayName?: string;

    @doc("連絡用メールアドレス。小文字にして保存する。同じサロンの削除されていないスタッフの間で一意")
    @maxLength(255)
    email?: string;

    @doc("連絡用電話番号")
    @maxLength(20)
    phoneNumber?: string;

    @doc("予備の電話番号。nullでクリア")
    @maxLength(20)
    alternativePhone?: string | null;

    @doc("サロン内でスタッフを識別するコード(社員番号など)。同じサロンの削除済みを含むスタッフの間で一意。nullでクリア")
    @maxLength(50)
    staffCode?: string | null;

    @doc("技術レベル")
    level?: StaffLevelType;

    @doc("役職名。nullでクリア")
    @maxLength(100)
    position?: string | null;

    @doc("得意分野や専門メニューの一覧。指定した一覧で置き換える。空白だけの要素と、同じ要素の繰り返しは指定できない")
    specialties?: string[];

    @doc("自己紹介や経歴の概要。nullでクリア")
    bio?: string | null;

    @doc("プロフィール画像のURL。nullでクリア")
    @maxLength(500)
    imageUrl?: string | null;

    @doc("実務経験年数。nullでクリア")
    @minValue(0)
    @maxValue(100)
    yearsOfExperience?: int32 | null;

    @doc("保有資格名の一覧 (テキスト管理)。指定した一覧で置き換える。空白だけの要素と、同じ要素の繰り返しは指定できない")
    certifications?: string[];

    @doc("入社日。nullでクリア")
    hireDate?: plainDate | null;

    @doc("雇用形態(full-time など)。nullでクリア")
    @maxLength(50)
    employmentType?: string | null;

    @doc("基本給。nullでクリア")
    @minValue(0)
    baseSalary?: int32 | null;

    @doc("歩合率(%)。小数第2位まで。nullでクリア")
    @minValue(0)
    @maxValue(100)
    commissionRate?: float64 | null;

    @doc("予約を受け付けるかどうか")
    canReceiveBookings?: boolean;

    @doc("同時に担当できる予約の上限数")
    @minValue(1)
    @maxValue(10)
    maxConcurrentBookings?: int32;

    @doc("予約の前に確保する準備時間(分)。確保しない場合は0")
    @minValue(0)
    @maxValue(120)
    bufferTimeBefore?: int32;

    @doc("予約の後に確保する片付け時間(分)。確保しない場合は0")
    @minValue(0)
    @maxValue(120)
    bufferTimeAfter?: int32;

    @doc("在籍して勤務しているかどうか。自分自身のスタッフ情報では、falseにできない")
    isActive?: boolean;
  }

  @doc("""
    サロン内スタッフ一覧リクエスト - ページネーションを指定する
    """)
  model StaffSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;
  }

  @doc("""
    スタッフプロフィールのレスポンス - 顧客に見せるスタッフの情報。staff テーブルの1行のうち、公開する項目だけを持つ。
    本名、連絡先、雇用の情報(基本給、歩合率、雇用形態、入社日)は含まない。それらはスタッフ台帳(StaffResponse)が返す。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model StaffProfileResponse {
    @doc("スタッフを一意に識別するID")
    id: StaffId;

    @doc("所属サロンのID")
    salonId: SalonId;

    @doc("顧客向けに表示するスタッフ名")
    displayName: string;

    @doc("技術レベル")
    level: StaffLevelType;

    @doc("役職名。未設定の場合はnull")
    position: string | null;

    @doc("得意分野や専門メニューの一覧。ない場合は空配列")
    specialties: string[];

    @doc("自己紹介や経歴の概要 - プロフィール未記入の新人スタッフの場合はnull")
    bio: string | null;

    @doc("プロフィール画像のURL - プロフィール画像未設定の場合はnull")
    imageUrl: string | null;

    @doc("実務経験年数 - 経験年数未記載またはアシスタントスタッフの場合はnull")
    yearsOfExperience: int32 | null;

    @doc("保有資格名の一覧 (テキスト管理)。ない場合は空配列")
    certifications: string[];

    @doc("予約を受け付けるかどうか")
    canReceiveBookings: boolean;
  }

  @doc("""
    スタッフプロフィール一覧リクエスト - 全サロンのスタッフを対象に、絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model StaffProfileSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("所属サロンの ID による絞り込み(完全一致)。存在しないサロンを指定した場合は空の一覧を返す")
    salonId?: SalonId;

    @query
    @doc("得意分野による絞り込み。specialtiesに指定した値(完全一致)を含むスタッフに一致する")
    @minLength(1)
    specialty?: string;

    @query
    @doc("所属サロンの市区町村名による絞り込み(完全一致)")
    @minLength(1)
    @maxLength(100)
    city?: string;
  }
}
