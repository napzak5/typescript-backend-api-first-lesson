import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/attachment.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @doc("サロン業務で扱う添付ファイルの登録・共有を統括するAPI操作群です。画像や書類を安全に保管し、スタッフと顧客の利便性を高めます。")
  @route("/api/v1/attachments")
  @tag("Attachments")
  namespace AttachmentOperations {
    interface AttachmentCrud {
      @doc("スタッフが管理画面からファイル本体を直接アップロードし、予約記録や顧客カルテに紐づけるための操作です。multipart/form-dataで送信します。salonIdに存在しないサロンを指定した場合は400を、ファイルがサイズ上限を超える場合は413を返します。")
      @summary("Upload an attachment")
      @post
      @route("/upload")
      uploadFile(
        @header contentType: "multipart/form-data",
        @multipartBody request: AttachmentCreateRequest,
      ):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<AttachmentResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("顧客やスタッフがブラウザから直接クラウドストレージへアップロードできるよう、短時間だけ有効な署名付きURLを発行します。salonIdに存在しないサロンを指定した場合は400を返します。")
      @summary("Issue an upload URL")
      @post
      @route("/upload-url")
      getUploadUrl(@body request: AttachmentUploadUrlRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentUploadUrlResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("登録済みの添付ファイルを、サロンによる絞り込みとページネーションを指定して一覧し、施術履歴の確認や資料整理に活用します。")
      @summary("List attachments")
      @get
      list(...AttachmentSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<AttachmentResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("指定した添付ファイルの詳細情報を取得し、プレビュー表示や関連予約の確認に用います。")
      @summary("Get an attachment")
      @get
      @route("/{attachmentId}")
      get(@path attachmentId: AttachmentId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("閲覧権限を持つ利用者がファイルを安全に取得できるよう、短時間有効なダウンロードURLを発行します。")
      @summary("Issue a download URL")
      @get
      @route("/{attachmentId}/download-url")
      getDownloadUrl(
        @path attachmentId: AttachmentId,
        ...AttachmentDownloadUrlRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentDownloadUrlResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("不要になった添付ファイルを削除し、ストレージ容量の最適化と情報漏えいリスクの低減を図ります。")
      @summary("Delete an attachment")
      @delete
      @route("/{attachmentId}")
      delete(@path attachmentId: AttachmentId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }

    interface ShareLinkCrud {
      @doc("施術前後の写真や資料を外部パートナーや顧客と共有するためのリンクを発行します。必要に応じてパスワード保護も適用します。添付ファイルが存在しない場合は404を返します。")
      @summary("Create a share link")
      @post
      @route("/{attachmentId}/share-links")
      create(
        @path attachmentId: AttachmentId,
        @body request: ShareLinkCreateRequest,
      ):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<ShareLinkResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | RequestBodyErrors
        | CommonErrors;

      @doc("対象ファイルに対して発行済みの共有リンクを一覧し、公開状況や有効期限の管理を行います。添付ファイルが存在しない場合は404を返します。")
      @summary("List share links")
      @get
      @route("/{attachmentId}/share-links")
      list(@path attachmentId: AttachmentId, ...ShareLinkSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<ShareLinkResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("IDを指定して共有リンクを1件取得し、公開状況や有効期限、ダウンロード回数を確認します。")
      @summary("Get a share link")
      @get
      @route("/share-links/{shareLinkId}")
      get(@path shareLinkId: ShareLinkId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<ShareLinkResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("不要になった共有リンクを失効させ、アクセス制御を適切に保ちます。失効後の共有リンクへのアクセスには404を返します。")
      @summary("Delete a share link")
      @delete
      @route("/share-links/{shareLinkId}")
      delete(@path shareLinkId: ShareLinkId):
        | {
            @statusCode statusCode: 204;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }

  @doc("共有リンク経由で添付ファイルへアクセスするためのAPIセットです。ゲスト利用者の利便性を確保しつつ、アクセス制御を実現します。アカウントを持たない利用者が使うため認証を必要としません。")
  @route("/api/v1/share")
  @tag("Share")
  @useAuth(NoAuth)
  namespace ShareOperations {
    interface SharedFileCrud {
      @doc("共有リンクとパスワードを確認し、公開対象ファイルのメタ情報を閲覧者に提示します。パスワード保護された共有リンクでパスワードが指定されていないか一致しない場合は401を、トークンが存在しない場合と、共有リンクが有効期限切れ・ダウンロード回数の上限到達・失効のいずれかの場合は404を返します。")
      @summary("Get a shared file")
      @get
      @route("/{shareToken}")
      get(
        @doc("共有リンクのトークン")
        @path
        shareToken: string,

        ...ShareLinkAccessRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SharedFileResponse>;
          }
        | ProblemResponse<401>
        | ProblemResponse<404>
        | CommonErrors;

      @doc("共有リンク利用者が安全にファイル本体を取得できるよう、署名付きダウンロードURLを返却します。パスワード保護された共有リンクでパスワードが指定されていないか一致しない場合は401を、トークンが存在しない場合と、共有リンクが有効期限切れ・ダウンロード回数の上限到達・失効のいずれかの場合は404を返します。")
      @summary("Issue a download URL for a shared file")
      @get
      @route("/{shareToken}/download")
      getDownloadUrl(
        @doc("共有リンクのトークン")
        @path
        shareToken: string,

        ...ShareLinkAccessRequest,
      ):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentDownloadUrlResponse>;
          }
        | ProblemResponse<401>
        | ProblemResponse<404>
        | CommonErrors;
    }
  }
}
