import "@typespec/http";
import "./auth.tsp";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    スタッフ勤務スケジュール - staff_schedules テーブルの1行。スタッフがいつ勤務するかを表し、予約可能時間の算出に利用する。
    毎週の行(isRecurring が true)は dayOfWeek の曜日に毎週、単日の行(isRecurring が false)は date の日付だけに適用する。
    1人のスタッフが持てるのは、毎週の行が曜日ごとに1つまで、単日の行が日付ごとに1つまで。ある日付に単日の行がある場合は、その日付には単日の行だけを適用する。
    勤務する行(isAvailable が true)は勤務時刻を持ち、休みの行(isAvailable が false)は時刻を持たない。
    リクエストとレスポンスの両方に使う。プロパティ名と null 許可は DB カラムと一致させている
    """)
  model StaffSchedule {
    @doc("毎週の行が適用される曜日。毎週の行では必須。単日の行ではnull")
    dayOfWeek: DayOfWeekType | null;

    @doc("単日の行が適用される日付。単日の行では必須。毎週の行ではnull")
    date: plainDate | null;

    @doc("勤務開始時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。勤務する行では必須で、endTimeより前の時刻を指定する。休みの行ではnull")
    startTime: string | null;

    @doc("勤務終了時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。勤務する行では必須。休みの行ではnull")
    endTime: string | null;

    @doc("休憩開始時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。breakEndTimeと組で、startTimeより後の時刻を指定する。休憩がない場合と、休みの行ではnull")
    breakStartTime: string | null;

    @doc("休憩終了時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。breakStartTimeと組で、breakStartTimeより後、endTimeより前の時刻を指定する。休憩がない場合と、休みの行ではnull")
    breakEndTime: string | null;

    @doc("毎週の行かどうか。trueの場合は dayOfWeek の曜日に毎週、falseの場合は date の日付だけに適用する")
    isRecurring: boolean;

    @doc("勤務するかどうか。falseの場合は休み(定休、臨時休みなど)を表す")
    isAvailable: boolean;

    @doc("シフト変更や休みの理由などの備考。特記事項がない場合はnull")
    notes: string | null;
  }

  @doc("""
    スタッフ勤務スケジュール更新リクエスト - スタッフの勤務スケジュール全体を置き換える行の一覧。
    ほかの更新リクエストと違い、指定した項目だけを変えるのではなく、一覧の全体を置き換える。空の配列を指定すると、スケジュールは空になる。
    行は、毎週の7行と1年分の単日の366行を合わせた373件まで指定できる
    """)
  @maxItems(373)
  model StaffScheduleUpdateRequest is StaffSchedule[];

  @doc("""
    スタッフ勤務スケジュール一覧リクエスト - 日付を指定すると、その日付に適用される行だけを返す
    """)
  model StaffScheduleSearchRequest {
    @query
    @doc("この日付に適用される行だけを返す。その日付の単日の行があればその行を、なければその曜日の毎週の行を返す。どちらもなければ空配列を返す")
    date?: plainDate;
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
    スタッフ本人によるプロフィールの部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    書き換えられるのは、本人を紹介する項目だけ。顧客に見せる名前、技術レベル、役職、予約を受け付けるかどうかは、サロンがスタッフ台帳(StaffUpdateRequest)で決める
    """)
  model StaffProfileUpdateRequest {
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

  @doc("""
    サロンロール区分 - サロンに属するアカウントのロール。スタッフへの招待で与え、スタッフのアカウントの操作で変える
    
    owner: オーナー - サロンの所有者。スタッフ台帳を扱い、スタッフを招待できる
    manager: マネージャー - サロンの管理業務を担当する
    staff: スタッフ - 施術を提供するサロン従業員
    """)
  enum SalonRoleType {
    owner,
    manager,
    staff,
  }

  @doc("""
    スタッフ招待作成リクエスト - 全項目のキーが必須。
    宛先は台帳のメールアドレス(staff.email)で、リクエストでは指定できない
    """)
  model StaffInvitationCreateRequest {
    @doc("招待を受け入れて作られるアカウントのロール。owner を指定できるのは admin だけ")
    role: SalonRoleType;
  }

  @doc("""
    スタッフへの招待 - staff_invitations テーブルの1行。スタッフが、自分のログインアカウントを作るための招待。
    1人のスタッフが持てる招待は1つまで。受け入れられた招待と、取り消された招待は残らない。
    メールで送ったトークンとそのハッシュは返さない。
    プロパティ名と null 許可は DB カラムと一致させている
    """)
  model StaffInvitationResponse {
    @doc("招待を一意に識別するID。招待し直すたびに変わる")
    id: StaffInvitationId;

    @doc("招待されたスタッフのID")
    staffId: StaffId;

    @doc("招待メールの宛先。招待した時点の、台帳のメールアドレス。受け入れると、このメールアドレスのアカウントが作られる")
    email: string;

    @doc("招待を受け入れて作られるアカウントのロール")
    role: SalonRoleType;

    @doc("招待の有効期限 (UTC)。招待してから7日後。この日時を過ぎた招待は受け入れられない")
    expiresAt: utcDateTime;

    @doc("招待した日時 (UTC)")
    createdAt: utcDateTime;
  }

  @doc("""
    スタッフのアカウント - スタッフに紐づいているログインアカウント。users テーブルの1行のうち、サロンの側に見せるカラムを返す。
    スタッフのアカウントは、そのスタッフを staffId で指している、削除されていないユーザー。1人のスタッフが持てるアカウントは1つまで。
    パスワード、トークンのハッシュ、2要素認証のシークレット、ログインの失敗回数、IPアドレスは返さない。
    プロパティ名と null 許可は DB カラムと一致させている。role は、カラムの列挙(user_role)のうち、スタッフを指すアカウントが持つ3つに限る
    """)
  model StaffAccountResponse {
    @doc("アカウント(ユーザー)を一意に識別するID。台帳のスタッフの userId と同じ値")
    id: UserId;

    @doc("ログインに利用するメールアドレス。招待を受け入れた時点の宛先で、そのあと台帳のメールアドレスを変えても変わらない")
    email: string;

    @doc("アカウントのロール。サロンに対してできることを決める")
    role: SalonRoleType;

    @doc("アカウントの稼働状態")
    status: UserAccountStatusType;

    @doc("2要素認証の設定状態。enabled のとき、ログインにコードが必要")
    twoFactorStatus: TwoFactorStatusType;

    @doc("直近のログイン日時 (UTC)。一度もログインしていない場合はnull")
    lastLoginAt: utcDateTime | null;

    @doc("アカウントの作成日時 (UTC)")
    createdAt: utcDateTime;

    @doc("アカウントの最終更新日時 (UTC)")
    updatedAt: utcDateTime;
  }

  @doc("""
    スタッフのアカウントの更新リクエスト - 変えられるのはロールだけ。
    Update のモデルなのでキーは省略できるが、プロパティが1つもない本文は400
    """)
  model StaffAccountUpdateRequest {
    @doc("新しいロール。owner を指定できるのは admin だけ")
    role?: SalonRoleType;
  }
}
