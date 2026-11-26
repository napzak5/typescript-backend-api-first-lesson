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
    @doc("1ページあたりの取得件数上限")
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
    共有リンク - share_links の行。アップロード済みの添付ファイルを、アカウントを持たない人に、期限まで見せるためのリンク。
    トークンとパスワードは、ハッシュだけを保存していて、レスポンスに含めない(トークンが出るのは、発行のレスポンスの1度だけ)。
    すべてのプロパティがあり、値がないものは null
    """)
  model ShareLinkResponse {
    @doc("共有リンクの ID")
    id: ShareLinkId;

    @doc("共有する添付ファイルの ID")
    attachmentId: AttachmentId;

    @doc("共有リンクの有効期限。この日時を過ぎると、リンクは使えない")
    expiresAt: utcDateTime;

    @doc("ダウンロード用URLを発行できる回数の上限。制限なしの場合はnull")
    maxDownloads: int32 | null;

    @doc("これまでにダウンロード用URLを発行した回数。上限に達すると、リンクは使えない")
    downloadCount: int32;

    @doc("パスワードで保護しているか")
    hasPassword: boolean;

    @doc("共有リンクを発行したユーザーの ID")
    createdBy: UserId;

    @doc("共有リンクを発行した日時")
    createdAt: utcDateTime;

    @doc("最後に更新した日時(ダウンロード用URLの発行や、パスワードの誤りの記録でも進む)")
    updatedAt: utcDateTime;
  }

  @doc("""
    共有リンク発行リクエスト - 添付ファイルの共有リンクを発行する。
    全項目のキーが必須。制限を設けない項目は null を指定する
    """)
  model ShareLinkCreateRequest {
    @doc("共有リンクの有効期限。発行の時刻より後で、30日後まで")
    expiresAt: utcDateTime;

    @doc("ダウンロード用URLを発行できる回数の上限(1以上)。制限なしの場合はnull")
    @minValue(1)
    maxDownloads: int32 | null;

    @doc("共有リンクを保護するパスワード(8〜128文字)。保護しない場合はnull。単純な並びや、よく知られた値は検証エラー")
    @minLength(8)
    @maxLength(128)
    password: string | null;
  }

  @doc("""
    共有リンクの発行の結果 - 発行した共有リンクと、そのトークン。
    トークンは保存していないので、このレスポンスでしか得られない
    """)
  model ShareLinkCreateResponse {
    @doc("発行した共有リンク")
    shareLink: ShareLinkResponse;

    @doc("共有リンクのトークン。閲覧者は、これ(と、あればパスワード)でファイルにアクセスする。なくした場合は、共有リンクを失効して発行し直す")
    token: string;
  }

  @doc("""
    共有リンク一覧リクエスト - ページネーションを指定する
    """)
  model ShareLinkSearchRequest {
    @query
    @doc("1ページあたりの取得件数上限")
    @minValue(1)
    @maxValue(100)
    limit?: int32 = 20;

    @query
    @doc("取得開始位置を示すカーソル。同じ添付ファイルの一覧で取得した前回レスポンスの `meta.nextCursor` を指定する。その添付ファイルの共有リンクのIDでない場合は検証エラー")
    cursor?: string;
  }

  @doc("""
    共有ファイル - 共有リンクの閲覧者に示す、ファイルの名前、種類、サイズ。
    認証なしで取得できるので、添付ファイルのIDやアップロードしたユーザーなどの内部の値は含めない
    """)
  model SharedFileResponse {
    @doc("アップロードした元のファイル名。ダウンロードするときの名前になる")
    filename: string;

    @doc("ファイルの種類")
    contentType: AttachmentContentType;

    @doc("ファイルのサイズ(バイト)")
    size: int32;
  }

  @doc("""
    共有ファイルの取得リクエスト - 共有リンクのトークンと、パスワードを指定する。
    トークンもパスワードも、URLやアクセスログに残らないように、リクエスト本文で送る。
    全項目のキーが必須。パスワードがない場合は null を送る
    """)
  model SharedFileGetRequest {
    @doc("共有リンクのトークン")
    @minLength(1)
    @maxLength(255)
    token: string;

    @doc("共有リンクのパスワード(1〜128文字)。パスワードで保護していないリンクでは null")
    @minLength(1)
    @maxLength(128)
    password: string | null;
  }

  @doc("""
    共有ファイルのダウンロード用URLの発行リクエスト - 共有リンクのトークンと、パスワード、URLの表示方法を指定する。
    全項目のキーが必須。パスワードがない場合は null を送る
    """)
  model SharedFileDownloadUrlRequest {
    @doc("共有リンクのトークン")
    @minLength(1)
    @maxLength(255)
    token: string;

    @doc("共有リンクのパスワード(1〜128文字)。パスワードで保護していないリンクでは null")
    @minLength(1)
    @maxLength(128)
    password: string | null;

    @doc("trueの場合はブラウザ内で表示するためのURLを、falseの場合は保存(ダウンロード)するためのURLを発行する")
    inline: boolean;
  }
}
