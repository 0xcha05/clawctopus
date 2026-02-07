import type { GatewayWsClient } from "../gateway/server/ws-types.js";

export type TentacleSession = {
  tentacleId: string;
  connId: string;
  client: GatewayWsClient;
  displayName: string;
  platform?: string;
  version?: string;
  remoteIp?: string;
  caps: string[];
  connectedAtMs: number;
};

export type TentacleInvokeResult = {
  ok: boolean;
  payloadJSON?: string | null;
  error?: { code?: string; message?: string } | null;
};
