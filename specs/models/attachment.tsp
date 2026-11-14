import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("添付ファイルの共有リンクを識別するブランド付きUUID。")
  @format("uuid")
  scalar ShareLinkId extends string;

  @doc("""
    ファイルタイプ区分 - アップロードされるファイルの種類を分類
    
    image: 画像 - 写真やイラスト等の画像ファイル（jpg, png, gif等）
    document: ドキュメント - PDF、Word、Excel等の文書ファイル
    other: その他 - 上記に分類されないファイル
    """)
  enum FileType {
    image: "image",
    document: "document",
    other: "other",
  }

  @doc("""
    添付ファイルレスポンス - サロンシステムで管理するアップロード済みファイルのメタ情報を返す。
    対応するテーブルはまだない。全項目のキーが必須で、値がない項目は null を返す
    """)
  model AttachmentResponse {
    @doc("添付ファイルを一意に識別するID。UUID形式。")
    id: AttachmentId;

    @doc("オブジェクトストレージでファイルを参照するための内部キー。")
    key: string;

    @doc("利用者がアップロードした元のファイル名。")
    filename: string;

    @doc("ファイルのMIMEタイプ（Content-Type）。")
    content: string;

    @doc("ファイルサイズ（バイト単位）。")
    size: int32;

    @doc("ファイルの実体情報。ダウンロードや共有レスポンスで利用。")
    file: File;

    @doc("ファイルをアップロードしたユーザーID。")
    uploadedBy: UserId;

    @doc("ファイルが紐づくサロンID。全社共通ファイルやシステムファイルの場合はnull。")
    salonId: SalonId | null;

    @doc("必要に応じて付加情報を保持する任意メタデータ。追加情報が不要な場合はnull。")
    metadata: Record<unknown> | null;

    @doc("ラベリングや検索に利用するタグ情報のセット。タグ付けをしていない場合はnull。")
    tags: Record<string> | null;

    @doc("ファイルがアップロードされた日時。")
    uploadedAt: utcDateTime;

    @doc("ファイル情報が最後に更新された日時。")
    updatedAt: utcDateTime;
  }

  @doc("""
    添付ファイル登録リクエスト - multipart/form-data でファイル本体と属性を送り、添付ファイルを登録する。
    multipart/form-data では null を送れないため、値がない項目はパートごと省略する
    """)
  model AttachmentCreateRequest {
    @doc("HTTPリクエストで送信されるファイル本体。")
    file: HttpPart<File>;

    @doc("アップロード時に指定されたファイル名。")
    filename: HttpPart<string>;

    @doc("ファイルのContent-Type。")
    content: HttpPart<string>;

    @doc("ファイルを関連付けるサロンID。全社共通ファイルの場合は省略する(レスポンスのsalonIdはnullになる)。")
    salonId?: HttpPart<SalonId>;

    @doc("タグ情報を表すJSON文字列。タグを設定しない場合は省略する(レスポンスのtagsはnullになる)。")
    tags?: HttpPart<string>;
  }

  @doc("""
    添付ファイル一覧・検索リクエスト - 絞り込み条件とページネーションを指定する。条件はすべて AND で結合する
    """)
  model AttachmentSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限 (1〜100)")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
    cursor?: string;

    @query
    @doc("ファイルが紐づくサロンIDによる絞り込み(完全一致)。省略した場合はサロンで絞り込まない")
    salonId?: SalonId;
  }

  @doc("""
    アップロード用署名付きURL発行リクエスト - 外部ストレージへ直接アップロードするための署名付きURLを要求する。
    全項目のキーが必須。null を指定できる項目は null を送る
    """)
  model AttachmentUploadUrlRequest {
    @doc("アップロード予定のファイル名。")
    @minLength(1)
    @maxLength(255)
    filename: string;

    @doc("アップロード予定ファイルのContent-Type。")
    @minLength(1)
    @maxLength(255)
    content: string;

    @doc("アップロード予定ファイルのサイズ（バイト単位）。")
    @minValue(1)
    size: int32;

    @doc("ファイルをひも付けるサロンID。全社共通ファイルの場合はnull。")
    salonId: SalonId | null;
  }

  @doc("署名付きアップロードURLと関連情報を返すレスポンス。")
  model AttachmentUploadUrlResponse {
    @doc("一時的に有効なアップロード用URL。")
    uploadUrl: string;

    @doc("生成されたストレージキー。アップロード完了後の識別に使用。")
    key: string;

    @doc("署名付きURLの有効期限。")
    expiresAt: utcDateTime;
  }

  @doc("ダウンロード用署名付きURL発行リクエスト - 発行するURLの表示方法を指定する")
  model AttachmentDownloadUrlRequest {
    @query
    @doc("trueの場合はブラウザ内で表示するためのURLを、falseの場合は保存(ダウンロード)するためのURLを発行する")
    inline?: boolean = false;
  }

  @doc("添付ファイルをダウンロードするための署名付きURLを返すレスポンス。")
  model AttachmentDownloadUrlResponse {
    @doc("一時的に有効なダウンロード用URL。")
    downloadUrl: string;

    @doc("署名付きURLの有効期限。")
    expiresAt: utcDateTime;
  }

  @doc("""
    共有リンクレスポンス - 外部共有用に発行された添付ファイルの共有リンク情報を返す。
    対応するテーブルはまだない。全項目のキーが必須で、値がない項目は null を返す
    """)
  model ShareLinkResponse {
    @doc("共有リンクを一意に識別するID。")
    id: ShareLinkId;

    @doc("共有アクセス時に利用するトークン。")
    token: string;

    @doc("共有対象の添付ファイルID。")
    attachmentId: AttachmentId;

    @doc("共有リンクの有効期限。無期限の場合はnull。")
    expiresAt: utcDateTime | null;

    @doc("許可する最大ダウンロード回数。無制限の場合はnull。")
    maxDownloads: int32 | null;

    @doc("これまでのダウンロード累計数。")
    downloadCount: int32;

    @doc("共有リンクがパスワード保護されているか。")
    hasPassword: boolean;

    @doc("アクセスを許可するメールアドレス一覧。制限なしの場合はnull。")
    allowedEmails: string[] | null;

    @doc("共有リンクを作成したユーザーID。")
    createdBy: UserId;

    @doc("共有リンクを作成した日時。")
    createdAt: utcDateTime;
  }

  @doc("""
    共有リンク発行リクエスト - 添付ファイルの共有リンクを新規発行する。
    全項目のキーが必須。制限を設けない項目は null を指定する
    """)
  model ShareLinkCreateRequest {
    @doc("共有リンクの有効期限。無期限の場合はnull。")
    expiresAt: utcDateTime | null;

    @doc("許可する最大ダウンロード回数(1以上)。無制限の場合はnull。")
    @minValue(1)
    maxDownloads: int32 | null;

    @doc("共有リンク保護用のパスワード(8〜128文字)。パスワード保護なしの場合はnull。")
    @minLength(8)
    @maxLength(128)
    password: string | null;

    @doc("アクセスを許可するメールアドレス一覧(1〜100件)。制限なしの場合はnull。")
    @minItems(1)
    @maxItems(100)
    allowedEmails: string[] | null;
  }

  @doc("""
    共有リンク一覧リクエスト - ページネーションを指定する
    """)
  model ShareLinkSearchRequest {
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
    共有リンクアクセスリクエスト - 共有リンク経由で添付ファイルへアクセスする際の条件を指定する
    """)
  model ShareLinkAccessRequest {
    @query
    @doc("共有リンクのパスワード。パスワード保護された共有リンクでは必須。パスワード保護されていない場合は省略する")
    password?: string;
  }
}
