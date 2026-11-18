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
  @doc("サロンが扱う添付ファイル(施術の写真や書類)と、その共有リンクのAPI操作群です。ファイルの中身はオブジェクトストレージに置き、アップロードもダウンロードも、短時間だけ有効な署名付きURLで行います。")
  @route("/api/v1/attachments")
  @tag("Attachments")
  namespace AttachmentOperations {
    interface AttachmentCrud {
      @doc("ファイルをオブジェクトストレージへ直接アップロードするための、15分だけ有効なURLを発行し、アップロード待ち(pending)の添付ファイルを作ります。ファイルの中身は API サーバーを通りません。admin と、そのサロンの owner / manager / staff が実行できます(顧客のアカウントは403)。サロンに属さないファイル(salonId が null)を作れるのは admin だけです。本文が不正な場合(受け付けない種類、種類に合わない拡張子、10 MiB を超えるサイズ、存在しないサロン)は400を返します。URLは、申告した種類とサイズを署名に含み、受け付けるのは1回だけです。アップロードのあと、complete で完了させます。")
      @summary("Issue an upload URL")
      @post
      @route("/upload-url")
      getUploadUrl(@body request: AttachmentUploadUrlRequest):
        | {
            @statusCode statusCode: 201;
            @header("Location") location: string;
            @body response: ApiResponse<AttachmentUploadUrlResponse>;
          }
        | ProblemResponse<400>
        | RequestBodyErrors
        | CommonErrors;

      @doc("アップロードを確かめて、添付ファイルをアップロード済み(uploaded)にします。保存先のファイルのサイズと、ファイルの先頭のバイトが申告した種類の形式であることを確かめます。保存先にファイルがない場合は409を返します(アップロード待ちのままなので、アップロードしてからもう一度実行できます)。サイズや形式が申告と違う場合も409を返し、その添付ファイルを削除して、保存先のファイルを消します(アップロード用URLの発行からやり直します)。すでにアップロード済みの添付ファイルは、そのまま返します。実行できるのは、アップロード用URLの発行と同じ利用者です。ほかのサロンの添付ファイルと、削除した添付ファイルは404を返します。")
      @summary("Complete an upload")
      @post
      @route("/{attachmentId}/complete")
      complete(@path attachmentId: AttachmentId):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | CommonErrors;

      @doc("アップロード済み(uploaded)の添付ファイルを、アップロードを確かめた日時の新しい順に一覧します。admin はすべてのサロンとサロンに属さないファイルを、サロンのメンバーは自分のサロンのファイルを一覧できます(顧客のアカウントは403)。サロンのメンバーが salonId にほかのサロンを指定した場合は403を返します。")
      @summary("List attachments")
      @get
      list(...AttachmentSearchRequest):
        | {
            @statusCode statusCode: 200;
            @body response: CursorPaginationResponse<AttachmentResponse>;
          }
        | ProblemResponse<400>
        | CommonErrors;

      @doc("添付ファイルを1件取得します。アップロード待ち(pending)のものも返します。ほかのサロンの添付ファイルと、削除した添付ファイルは404を返します。")
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

      @doc("添付ファイルをダウンロードするための、5分だけ有効なURLを発行します。inline=true の場合はブラウザーの中で表示するURLを、そうでなければ元のファイル名で保存するURLを発行します。アップロード待ち(pending)の添付ファイルは409を返します。")
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
        | ProblemResponse<409>
        | CommonErrors;

      @doc("添付ファイルを削除します。保存先のファイルを消してから、添付ファイルを削除済みにします(一覧にも取得にも出なくなります)。admin と、そのサロンの owner / manager、アップロードした本人が実行できます。保存先のファイルを消せなかった場合は、何も変えずに500を返します(もう一度実行できます)。")
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

      @doc("完了しなかったアップロード(URLの有効期限から24時間たってもアップロード待ちのままの添付ファイル)と、削除した添付ファイル(URLの有効期限を過ぎたもの)を、保存先のファイルが残っていればそれも含めて消し、消した件数を返します。admin だけが実行できます(サロンのメンバーと顧客のアカウントは403)。途中でエラーになった場合は、そこで止めて500を返します(それまでの分は消してあり、もう一度実行すると残りを消します)。定期的に呼ぶのは運用の側です。")
      @summary("Purge unfinished uploads and deleted attachments")
      @post
      @route("/purge")
      purge():
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentPurgeResponse>;
          }
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
        | PublicErrors;

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
        | PublicErrors;
    }
  }
}
