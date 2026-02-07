# Clawctopus Tentacle

Remote execution daemon for OpenClaw Clawctopus.

## What is a Tentacle?

A tentacle is a lightweight daemon that connects to your OpenClaw Gateway and allows you to run commands on remote machines over the internet.

## Features

- **Shell Command Execution**: Run shell commands on remote machines
- **WebSocket Connection**: Persistent connection to Gateway with automatic reconnection
- **Minimal Footprint**: Just shell execution (Phase 1 MVP)
- **Secure**: Token-based authentication

## Installation

```bash
npm install -g @openclaw/tentacle
```

## Usage

### Start a Tentacle Daemon

```bash
clawctopus-tentacle run \
  --gateway ws://your-gateway:18789 \
  --key your-secret-registration-key \
  --name my-server
```

### Environment Variables

You can also use environment variables:

```bash
export CLAWCTOPUS_GATEWAY=ws://your-gateway:18789
export CLAWCTOPUS_KEY=your-secret-registration-key
export CLAWCTOPUS_NAME=my-server

clawctopus-tentacle run
```

Alternatively:
```bash
export TENTACLE_REGISTRATION_KEY=your-secret-registration-key
```

### Configuration

- `CLAWCTOPUS_GATEWAY` or `--gateway`: Gateway WebSocket URL (required)
- `CLAWCTOPUS_KEY` or `TENTACLE_REGISTRATION_KEY` or `--key`: Registration key (required)
- `CLAWCTOPUS_NAME` or `--name`: Tentacle name (defaults to hostname)
- `--caps`: Comma-separated capabilities (defaults to "shell")

## Using Tentacles from OpenClaw

Once a tentacle is connected, you can use it from the OpenClaw Pi agent:

### List Connected Tentacles

```
list tentacles
```

This calls the `tentacle` tool with action `list`.

### Run Shell Commands

```
run command "ls -la" on tentacle my-server
```

This calls the `tentacle` tool with action `shell`.

## Architecture

Tentacles connect to the Gateway as nodes with `role="node"` and `mode="tentacle"`.

They support the following commands:
- `shell`: Execute shell commands

## Protocol

Tentacles use the OpenClaw Gateway WebSocket protocol:

1. Connect to Gateway WebSocket endpoint
2. Receive `connect.challenge` event
3. Send `connect` request with token authentication
4. Receive `node.invoke.request` events for commands
5. Execute commands and send `node.invoke.result` responses

## Future Enhancements (Phase 2)

- File operations (read, write, list, delete)
- Browser control via Playwright
- More granular permissions
