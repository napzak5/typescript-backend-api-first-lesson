import "@typespec/http";
import "./_shared/common.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
  @doc("添付ファイルの共有リンクを識別するブランド付きUUID。")
  @format("uuid")
  scalar ShareLinkId extends string;

  @doc("""
    添付ファイルの種類(Content-Type)。受け付けるのは、この4つだけ
    image/jpeg: JPEG 画像(拡張子 .jpg / .jpeg)
    image/png: PNG 画像(拡張子 .png)
    image/webp: WebP 画像(拡張子 .webp)
    application/pdf: PDF 文書(拡張子 .pdf)
    """)
  enum AttachmentContentType {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
  }

  @doc("""
    添付ファイルの状態
    pending: アップロード待ち - アップロード用のURLを発行し、アップロードをまだ確かめていない。一覧に含まれず、ダウンロードできない
    uploaded: アップロード済み - 保存先のファイルを確かめた(complete)。一覧に含まれ、ダウンロードできる
    """)
  enum AttachmentStatusType {
    pending,
    uploaded,
  }

  @doc("""
    添付ファイル - attachments の行。ファイルの中身は、オブジェクトストレージにある。
    保存先のキーは内部の値で、レスポンスに含めない。すべてのプロパティがあり、値がないものは null
    """)
  model AttachmentResponse {
    @doc("添付ファイルの ID")
    id: AttachmentId;

    @doc("ファイルが属するサロンの ID。サロンに属さないファイル(admin だけが扱える)はnull")
    salonId: SalonId | null;

    @doc("アップロードした元のファイル名。ダウンロードするときの名前になる")
    filename: string;

    @doc("ファイルの種類")
    contentType: AttachmentContentType;

    @doc("ファイルのサイズ(バイト)。1〜10,485,760(10 MiB)")
    size: int32;

    @doc("添付ファイルの状態")
    status: AttachmentStatusType;

    @doc("アップロード用のURLを発行したユーザーの ID")
    uploadedBy: UserId;

    @doc("アップロード用のURLの有効期限。発行の15分後")
    uploadExpiresAt: utcDateTime;

    @doc("アップロードを確かめた日時。アップロード待ち(pending)のあいだはnull")
    uploadedAt: utcDateTime | null;

    @doc("アップロード用のURLを発行した日時")
    createdAt: utcDateTime;

    @doc("最後に更新した日時")
    updatedAt: utcDateTime;
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
    @doc("取得開始位置を示すカーソル。同じ絞り込み条件で取得した前回レスポンスの `meta.nextCursor` を指定する。一覧に出る添付ファイルのIDでない場合は検証エラー")
    cursor?: string;

    @query
    @doc("ファイルが属するサロンIDによる絞り込み(完全一致)。省略した場合はサロンで絞り込まない")
    salonId?: SalonId;
  }

  @doc("""
    アップロード用URLの発行リクエスト - アップロードするファイルの名前、種類、サイズを申告する。
    全項目のキーが必須。null を指定できる項目は null を送る
    """)
  model AttachmentUploadUrlRequest {
    @doc("アップロードするファイルの名前(1〜255文字)。制御文字と / と \\ を含められない。拡張子は、種類(contentType)に対応するものに限る(大文字と小文字は区別しない)")
    @minLength(1)
    @maxLength(255)
    filename: string;

    @doc("アップロードするファイルの種類")
    contentType: AttachmentContentType;

    @doc("アップロードするファイルのサイズ(バイト)。1〜10,485,760(10 MiB)")
    @minValue(1)
    @maxValue(10485760)
    size: int32;

    @doc("ファイルが属するサロンの ID。サロンに属さないファイル(admin だけが作れる)はnull")
    salonId: SalonId | null;
  }

  @doc("""
    アップロード用URLの発行の結果 - アップロード待ち(pending)の添付ファイルと、ファイルの中身を送る先。
    uploadUrl に、uploadHeaders のヘッダーを付けて、申告したサイズちょうどの本文を PUT で送る
    """)
  model AttachmentUploadUrlResponse {
    @doc("作成した、アップロード待ち(pending)の添付ファイル")
    attachment: AttachmentResponse;

    @doc("ファイルの中身を PUT で送るURL。attachment.uploadExpiresAt まで有効で、受け付けるのは1回だけ")
    uploadUrl: string;

    @doc("PUT のリクエストに付けるヘッダー(名前と値)。署名に含まれているので、1つでも欠けたり値が違ったりすると、保存先が拒否する")
    uploadHeaders: Record<string>;
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

  @doc("完了しなかったアップロードと、削除した添付ファイルの掃除の結果")
  model AttachmentPurgeResponse {
    @doc("消した添付ファイルの行の数")
    purgedCount: int32;
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
    共有ファイルレスポンス - 共有リンクの閲覧者に示す、公開対象ファイルのメタ情報を返す。
    認証なしで取得できるため、保存先のキーやアップロードしたユーザーなどの内部情報は含めない
    """)
  model SharedFileResponse {
    @doc("利用者がアップロードした元のファイル名。")
    filename: string;

    @doc("ファイルのMIMEタイプ（Content-Type）。")
    content: string;

    @doc("ファイルサイズ（バイト単位）。")
    size: int32;
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
