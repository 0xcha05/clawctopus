import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { Logger } from "tslog";
import type { TentacleConfig, InvokeRequest, InvokeResult } from "./types.js";
import { executeShellCommand } from "./handlers/shell.js";

const PROTOCOL_VERSION = 4;
const HEARTBEAT_INTERVAL_MS = 30000;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

export class TentacleClient {
  private ws: WebSocket | null = null;
  private config: TentacleConfig;
  private log: Logger<unknown>;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private stopping = false;
  private nodeId: string;

  constructor(config: TentacleConfig) {
    this.config = config;
    this.log = new Logger({ name: "tentacle" });
    // Use tentacle name as nodeId (simplified for now)
    this.nodeId = config.tentacleName;
  }

  async start(): Promise<void> {
    this.stopping = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    if (this.stopping) {
      return;
    }

    this.log.info(`Connecting to gateway: ${this.config.gatewayUrl}`);

    const ws = new WebSocket(this.config.gatewayUrl);

    ws.on("open", () => {
      this.log.info("WebSocket connected, waiting for challenge");
    });

    ws.on("message", (data) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on("error", (error) => {
      this.log.error("WebSocket error:", error);
    });

    ws.on("close", () => {
      this.log.warn("WebSocket closed");
      this.connected = false;
      this.clearTimers();
      if (!this.stopping) {
        this.scheduleReconnect();
      }
    });

    this.ws = ws;
  }

  private handleMessage(ws: WebSocket, text: string): void {
    try {
      const msg = JSON.parse(text);

      if (msg.type === "event") {
        this.handleEvent(ws, msg.event, msg.payload);
      } else if (msg.type === "res") {
        this.handleResponse(msg);
      }
    } catch (error) {
      this.log.error("Failed to parse message:", error);
    }
  }

  private handleEvent(ws: WebSocket, event: string, payload: unknown): void {
    if (event === "connect.challenge") {
      this.handleConnectChallenge(ws);
    } else if (event === "node.invoke.request") {
      this.handleInvokeRequest(ws, payload as InvokeRequest);
    }
  }

  private handleConnectChallenge(ws: WebSocket): void {
    this.log.info("Received connect challenge, sending connect request");

    const connectRequest = {
      type: "req",
      id: randomUUID(),
      method: "connect",
      params: {
        protocol: PROTOCOL_VERSION,
        role: "node",
        client: {
          id: this.config.tentacleName,
          displayName: this.config.tentacleName,
          platform: process.platform,
          version: "0.1.0",
          mode: "tentacle",
        },
        caps: this.config.caps || ["shell"],
        commands: ["shell"],
        token: this.config.registrationKey,
      },
    };

    ws.send(JSON.stringify(connectRequest));
  }

  private handleResponse(msg: { id: string; ok: boolean; error?: unknown }): void {
    if (msg.ok) {
      if (!this.connected) {
        this.log.info("Successfully connected to gateway");
        this.connected = true;
        this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
        this.startHeartbeat();
      }
    } else {
      this.log.error("Request failed:", msg.error);
    }
  }

  private async handleInvokeRequest(ws: WebSocket, request: InvokeRequest): Promise<void> {
    this.log.info(`Received invoke request: ${request.command}`);

    let result: InvokeResult;

    try {
      if (request.command === "shell") {
        const params = request.paramsJSON ? JSON.parse(request.paramsJSON) : {};
        const shellResult = await executeShellCommand(params);
        result = {
          id: request.id,
          nodeId: this.nodeId,
          ok: true,
          payloadJSON: JSON.stringify(shellResult),
        };
      } else {
        result = {
          id: request.id,
          nodeId: this.nodeId,
          ok: false,
          error: {
            code: "UNKNOWN_COMMAND",
            message: `Unknown command: ${request.command}`,
          },
        };
      }
    } catch (error) {
      result = {
        id: request.id,
        nodeId: this.nodeId,
        ok: false,
        error: {
          code: "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    // Send result back
    const resultRequest = {
      type: "req",
      id: randomUUID(),
      method: "node.invoke.result",
      params: result,
    };

    ws.send(JSON.stringify(resultRequest));
  }

  private startHeartbeat(): void {
    this.clearTimers();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.connected) {
        // Send a ping frame
        this.ws.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.log.info(`Reconnecting in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
