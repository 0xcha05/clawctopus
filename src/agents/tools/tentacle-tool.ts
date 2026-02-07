import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

const TENTACLE_TOOL_ACTIONS = ["list", "shell"] as const;

const TentacleToolSchema = Type.Object({
  action: stringEnum(TENTACLE_TOOL_ACTIONS),
  gatewayUrl: Type.Optional(Type.String()),
  gatewayToken: Type.Optional(Type.String()),
  timeoutMs: Type.Optional(Type.Number()),
  tentacle: Type.Optional(Type.String()),
  command: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  env: Type.Optional(Type.Object({})),
  commandTimeoutMs: Type.Optional(Type.Number()),
});

export function createTentacleTool(): AnyAgentTool {
  return {
    label: "Tentacles",
    name: "tentacle",
    description: "Control remote tentacles (list connected tentacles, run shell commands).",
    parameters: TentacleToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl", { trim: false }),
        gatewayToken: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
      };

      try {
        switch (action) {
          case "list": {
            const result = await callGatewayTool("tentacle.list", gatewayOpts, {});
            return jsonResult(result);
          }
          case "shell": {
            const tentacle = readStringParam(params, "tentacle", { required: true });
            const command = readStringParam(params, "command", { required: true });
            const cwd =
              typeof params.cwd === "string" && params.cwd.trim()
                ? params.cwd.trim()
                : undefined;
            const env =
              typeof params.env === "object" && params.env !== null
                ? (params.env as Record<string, string>)
                : undefined;
            const commandTimeoutMs =
              typeof params.commandTimeoutMs === "number" && Number.isFinite(params.commandTimeoutMs)
                ? params.commandTimeoutMs
                : 30000;

            const result = await callGatewayTool("tentacle.shell", gatewayOpts, {
              tentacleId: tentacle,
              command,
              cwd,
              env,
              timeoutMs: commandTimeoutMs,
            });

            return jsonResult(result);
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`tentacle action=${action}: ${message}`, { cause: err });
      }
    },
  };
}
