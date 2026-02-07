import { randomUUID } from "node:crypto";
import type { GatewayWsClient } from "../gateway/server/ws-types.js";
import type { TentacleSession, TentacleInvokeResult } from "./types.js";

type PendingInvoke = {
  tentacleId: string;
  command: string;
  resolve: (value: TentacleInvokeResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class TentacleRegistry {
  private tentaclesById = new Map<string, TentacleSession>();
  private tentaclesByConn = new Map<string, string>();
  private pendingInvokes = new Map<string, PendingInvoke>();

  register(client: GatewayWsClient, opts: { remoteIp?: string | undefined }): TentacleSession {
    const connect = client.connect;
    const tentacleId = connect.client.id;
    const caps = Array.isArray(connect.caps) ? connect.caps : [];

    const session: TentacleSession = {
      tentacleId,
      connId: client.connId,
      client,
      displayName: connect.client.displayName ?? tentacleId,
      platform: connect.client.platform,
      version: connect.client.version,
      remoteIp: opts.remoteIp,
      caps,
      connectedAtMs: Date.now(),
    };

    this.tentaclesById.set(tentacleId, session);
    this.tentaclesByConn.set(client.connId, tentacleId);
    return session;
  }

  unregister(connId: string): string | null {
    const tentacleId = this.tentaclesByConn.get(connId);
    if (!tentacleId) {
      return null;
    }

    this.tentaclesByConn.delete(connId);
    this.tentaclesById.delete(tentacleId);

    // Reject all pending invokes for this tentacle
    for (const [id, pending] of this.pendingInvokes.entries()) {
      if (pending.tentacleId !== tentacleId) {
        continue;
      }
      clearTimeout(pending.timer);
      pending.reject(new Error(`tentacle disconnected (${pending.command})`));
      this.pendingInvokes.delete(id);
    }

    return tentacleId;
  }

  listConnected(): TentacleSession[] {
    return [...this.tentaclesById.values()];
  }

  get(tentacleId: string): TentacleSession | undefined {
    return this.tentaclesById.get(tentacleId);
  }

  async invoke(params: {
    tentacleId: string;
    command: string;
    params?: unknown;
    timeoutMs?: number;
  }): Promise<TentacleInvokeResult> {
    const tentacle = this.tentaclesById.get(params.tentacleId);
    if (!tentacle) {
      return {
        ok: false,
        error: { code: "NOT_CONNECTED", message: "tentacle not connected" },
      };
    }

    const requestId = randomUUID();
    const payload = {
      id: requestId,
      nodeId: params.tentacleId,
      command: params.command,
      paramsJSON:
        "params" in params && params.params !== undefined ? JSON.stringify(params.params) : null,
      timeoutMs: params.timeoutMs,
    };

    const ok = this.sendEventToSession(tentacle, "node.invoke.request", payload);
    if (!ok) {
      return {
        ok: false,
        error: { code: "UNAVAILABLE", message: "failed to send invoke to tentacle" },
      };
    }

    const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 30_000;
    return await new Promise<TentacleInvokeResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingInvokes.delete(requestId);
        resolve({
          ok: false,
          error: { code: "TIMEOUT", message: "tentacle invoke timed out" },
        });
      }, timeoutMs);

      this.pendingInvokes.set(requestId, {
        tentacleId: params.tentacleId,
        command: params.command,
        resolve,
        reject,
        timer,
      });
    });
  }

  handleInvokeResult(params: {
    id: string;
    nodeId: string;
    ok: boolean;
    payloadJSON?: string | null;
    error?: { code?: string; message?: string } | null;
  }): boolean {
    const pending = this.pendingInvokes.get(params.id);
    if (!pending) {
      return false;
    }

    if (pending.tentacleId !== params.nodeId) {
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingInvokes.delete(params.id);
    pending.resolve({
      ok: params.ok,
      payloadJSON: params.payloadJSON ?? null,
      error: params.error ?? null,
    });

    return true;
  }

  private sendEventToSession(
    tentacle: TentacleSession,
    event: string,
    payload: unknown,
  ): boolean {
    try {
      tentacle.client.socket.send(
        JSON.stringify({
          type: "event",
          event,
          payload,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
