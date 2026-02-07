import { config } from "dotenv";
import { Command } from "commander";
import { TentacleClient } from "./client.js";

config();

const program = new Command();

program
  .name("clawctopus-tentacle")
  .description("Remote execution daemon for OpenClaw Clawctopus")
  .version("0.1.0");

program
  .command("run")
  .description("Start the tentacle daemon")
  .option("-g, --gateway <url>", "Gateway WebSocket URL", process.env.CLAWCTOPUS_GATEWAY)
  .option(
    "-k, --key <key>",
    "Registration key",
    process.env.CLAWCTOPUS_KEY || process.env.TENTACLE_REGISTRATION_KEY,
  )
  .option(
    "-n, --name <name>",
    "Tentacle name",
    process.env.CLAWCTOPUS_NAME || process.env.HOSTNAME || "tentacle",
  )
  .option("--caps <caps>", "Comma-separated capabilities", "shell")
  .action((options) => {
    const { gateway, key, name, caps } = options;

    if (!gateway) {
      console.error("Error: Gateway URL is required (--gateway or CLAWCTOPUS_GATEWAY)");
      process.exit(1);
    }

    if (!key) {
      console.error(
        "Error: Registration key is required (--key or CLAWCTOPUS_KEY/TENTACLE_REGISTRATION_KEY)",
      );
      process.exit(1);
    }

    const client = new TentacleClient({
      gatewayUrl: gateway,
      registrationKey: key,
      tentacleName: name,
      caps: caps.split(",").map((c: string) => c.trim()),
    });

    console.log(`Starting tentacle: ${name}`);
    console.log(`Gateway: ${gateway}`);
    console.log(`Capabilities: ${caps}`);

    client.start();

    // Handle graceful shutdown
    const shutdown = () => {
      console.log("\nShutting down...");
      client.stop().then(() => {
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program.parse();
