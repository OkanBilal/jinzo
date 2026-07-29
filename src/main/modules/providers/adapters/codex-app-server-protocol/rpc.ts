import type { InitializeParams } from "./generated/InitializeParams";
import type { InitializeResponse } from "./generated/InitializeResponse";
import type { ExperimentalFeatureListParams } from "./generated/v2/ExperimentalFeatureListParams";
import type { ExperimentalFeatureListResponse } from "./generated/v2/ExperimentalFeatureListResponse";
import type { GetAccountParams } from "./generated/v2/GetAccountParams";
import type { GetAccountRateLimitsResponse } from "./generated/v2/GetAccountRateLimitsResponse";
import type { GetAccountResponse } from "./generated/v2/GetAccountResponse";
import type { SkillsListParams } from "./generated/v2/SkillsListParams";
import type { SkillsListResponse } from "./generated/v2/SkillsListResponse";

type JsonObject = Record<string, unknown>;

interface RpcMethod<Params, Result> {
  params: Params;
  result: Result;
}

/**
 * Typed request/result pairs for every app-server RPC currently emitted by
 * codex.driver.ts. Core data surfaces use Codex's generated 0.146.0 bindings;
 * feature-specific surfaces retain a narrow JSON object until they graduate
 * into the generated snapshot.
 */
export interface CodexAppServerRpc {
  initialize: RpcMethod<InitializeParams, InitializeResponse>;
  "account/read": RpcMethod<GetAccountParams, GetAccountResponse>;
  "account/rateLimits/read": RpcMethod<
    undefined,
    GetAccountRateLimitsResponse
  >;
  "experimentalFeature/list": RpcMethod<
    ExperimentalFeatureListParams,
    ExperimentalFeatureListResponse
  >;
  "skills/list": RpcMethod<SkillsListParams, SkillsListResponse>;

  "config/value/write": RpcMethod<JsonObject, JsonObject>;
  "model/list": RpcMethod<JsonObject, JsonObject>;
  "plugin/install": RpcMethod<JsonObject, JsonObject>;
  "plugin/installed": RpcMethod<JsonObject, JsonObject>;
  "plugin/list": RpcMethod<JsonObject, JsonObject>;
  "plugin/read": RpcMethod<JsonObject, JsonObject>;
  "plugin/uninstall": RpcMethod<JsonObject, JsonObject>;
  "review/start": RpcMethod<JsonObject, JsonObject>;
  "thread/fork": RpcMethod<JsonObject, JsonObject>;
  "thread/goal/clear": RpcMethod<JsonObject, JsonObject>;
  "thread/goal/get": RpcMethod<JsonObject, JsonObject>;
  "thread/goal/set": RpcMethod<JsonObject, JsonObject>;
  "thread/read": RpcMethod<JsonObject, JsonObject>;
  "thread/resume": RpcMethod<JsonObject, JsonObject>;
  "thread/start": RpcMethod<JsonObject, JsonObject>;
  "thread/unsubscribe": RpcMethod<JsonObject, JsonObject>;
  "turn/interrupt": RpcMethod<JsonObject, JsonObject>;
  "turn/start": RpcMethod<JsonObject, JsonObject>;
}

export type CodexAppServerMethod = keyof CodexAppServerRpc;
export type CodexAppServerParams<Method extends CodexAppServerMethod> =
  CodexAppServerRpc[Method]["params"];
export type CodexAppServerResult<Method extends CodexAppServerMethod> =
  CodexAppServerRpc[Method]["result"];
