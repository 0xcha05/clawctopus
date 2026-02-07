import { spawn } from "node:child_process";
import type { ShellCommandParams, ShellCommandResult } from "../types.js";

export async function executeShellCommand(
  params: ShellCommandParams,
): Promise<ShellCommandResult> {
  const { command, cwd, env, timeoutMs = 30000 } = params;

  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd: cwd || process.cwd(),
      env: env ? { ...process.env, ...env } : process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Force kill after 5s if still running
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, timeoutMs);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: stderr + `\nError: ${error.message}`,
        exitCode: -1,
      });
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
        signal: signal || undefined,
        timedOut,
      });
    });
  });
}
