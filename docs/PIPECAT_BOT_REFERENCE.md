# Pipecat Bot Development Quick Reference

## Critical StartFrame Issue & Fix

**Problem**: Audio frames processed before pipeline initialization causes "StartFrame not received yet" errors.

**Root Cause**: Pipeline starts immediately on bot launch, but StartFrame only sent on client connection.

**Solution**: Send StartFrame before LLMRunFrame in `on_client_connected` handler.

```python
# In simlibot.py on_client_connected method:
await task.queue_frames([StartFrame(), LLMRunFrame()])
```

## Key Pipecat Frame Types

- **StartFrame**: Initializes pipeline processors (SystemFrame)
- **LLMRunFrame**: Triggers LLM processing with current context
- **InputAudioRawFrame**: Audio input from transport (SystemFrame)
- **TextFrame**: Text data through pipeline
- **EndFrame**: Graceful pipeline shutdown
- **CancelFrame**: Immediate pipeline stop

## Pipeline Initialization Sequence

1. Bot launches → Pipeline created and started
2. Client connects → StartFrame sent → Pipeline initialized
3. LLMRunFrame sent → Conversation begins
4. Audio/video frames flow through initialized pipeline

## WebRTC Transport Timing

- Transport starts on port 7860
- Audio processing begins immediately on bot launch
- StartFrame must be sent before audio frames arrive
- Client connection triggers proper initialization sequence

## Bot Launch Process

```python
# interview_api.py launch_interview_bot()
env["AUTH_TOKEN"] = auth_token
env["TRANSPORT"] = "webrtc"
subprocess.Popen([sys.executable, "interview/bots/simlibot.py"], env=env)
```

## Key Files

- `interview/bots/simlibot.py`: Main bot with WebRTC transport
- `interview_api.py`: FastAPI server for interview management
- `frontend/src/components/CandidatePortal.jsx`: React frontend
- Pipeline: STT → LLM → TTS → Video → Transport

## Environment Variables

- `AUTH_TOKEN`: Interview identifier
- `TRANSPORT`: "webrtc" for WebRTC transport

## Common Issues

1. **StartFrame timing**: Always send StartFrame before LLMRunFrame
2. **Port conflicts**: WebRTC uses 7860, API uses 8000
3. **Process cleanup**: Background task monitors completed interviews
4. **Client connection**: Triggers proper pipeline initialization

## Testing Flow

1. Start backend: `python interview_api.py`
2. Launch interview: POST to `/interviews/{token}?launch_bot=true`
3. Connect client → StartFrame + LLMRunFrame sent
4. Audio/video streams through initialized pipeline
