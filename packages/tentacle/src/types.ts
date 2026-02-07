export type TentacleConfig = {
  gatewayUrl: string;
  registrationKey: string;
  tentacleName: string;
  caps?: string[];
};

export type InvokeRequest = {
  id: string;
  nodeId: string;
  command: string;
  paramsJSON: string | null;
  timeoutMs?: number;
};

export type InvokeResult = {
  id: string;
  nodeId: string;
  ok: boolean;
  payloadJSON?: string | null;
  error?: { code?: string; message?: string } | null;
};

export type ShellCommandParams = {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
};

export type ShellCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  timedOut?: boolean;
};
