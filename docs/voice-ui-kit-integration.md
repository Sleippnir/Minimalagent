# Pipecat Voice UI Kit – Integration Notes

## Why it’s useful for the interview experience
- **Ready-made Pipecat wiring**: `PipecatAppBase` bootstraps the client, transport, audio output, and conversation state so we can focus on UX instead of duplicating connection logic inside `InterviewSession.jsx`.
- **Production-quality UI atoms**: Buttons, panels, status cards, control bars, and device dropdowns are styled with Tailwind tokens and support light/dark themes out of the box. This lets us ship a polished experience faster than rebuilding video/audio widgets manually.
- **Conversation & transcript plumbing**: The included `ConversationProvider`, store, and panels translate RTVI events into structured messages we can surface for interviewers or later evaluations.
- **Media visualization**: Off-the-shelf components (`BotVideoPanel`, `VoiceVisualizer`, `TranscriptOverlay`, plasma background) give immediate feedback that the AI is responding, reducing “is it alive?” confusion for candidates.
- **Debug/testing surface**: The `ConsoleTemplate` mirrors the playground UI Pipecat uses internally. Keeping it around in dev helps QA the backend while we iterate on the actual interview layout.

## Key building blocks exposed by the kit
- **Core wrapper (`PipecatAppBase`)**: Handles client creation, optional `startBot()` + `connect()`, auto-disconnect on unmount, optional theme wrapping, and injects audio output. It accepts `connectParams` (for our Daily room URL/token) or `startBotParams` (to let the kit POST to our API and transform the response).
- **UI primitives**: Buttons, banners, tabs, resizable panels, loaders, etc. exposed from `@pipecat-ai/voice-ui-kit`. They follow the same classNames and variants across kit components, making custom layouts cohesive.
- **Interactive elements**:
  - `ConnectButton` automatically reflects transport state and toggles connect/disconnect.
  - `ClientStatus`, `SessionInfo`, `DeviceSelect`, `UserAudioControl`, `UserVideoControl`, `UserScreenControl` provide plug-and-play status and device management.
- **Panels**: `BotVideoPanel`, `BotAudioPanel`, `ConversationPanel`, `EventsPanel`, `InfoPanel` present high-level sections we can recompose for our interviewer dashboard.
- **Visualizers**: Canvas/WebGL implementations (`VoiceVisualizer`, `CircularWaveform`, `PlasmaVisualizer`) respond to live audio streams.
- **Conversation hooks**: `usePipecatConversation`, `ConversationProvider`, and the underlying zustand store track turns, partial LLM/TTS output, and user transcripts—valuable for showing live captions or storing for evaluation.
- **Templates**: `ConsoleTemplate` and `Widget` combine the above into full experiences. They are good references if we want to start from a prebuilt layout and remove panels we don’t need.

## Suggested approach for the Minimalagent interview page
1. **Wrap the page in the kit providers**
   ```tsx
   import "@pipecat-ai/voice-ui-kit/styles";
   import { PipecatAppBase, ThemeProvider } from "@pipecat-ai/voice-ui-kit";

   function InterviewExperience() {
     return (
       <ThemeProvider defaultTheme="dark">
         <PipecatAppBase
           transportType="daily"
           connectParams={dailyParams} // { room_url, token }
           noThemeProvider // optional: if we keep our global theme
           startBotParams={{ endpoint: "/api/interviews/..." }} // optional
           startBotResponseTransformer={(res) => ({
             room_url: res.room?.room_url,
             token: res.room?.room_token,
           })}
         >
           {(props) => <InterviewLayout {...props} />}
         </PipecatAppBase>
       </ThemeProvider>
     );
   }
   ```
   - If we keep launching bots through the FastAPI `interview_api.py` route (`/api/interviews/{token}?launch_bot=true`), feed the returned Daily room details into `connectParams` once the fetch resolves. For a fully declarative flow, let the kit call that same endpoint via `startBotParams.endpoint` and use `startBotResponseTransformer` to map the JSON to the `{ room_url, token }` shape `connect()` expects.

2. **Compose the live interview layout**
   - **Hero section**: reuse `BotVideoPanel` (remote) and a custom local video tile (from our existing `LocalVideo` hook) inside a responsive grid. The panel already handles “no video” states and aspect ratio.
   - **Control strip**: use `ControlBar` with `UserAudioControl`, `UserVideoControl`, `UserAudioOutputControl`, plus a `ConnectButton`. These components know how to talk to the Pipecat transport so toggling mic/camera stays in sync.
   - **Transcript / notes**: embed `ConversationPanel` or lighter-weight `TranscriptOverlay` to give interviewers real-time captions. Because the provider stores every turn, we can pass those messages to our evaluator pipeline after the session.
   - **Status & metrics**: optionally dock `ClientStatus`, `SessionInfo`, or `EventsPanel` behind a collapsible drawer for debug mode. They surface transport state, connection details, and raw events without extra coding.

