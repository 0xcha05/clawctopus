import type { GatewayRequestHandler } from "./types.js";

export const tentacleHandlers: Record<string, GatewayRequestHandler> = {
  "tentacle.list": async ({ respond, context }) => {
    const tentacles = context.tentacleRegistry.listConnected();
    const payload = {
      tentacles: tentacles.map((t) => ({
        tentacleId: t.tentacleId,
        displayName: t.displayName,
        platform: t.platform,
        version: t.version,
        caps: t.caps,
        connectedAtMs: t.connectedAtMs,
        remoteIp: t.remoteIp,
      })),
    };
    respond(true, payload);
  },

  "tentacle.shell": async ({ params, respond, context }) => {
    const tentacleId =
      params && typeof params === "object" && "tentacleId" in params
        ? String(params.tentacleId)
        : null;
    const command =
      params && typeof params === "object" && "command" in params
        ? String(params.command)
        : null;

    if (!tentacleId) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "tentacleId required" });
      return;
    }

    if (!command) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "command required" });
      return;
    }

    const cwd =
      params && typeof params === "object" && "cwd" in params && typeof params.cwd === "string"
        ? params.cwd
        : undefined;

    const env =
      params &&
      typeof params === "object" &&
      "env" in params &&
      typeof params.env === "object" &&
      params.env !== null
        ? (params.env as Record<string, string>)
        : undefined;

    const timeoutMs =
      params &&
      typeof params === "object" &&
      "timeoutMs" in params &&
      typeof params.timeoutMs === "number"
        ? params.timeoutMs
        : 30000;

    const result = await context.tentacleRegistry.invoke({
      tentacleId,
      command: "shell",
      params: {
        command,
        cwd,
        env,
        timeoutMs,
      },
      timeoutMs: timeoutMs + 5000, // Add buffer for network overhead
    });

    if (!result.ok) {
      respond(false, undefined, result.error ?? { code: "UNKNOWN", message: "invoke failed" });
      return;
    }

    let payload: unknown = {};
    if (result.payloadJSON) {
      try {
        payload = JSON.parse(result.payloadJSON);
      } catch {
        payload = { raw: result.payloadJSON };
      }
    }

    respond(true, payload);
  },
};
