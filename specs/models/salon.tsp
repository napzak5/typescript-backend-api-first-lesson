import "@typespec/http";
import "./_shared/common.tsp";
import "./_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("""
    サロンレスポンス - salons テーブルの公開カラムと、営業日カレンダー(opening_hours)を返す。
    プロパティ名と null 許可は DB カラムと一致させている。
    """)
  model SalonResponse {
    @doc("サロンを一意に識別するID")
    id: SalonId;

    @doc("公式名称またはブランド名称")
    name: string;

    @doc("名称のカナ表記。未設定の場合はnull")
    nameKana: string | null;

    @doc("サロンの特徴やコンセプトを伝える説明文。未設定の場合はnull")
    description: string | null;

    @doc("郵便番号。未設定の場合はnull")
    postalCode: string | null;

    @doc("都道府県名")
    prefecture: string;

    @doc("市区町村名")
    city: string;

    @doc("町名・番地")
    address: string;

    @doc("建物名・部屋番号。未設定の場合はnull")
    building: string | null;

    @doc("緯度(十進度)。未設定の場合はnull")
    latitude: float64 | null;

    @doc("経度(十進度)。未設定の場合はnull")
    longitude: float64 | null;

    @doc("代表電話番号")
    phoneNumber: string;

    @doc("予備の電話番号。未設定の場合はnull")
    alternativePhone: string | null;

    @doc("問い合わせ用メールアドレス。削除されていないサロンの間で一意")
    email: string;

    @doc("公式サイトのURL。未設定の場合はnull")
    websiteUrl: string | null;

    @doc("ロゴ画像のURL。未設定の場合はnull")
    logoUrl: string | null;

    @doc("店舗写真や内装画像のURL一覧")
    imageUrls: string[];

    @doc("サービスやこだわりポイント等の特徴タグ一覧")
    features: string[];

    @doc("Wi-Fi・駐車場などの設備タグ一覧")
    amenities: string[];

    @doc("曜日別の通常営業時間。未設定の場合はnull")
    businessHours: BusinessHours[] | null;

    @doc("顧客レビューの全体満足度評価(overallRating)の平均値。小数第2位に四捨五入する。レビューを投稿したトランザクションが数え直す。レビュー未登録の場合はnull")
    rating: float32 | null;

    @doc("顧客レビューの件数。レビューを投稿したトランザクションが数え直す")
    reviewCount: int32;

    @doc("営業時間と、予約の来店日の基準となるIANAタイムゾーンID(例: Asia/Tokyo)")
    timezone: string;

    @doc("料金表示に使用する通貨コード(ISO 4217)")
    currency: string;

    @doc("消費税率(%)")
    taxRate: float64;

    @doc("予約受付中かどうか")
    isActive: boolean;

    @doc("日付単位の営業日カレンダー")
    openingHours: OpeningHours[];

    @doc("レコード作成日時")
    createdAt: utcDateTime;

    @doc("レコード最終更新日時")
    updatedAt: utcDateTime;
  }

  @doc("""
    サロン新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる
    """)
  model SalonCreateRequest {
    @doc("公式名称またはブランド名称")
    @minLength(1)
    @maxLength(255)
    name: string;

    @doc("名称のカナ表記。未設定の場合はnull")
    @maxLength(255)
    nameKana: string | null;

    @doc("サロン紹介文。未設定の場合はnull")
    description: string | null;

    @doc("郵便番号。未設定の場合はnull")
    @maxLength(10)
    postalCode: string | null;

    @doc("都道府県名")
    @minLength(1)
    @maxLength(50)
    prefecture: string;

    @doc("市区町村名")
    @minLength(1)
    @maxLength(100)
    city: string;

    @doc("町名・番地")
    @minLength(1)
    @maxLength(255)
    address: string;

    @doc("建物名・部屋番号。未設定の場合はnull")
    @maxLength(255)
    building: string | null;

    @doc("緯度(十進度)。未設定の場合はnull")
    @minValue(-90)
    @maxValue(90)
    latitude: float64 | null;

    @doc("経度(十進度)。未設定の場合はnull")
    @minValue(-180)
    @maxValue(180)
    longitude: float64 | null;

    @doc("代表電話番号。数字、空白、ハイフン、+、丸括弧で書き、数字を10個以上含む")
    @maxLength(20)
    phoneNumber: string;

    @doc("予備の電話番号。数字、空白、ハイフン、+、丸括弧で書き、数字を10個以上含む。未設定の場合はnull")
    @maxLength(20)
    alternativePhone: string | null;

    @doc("問い合わせ用メールアドレス。削除されていないサロンの間で一意")
    @maxLength(255)
    email: string;

    @doc("公式サイトのURL。未設定の場合はnull")
    @maxLength(500)
    websiteUrl: string | null;

    @doc("ロゴ画像のURL。未設定の場合はnull")
    @maxLength(500)
    logoUrl: string | null;

    @doc("店舗写真や内装画像のURL一覧")
    imageUrls: string[];

    @doc("サービスやこだわりポイント等の特徴タグ一覧")
    features: string[];

    @doc("Wi-Fi・駐車場などの設備タグ一覧")
    amenities: string[];

    @doc("曜日別の通常営業時間。未設定の場合はnull")
    businessHours: BusinessHours[] | null;

    @doc("営業時間と、予約の来店日の基準となるIANAタイムゾーンID(例: Asia/Tokyo)。タイムゾーンの名前として認識できない値と、+09:00 のようなオフセットは400")
    @maxLength(50)
    timezone: string;

    @doc("料金表示に使用する通貨コード(ISO 4217)。英大文字3文字")
    @pattern("^[A-Z]{3}$")
    @minLength(3)
    @maxLength(3)
    currency: string;

    @doc("消費税率(%)")
    @minValue(0)
    @maxValue(100)
    taxRate: float64;

    @doc("予約受付中かどうか")
    isActive: boolean;

    @doc("日付単位の営業日カレンダー")
    openingHours: OpeningHours[];
  }

  @doc("""
    サロン部分更新リクエスト - 指定した項目だけを更新する。DB で NULL 許可のカラムは null でクリアできる。
    openingHours を指定した場合は営業日カレンダー全体を置き換える
    """)
  model SalonUpdateRequest {
    @doc("公式名称またはブランド名称")
    @minLength(1)
    @maxLength(255)
    name?: string;

    @doc("名称のカナ表記。nullでクリア")
    @maxLength(255)
    nameKana?: string | null;

    @doc("サロン紹介文。nullでクリア")
    description?: string | null;

    @doc("郵便番号。nullでクリア")
    @maxLength(10)
    postalCode?: string | null;

    @doc("都道府県名")
    @minLength(1)
    @maxLength(50)
    prefecture?: string;

    @doc("市区町村名")
    @minLength(1)
    @maxLength(100)
    city?: string;

    @doc("町名・番地")
    @minLength(1)
    @maxLength(255)
    address?: string;

    @doc("建物名・部屋番号。nullでクリア")
    @maxLength(255)
    building?: string | null;

    @doc("緯度(十進度)。nullでクリア")
    @minValue(-90)
    @maxValue(90)
    latitude?: float64 | null;

    @doc("経度(十進度)。nullでクリア")
    @minValue(-180)
    @maxValue(180)
    longitude?: float64 | null;

    @doc("代表電話番号。数字、空白、ハイフン、+、丸括弧で書き、数字を10個以上含む")
    @maxLength(20)
    phoneNumber?: string;

    @doc("予備の電話番号。数字、空白、ハイフン、+、丸括弧で書き、数字を10個以上含む。nullでクリア")
    @maxLength(20)
    alternativePhone?: string | null;

    @doc("問い合わせ用メールアドレス。削除されていないサロンの間で一意")
    @maxLength(255)
    email?: string;

    @doc("公式サイトのURL。nullでクリア")
    @maxLength(500)
    websiteUrl?: string | null;

    @doc("ロゴ画像のURL。nullでクリア")
    @maxLength(500)
    logoUrl?: string | null;

    @doc("店舗写真や内装画像のURL一覧")
    imageUrls?: string[];

    @doc("サービスやこだわりポイント等の特徴タグ一覧")
    features?: string[];

    @doc("Wi-Fi・駐車場などの設備タグ一覧")
    amenities?: string[];

    @doc("曜日別の通常営業時間。nullでクリア")
    businessHours?: BusinessHours[] | null;

    @doc("営業時間と、予約の来店日の基準となるIANAタイムゾーンID(例: Asia/Tokyo)。タイムゾーンの名前として認識できない値と、+09:00 のようなオフセットは400")
    @maxLength(50)
    timezone?: string;

    @doc("料金表示に使用する通貨コード(ISO 4217)。英大文字3文字")
    @pattern("^[A-Z]{3}$")
    @minLength(3)
    @maxLength(3)
    currency?: string;

    @doc("消費税率(%)")
    @minValue(0)
    @maxValue(100)
    taxRate?: float64;

    @doc("予約受付中かどうか")
    isActive?: boolean;

    @doc("日付単位の営業日カレンダー。指定した場合は全件を置き換える")
    openingHours?: OpeningHours[];
  }

  @doc("""
    サロン一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model SalonSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("名称・説明文に対する部分一致キーワード(大文字小文字を区別しない)")
    @minLength(1)
    @maxLength(100)
    keyword?: string;

    @query
    @doc("都道府県名による絞り込み(完全一致)")
    prefecture?: string;

    @query
    @doc("市区町村名による絞り込み(完全一致)")
    city?: string;

    @query
    @doc("予約受付中かどうかによる絞り込み")
    isActive?: boolean;

    @query
    @doc("最低評価値による絞り込み。評価のないサロンは除外される")
    @minValue(0)
    @maxValue(5)
    minRating?: float32;

    @query(#{ explode: true })
    @doc("特徴タグによる絞り込み。指定したタグをすべて持つサロンに一致する")
    features?: string[];
  }
}