3. **Device management & settings**
   - Drop in `DeviceSelect` or the per-device dropdowns provided by the kit so interviewers can change inputs mid-call. The components are already wired to `usePipecatClientMediaDevices`.
   - Use `AutoInitDevices` from the Console template if we want to prompt the browser for mic/camera access as soon as the page loads.

4. **Styling & theming**
   - Import `@pipecat-ai/voice-ui-kit/styles` once in our video client entry point. It registers CSS variables compatible with Tailwind 4. We can override tokens (e.g., `--background`, `--primary`) to match our cyan/glass aesthetic or wrap everything in our existing `main-background` container.
   - If we prefer to keep the current Minimalagent shell, set `noThemeProvider` on `PipecatAppBase` and rely on our global theme while still using the kit components.

5. **Data & state hand-off**
   - The conversation store exposes `messages` and `injectMessage`. We can listen to state changes (via `useConversationStore` or callback registration) to log transcripts to Supabase or trigger evaluation jobs automatically when a turn finishes.
   - For analytics (latency, model responses) we can consume the `EventsPanel` logic or wire our own listener to `useRTVIClientEvent` now that the provider is already registered.

6. **Development workflow**
   - Keep the `ConsoleTemplate` mounted behind a feature flag (e.g., `/video-console`) for QA. It includes panels for events, metrics, and device switching we can leverage when debugging backend regressions.
   - Reference the example apps (`examples/02-components`, `04-vite`) as blueprints for how to stitch components in a Vite/React environment—identical to our `frontend/video-client` setup.

## Implementation checklist
- [ ] Install `@pipecat-ai/voice-ui-kit` alongside our existing Pipecat packages (version-aligned with the kit repo). Import the provided CSS in the video client entry.
- [ ] Decide whether the interview experience will let the kit call `startBot()` (simpler) or if we continue managing `launch_bot` ourselves and just pass `connectParams`.
- [ ] Refactor `InterviewSession.jsx` (or build a new `InterviewExperience.jsx`) to wrap content in `PipecatAppBase` and replace hand-rolled buttons/video placeholders with kit components.
- [ ] Map our “launch interview” response to the kit’s expectations (`room_url` + optional `token`). If our API returns additional metadata (rubric IDs, candidate info), keep passing it down separately.
- [ ] Wire transcript storage by tapping the conversation store once a turn is marked final—useful for evaluating answers without scraping DOM nodes.
- [ ] Customize theme tokens or wrap panels in our glassmorphism container so the UI matches the rest of the Minimalagent dashboard.
- [ ] Expose a development-only route using `ConsoleTemplate` for debugging advanced Pipecat scenarios before rolling changes into production.

## Risks & considerations
- The kit expects the latest Pipecat SDK (client-js/client-react). We already use v1.0+ in the test client, but double-check versions to avoid mismatched types.
- Some components assume Tailwind CSS variables are present. If we do not import the stylesheet, spacing/typography may look off.
- `PipecatAppBase` manages audio output automatically; if we want to control when audio mounts, pass `noAudioOutput` and render `PipecatClientAudio` manually.
- Templates dynamically import Daily/SmallWebRTC transports. Ensure the chosen transport package is installed in our video-client workspace (already true for Daily).
- Conversation storage lives in a zustand store scoped to the provider. Mounting multiple instances on one page could require namespacing, but our interview page only needs a single session.

## Next steps
1. Prototype a new `InterviewExperience` component inside `frontend/video-client/src` that uses `PipecatAppBase` with our existing Daily connect data.
2. Replace the ad-hoc controls and remote video panel with `ControlBar`, `ConnectButton`, `BotVideoPanel`, and `VoiceVisualizer`; keep our local preview using the same styling for continuity.
3. Evaluate whether we want to capture transcripts or rely solely on the bot’s evaluation pipeline. If yes, render `ConversationPanel` in a slide-out drawer for interviewers and log the messages for post-processing.
4. Once satisfied, migrate the updated experience back into the main admin/front-office UI (`InterviewSession.jsx`) so both codepaths share the same Pipecat wiring.
5. Maintain the current test client unchanged for regression testing; use the kit’s Console template for parallel experiments when investigating backend issues.

By leaning on the Voice UI Kit we can deliver a polished, fully interactive video interview interface with far less bespoke code, while still keeping the flexibility to brand and extend the experience for Minimalagent’s needs.
