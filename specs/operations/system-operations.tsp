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
  @doc("システム全体の状態監視やデプロイ確認に利用する運用系API操作群です。監視ツールやオーケストレーターが呼び出すため、認証は不要です。")
  @route("/api/system")
  @tag("System")
  @useAuth(NoAuth)
  namespace SystemOperations {
    @doc("APIが正常稼働しているかを判定し、監視ツールやロードバランサーから参照します。")
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

    @doc("Kubernetes等のオーケストレーターがトラフィック受信可否を判断するための準備完了チェックです。")
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

    @doc("プロセスが生存しているかを判定するエンドポイントで、異常時は再起動判定に利用されます。")
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
