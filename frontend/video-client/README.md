# Pipecat Video Chatbot Test

This is a segregated React application for testing Pipecat video chatbot integration before integrating it into the main frontend application.

## Overview

This test client implements the Pipecat SDK v1.0 with SmallWebRTCTransport for local testing of video chatbot connections. It follows the guidelines outlined in `react-integration.md` and includes both audio and video capabilities.

## Features

- **Pipecat Client Integration**: Uses the latest Pipecat SDK (v1.0) with `PipecatClient` instead of the deprecated `RTVIClient`
- **Video & Audio Support**: Full video chatbot with `PipecatClientVideo` and `PipecatClientAudio` components
- **SmallWebRTCTransport**: Lightweight WebRTC transport suitable for local testing
- **Media Controls**: Toggle microphone and camera on/off
- **Dual Video Feeds**: Display both local (user) and remote (bot) video streams
- **Configurable Endpoints**: Test different API endpoints and authentication tokens
- **Real-time Logging**: Monitor connection status and API responses
- **API Health Testing**: Test backend connectivity

## Setup

### Prerequisites

- Node.js 18+
- Backend API server running on port 8001 (for API proxy to work)

### Installation

```bash
cd frontend/video-client
npm install
```

### Development

```bash
npm run dev
```

The application will run on `http://localhost:5174` (or next available port) with API proxying to `http://localhost:8001`.

## Usage

### Basic Testing

1. **Start the backend**: Make sure your FastAPI server is running on port 8001
2. **Open the test client**: Navigate to the dev server URL
3. **Configure connection**:
   - **Endpoint**: `/api/offer` (or your backend endpoint)
   - **Token**: Use a valid JWT token or `test_token` for testing
4. **Test API Health**: Click "Test API Health" to verify backend connectivity
5. **Connect to Bot**: Click "Connect to Bot" to establish WebRTC connection

### Testing Different Scenarios

- **Valid Token**: Use a real JWT token from your backend
- **Invalid Token**: Test error handling with invalid tokens
- **Wrong Endpoint**: Test with non-existent endpoints
- **Backend Offline**: Test behavior when backend is not running

## Architecture

### Components

- **PipecatClientProvider**: Wraps the app and provides Pipecat client context
- **PipecatClient**: Core client instance with SmallWebRTCTransport
- **PipecatClientAudio**: Audio output component for bot responses
- **PipecatClientVideo**: Video components for local and remote video feeds
- **VoiceBot**: Main component handling connection logic and UI

### Transport Configuration

```javascript
const pcClient = new PipecatClient({
  transport: new SmallWebRTCTransport({
    enableMic: true,
    enableCam: true, // Enable camera for video
  }),
  callbacks: {
    onBotConnected: () => console.log("Bot connected"),
    onBotReady: () => console.log("Bot ready to chat"),
    onBotDisconnected: () => console.log("Bot disconnected"),
    onError: (error) => console.error("Pipecat error:", error),
  },
})
```

## Production Migration

When ready to integrate into the main frontend:

1. **Switch Transport**: Replace `SmallWebRTCTransport` with `DailyTransport`
2. **Update Imports**: Ensure all Pipecat imports are correct
3. **Add Dependencies**: Install `@pipecat-ai/daily-transport` in main frontend
4. **Move Components**: Integrate VoiceBot component into candidate portal
5. **Update Configuration**: Use production endpoints and authentication

## Troubleshooting

### Common Issues

- **Port Conflicts**: If port 5173 is in use, Vite will use the next available port
- **Backend Connection**: Ensure backend is running on port 8001
- **CORS Issues**: Check backend CORS configuration
- **WebRTC Errors**: SmallWebRTCTransport only works locally; use DailyTransport for remote connections

### Logs and Debugging

- Check browser console for detailed Pipecat logs
- Use the in-app logs section to monitor connection attempts
- Test API health to verify backend connectivity

## Dependencies

- `@pipecat-ai/client-js`: Core Pipecat JavaScript SDK
- `@pipecat-ai/client-react`: React components and hooks
- `@pipecat-ai/small-webrtc-transport`: WebRTC transport for local testing
- `react`: UI framework
- `react-dom`: React DOM rendering

## Guidelines Reference

This implementation follows the guidelines in `react-integration.md`:

- Uses Pipecat SDK v1.0
- Implements SmallWebRTCTransport for local testing
- Follows the recommended React patterns
- Includes proper error handling and logging
