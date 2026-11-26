import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @route("/api/system")
  @tag("System")
  @useAuth(NoAuth)
  namespace SystemOperations {
    @doc("依存先 (データベース) が応答するかを確かめ、依存先ごとの結果を返します。3 秒待っても応答しない依存先があるときは 503 です。")
    @summary("Check API health")
    @get
    @route("health")
    op health():
      | {
          @statusCode statusCode: 200;
          @body response: HealthStatus;
        }
      | {
          @statusCode statusCode: 503;
          @body response: HealthStatus;
        };

    @doc("リクエストを処理できる状態かを答えます。3 秒待っても応答しない依存先があるときは 503 で、リクエストを振り分けないでください。")
    @summary("Check API readiness")
    @get
    @route("ready")
    op ready():
      | {
          @statusCode statusCode: 200;
          @body response: SystemReadyResponse;
        }
      | {
          @statusCode statusCode: 503;
          @body response: SystemReadyResponse;
        };

    @doc("プロセスが動いていれば 200 です。依存先は確かめません。応答がないときは、プロセスを再起動してください。")
    @summary("Check API liveness")
    @get
    @route("alive")
    op alive(): {
      @statusCode statusCode: 200;
      @body response: {
        alive: true;
      };
    };
  }
}
