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
      @doc("アップロード済みの添付ファイルを、アカウントを持たない人(顧客、取引先)に見せるための共有リンクを発行します。リンクのトークンは、このレスポンスにだけ含まれます(サーバーはハッシュだけを保存します)。admin と、添付ファイルのサロンの owner / manager が実行できます(staff と顧客のアカウントは403)。サロンに属さない添付ファイルの共有リンクを扱えるのは admin だけです。本文が不正な場合(過去の有効期限、30日より先の有効期限、単純すぎるパスワード)は400を、ほかのサロンの添付ファイルと削除した添付ファイルは404を、アップロード待ち(pending)の添付ファイルは409を返します。")
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
            @body response: ApiResponse<ShareLinkCreateResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<404>
        | ProblemResponse<409>
        | RequestBodyErrors
        | CommonErrors;

      @doc("添付ファイルの共有リンクを、発行の新しい順に一覧します。有効期限を過ぎたものと、ダウンロード回数の上限に達したものも含みます(失効したものは含みません)。実行できるのは、共有リンクの発行と同じ利用者です。ほかのサロンの添付ファイルと削除した添付ファイルは404を返します。")
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

      @doc("共有リンクを1件取得し、有効期限、ダウンロード回数、パスワードで保護しているかを確認します。実行できるのは、共有リンクの発行と同じ利用者です。ほかのサロンの添付ファイルの共有リンクと、削除した添付ファイルの共有リンクは404を返します。")
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

      @doc("共有リンクを失効します。そのトークンでのアクセスは、すぐに404になります。実行できるのは、共有リンクの発行と同じ利用者です。失効した共有リンクは404を返します。")
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

  @doc("共有リンクで添付ファイルにアクセスするためのAPI操作群です。アカウントを持たない閲覧者が使うので、認証を必要としません。トークンとパスワードは、URLやアクセスログに残らないように、リクエスト本文で受け取ります。")
  @route("/api/v1/share")
  @tag("Share")
  @useAuth(NoAuth)
  namespace ShareOperations {
    interface SharedFileCrud {
      @doc("共有リンクのトークンとパスワードを確かめて、ファイルの名前、種類、サイズを返します。トークンが存在しない場合と、共有リンクが有効期限切れ・ダウンロード回数の上限到達・失効のいずれかの場合、添付ファイルが削除されている場合は、区別せずに404を返します。パスワードで保護している共有リンクで、パスワードがないか一致しない場合は403を返します。一致しないパスワードが5回続くと、共有リンクを15分のあいだロックし、そのあいだは正しいパスワードでも同じ403を返します。")
      @summary("Get a shared file")
      @post
      @route("/file")
      get(@body request: SharedFileGetRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<SharedFileResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<403>
        | ProblemResponse<404>
        | RequestBodyErrors
        | PublicErrors;

      @doc("共有リンクのトークンとパスワードを確かめて、ファイルをダウンロードするための、5分だけ有効なURLを発行し、共有リンクのダウンロード回数を1増やします。404と403を返す条件は、共有ファイルの取得と同じです。")
      @summary("Issue a download URL for a shared file")
      @post
      @route("/download-url")
      getDownloadUrl(@body request: SharedFileDownloadUrlRequest):
        | {
            @statusCode statusCode: 200;
            @body response: ApiResponse<AttachmentDownloadUrlResponse>;
          }
        | ProblemResponse<400>
        | ProblemResponse<403>
        | ProblemResponse<404>
        | RequestBodyErrors
        | PublicErrors;
    }
  }
}
