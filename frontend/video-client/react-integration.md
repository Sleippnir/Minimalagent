# React Integration for Pipecat Voice Bots (2025)

## Overview of Pipecat's React SDK and Connection Flow

Pipecat is a real-time voice and multimodal AI framework. A typical workflow involves a candidate logging in and the backend using the login token to start a Pipecat voice bot. The bot runs at an endpoint such as `/api/offer` (for SmallWebRTCTransport) or a `/connect` REST endpoint that returns connection credentials. The React client connects to this endpoint to start streaming audio to/from the bot.

Pipecat's client SDKs transitioned to v1.0 in mid-2025. The migration guide emphasizes that the previous `RTVIClient` classes have been replaced with `PipecatClient` and that all SDKs now use a simpler API design. For React projects, the import names changed:

**Old:** `RTVIClient` and `RTVIClientProvider` from `@pipecat-ai/client-js/@pipecat-ai/client-react`

**New:** `PipecatClient`, `PipecatClientProvider` and hooks such as `usePipecatClient` from the same packages ([docs.pipecat.ai](https://docs.pipecat.ai)). Connection parameters are now passed directly to `connect()` or to `startBot()`/`startBotAndConnect()` ([docs.pipecat.ai](https://docs.pipecat.ai)).

Pipecat React SDK is built on top of the core JavaScript library (`@pipecat-ai/client-js`) and provides ready-made components and hooks. The official docs recommend installing both packages and a transport package (e.g., `@pipecat-ai/daily-transport` or `@pipecat-ai/small-webrtc-transport`). The quick-start example demonstrates creating a `PipecatClient`, wrapping the app in `PipecatClientProvider`, rendering a `PipecatClientAudio` component to receive audio and providing a button to call `client.start()` ([registry.npmjs.org](https://registry.npmjs.org)). In this new API you generally call `client.startBotAndConnect()` or `client.connect()` when the user clicks a button to avoid auto-playing audio.

## React Implementation Using Small WebRTC Transport

### When to use SmallWebRTCTransport

SmallWebRTCTransport is a lightweight, peer-to-peer WebRTC transport included in the Pipecat SDK. The documentation explains that it is intended for local development and testing. A `PipecatClient` can be created with this transport and then connected by supplying a `webrtcUrl` (the `/api/offer` endpoint). The docs show how to call `startBotAndConnect` to fetch the connection parameters and automatically connect ([docs.pipecat.ai](https://docs.pipecat.ai)).

To use it in React:

```javascript
import { PipecatClient } from '@pipecat-ai/client-js';
import { PipecatClientAudio, PipecatClientProvider, usePipecatClient } from '@pipecat-ai/client-react';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';

const pcClient = new PipecatClient({
  transport: new SmallWebRTCTransport({ enableMic: true }),
});

function VoiceBot() {
  const client = usePipecatClient();
  const connectToBot = async () => {
    try {
      await client.startBotAndConnect({
        endpoint: '/api/offer', // backend returns { webrtcUrl }
        requestData: { loginToken: candidateToken, context: botContext },
      });
    } catch (err) { console.error(err); }
  };
  return <button onClick={connectToBot}>Connect</button>;
}

// App component
function App() {
  return (
    <PipecatClientProvider client={pcClient}>
      <VoiceBot />
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}
```

When `client.startBotAndConnect()` is called, the backend endpoint returns a `webrtcUrl`. The client then performs the WebRTC handshake. The Pipecat docs emphasize that SmallWebRTCTransport is appropriate for local testing; if used across networks, connections may get stuck in the ICE "checking" state because it does not use a TURN server. A GitHub issue notes that remote clients connecting to a SmallWebRTC server often hang and that the transport is intended for local development; for production, a full WebRTC solution such as Daily is recommended ([github.com](https://github.com)).

### Transport Limitations and Options

#### Local-only

SmallWebRTCTransport works reliably on a local machine. For remote clients (even on the same network), connections can hang in ICE "checking" due to NAT traversal issues; the maintainers confirm this and suggest using a TURN server or switching to Daily transport ([github.com](https://github.com)).

#### Device Management via Daily's SDK

The small-webrtc-transport package bundles Daily's daily-js library for device selection and error handling. Some users raised concerns that the included `call-machine-object-bundle.js` file looks like obfuscated code. The Pipecat team clarified that this file is Daily's client bundle used only for media management; it does not send data to Daily. Users who do not want to depend on Daily can pass a `WavMediaManager` when constructing SmallWebRTCTransport ([github.com](https://github.com)). This alternative manager is open-source but offers limited cross-browser support ([github.com](https://github.com)).

#### SSR / CommonJS Build Issues

Early versions of `@pipecat-ai/client-js` were published as CommonJS modules. Developers using server-side rendering with Vite encountered `ERR_REQUIRE_ESM` errors. A documented workaround is to import the package using a default import and destructure named exports, or to configure Vite to treat it as a CommonJS dependency ([github.com](https://github.com)).

## React Implementation Using Daily Transport for Production

For production environments or connections across networks, the Daily WebRTC transport (package `@pipecat-ai/daily-transport`) or WebSocketTransport may be better choices.

### DailyTransport

DailyTransport uses Daily.co's infrastructure for WebRTC and automatically handles TURN/STUN servers, making it suitable for remote connections. The SDK usage is similar: instantiate `PipecatClient` with a `DailyTransport`, then call `startBotAndConnect` with a backend endpoint that returns a room URL and token. The core SDK docs provide an example:

```javascript
const pcClient = new PipecatClient({
  transport: new DailyTransport(),
  enableMic: true,
  enableCam: false,
  enableScreenShare: false,
  callbacks: {
    onBotConnected: () => console.log("Bot connected"),
    onBotReady: () => console.log("Bot ready to chat"),
  },
});

await pcClient.startBotAndConnect({
  endpoint: "https://your-connect-end-point-here/connect",
});
```

The docs note that `startBotAndConnect` fetches connection credentials (room URL and token) before connecting ([docs.pipecat.ai](https://docs.pipecat.ai)). When using React, you wrap the client with `PipecatClientProvider` and render `PipecatClientAudio` or `PipecatClientVideo` as needed. Device selection (camera/microphone) is handled automatically.

### WebSocketTransport

WebSocketTransport is available for situations where WebRTC is unavailable. You create a `PipecatClient` with a `WebSocketTransport` instance and call `connect({ wsUrl: 'ws://localhost:7860/ws' })` or use `startBotAndConnect()` with an endpoint that returns a `wsUrl`. The docs caution that this is mainly for local development and is less robust than WebRTC ([docs.pipecat.ai](https://docs.pipecat.ai)).

## Current State of Pipecat NPM Packages (2025)

Available packages: The Pipecat JavaScript ecosystem includes `@pipecat-ai/client-js`, `@pipecat-ai/client-react`, `@pipecat-ai/daily-transport`, `@pipecat-ai/small-webrtc-transport`, `@pipecat-ai/websocket-transport` and others. The NPM registry shows that these packages continue to be published regularly; for example, `@pipecat-ai/client-react` version 1.0.1 was released in July 2025 and depends on React ≥18 and `@pipecat-ai/client-js` ([registry.npmjs.org](https://registry.npmjs.org)). The readme instructs developers to install both `@pipecat-ai/client-js` and `@pipecat-ai/client-react` and provides a quick-start example using `PipecatClientProvider`, `PipecatClientAudio` and `usePipecatClient` ([registry.npmjs.org](https://registry.npmjs.org)).

### Migration to PipecatClient

Version 1.0 introduced breaking changes where `PipecatClient` replaced `RTVIClient`, and connection parameters moved to the `connect`/`startBot` calls ([docs.pipecat.ai](https://docs.pipecat.ai)). Developers migrating should update imports and connection calls accordingly.

### Open Issues

Current GitHub issues highlight a few rough edges:

- **Remote connections using SmallWebRTCTransport**: Users report that remote clients get stuck in the ICE "checking" state when using SmallWebRTCTransport. Maintainers clarify that this transport is designed for local testing and recommend using a TURN server or DailyTransport for remote use ([github.com](https://github.com)).

- **Security concerns with Daily's call-machine bundle**: One user suspected the presence of an obfuscated script in the small-webrtc-transport package. The team explained that the large `call-machine-object-bundle.js` file is part of Daily's daily-js and is used solely for device management; they offered a `WavMediaManager` alternative for those who prefer not to rely on Daily ([github.com](https://github.com)).

- **SSR build errors**: The CommonJS build of `@pipecat-ai/client-js` can cause failures when used with Vite SSR. A known fix is to adjust imports (e.g., `import clientJs from '@pipecat-ai/client-js'; const { PipecatClient } = clientJs`) or add an export map, as discussed in issue #114 ([github.com](https://github.com)).

## Recommendations for the User's Workflow

### General Guidelines

Use the new Pipecat SDK (v1.0) in React: Replace `RTVIClient` with `PipecatClient` and update imports accordingly ([docs.pipecat.ai](https://docs.pipecat.ai)). Wrap your app in `PipecatClientProvider`, render `PipecatClientAudio` and start the connection via a button to comply with browser autoplay policies ([registry.npmjs.org](https://registry.npmjs.org)). Use `startBotAndConnect()` to call your backend endpoint (e.g., `/api/offer` or `/connect`) that starts the bot with the candidate's token and returns connection details.

### For Local Testing

SmallWebRTCTransport is adequate. However, be aware of the local-only limitation and NAT issues; remote clients may not connect without a TURN server ([github.com](https://github.com)). Consider passing `mediaManager: new WavMediaManager()` to avoid loading Daily's device manager if supply-chain concerns arise ([github.com](https://github.com)).

### For Production

Use DailyTransport or another fully featured WebRTC transport. These transports provide TURN/STUN infrastructure and stable cross-network connections. The same React pattern applies: instantiate `PipecatClient` with `DailyTransport`, wrap with `PipecatClientProvider` and call `startBotAndConnect()` to fetch connection credentials ([docs.pipecat.ai](https://docs.pipecat.ai)).

### Package Management

Monitor package updates: Pipecat is actively developed and version numbers change rapidly. The release timeline indicates frequent updates (multiple releases in mid-2025). Check the changelog and update your dependencies regularly to get bug fixes and new features. Follow the migration guide when upgrading major versions.

### Handling SSR and Bundlers

If you use server-side rendering, be prepared to adjust imports or bundler config for CommonJS modules until the project fully adopts ES modules ([github.com](https://github.com)).

By following these practices, you can implement a robust React front-end that connects to a Pipecat voice bot and adapts to the evolving Pipecat ecosystem.
