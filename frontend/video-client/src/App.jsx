import { useState, useEffect, useRef } from 'react'
import { PipecatClient } from '@pipecat-ai/client-js'
import { PipecatClientAudio, PipecatClientVideo, PipecatClientProvider, usePipecatClient } from '@pipecat-ai/client-react'
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport'
import './App.css'

// Create Pipecat client with SmallWebRTC transport for local testing
const pcClient = new PipecatClient({
  transport: new SmallWebRTCTransport({
    enableMic: true,
    enableCam: true, // Enable camera for video
    // Optional: use WavMediaManager instead of Daily's manager
    // mediaManager: new WavMediaManager()
  }),
  callbacks: {
    onBotConnected: () => console.log("Bot connected"),
    onBotReady: () => console.log("Bot ready to chat"),
    onBotDisconnected: () => console.log("Bot disconnected"),
    onError: (error) => console.error("Pipecat error:", error),
    onTransportStateChanged: (state) => console.log("Transport state:", state),
  },
})

function LocalVideo() {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)

  useEffect(() => {
    const startLocalVideo = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
      }
    }

    startLocalVideo()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: '4px', background: '#000' }}
    />
  )
}

function VoiceBot() {
  const client = usePipecatClient()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [endpoint, setEndpoint] = useState('/api/offer')
  const [token, setToken] = useState('test_token')
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)

  const addLog = (message) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    // Listen for client state changes
    const handleStateChange = (state) => {
      addLog(`Client state: ${state}`)
      setIsConnected(state === 'connected')
    }

    // This is a simplified way to listen to state changes
    // In a real implementation, you'd use the proper Pipecat hooks
    const interval = setInterval(() => {
      if (client && client.transport) {
        const state = client.transport.state
        if (state !== (isConnected ? 'connected' : 'disconnected')) {
          handleStateChange(state)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [client, isConnected])

  const connectToBot = async () => {
    setIsConnecting(true)
    setError(null)
    addLog("Attempting to connect...")

    try {
      await client.startBotAndConnect({
        endpoint: endpoint,
        requestData: {
          loginToken: token,
          context: {
            interview_id: 'test_interview',
            candidate_name: 'Test Candidate',
            test_mode: true,
            enableMic: micEnabled,
            enableCam: camEnabled
          }
        },
      })

      setIsConnected(true)
      addLog("Successfully connected to bot")
    } catch (err) {
      console.error("Failed to connect:", err)
      const errorMessage = err.message || "Failed to connect to bot"
      setError(errorMessage)
      addLog(`Connection failed: ${errorMessage}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectFromBot = async () => {
    try {
      addLog("Disconnecting...")
      await client.disconnect()
      setIsConnected(false)
      addLog("Disconnected from bot")
    } catch (err) {
      console.error("Failed to disconnect:", err)
      addLog(`Disconnect failed: ${err.message}`)
    }
  }

  const testHealthCheck = async () => {
    try {
      addLog("Testing health check...")
      const response = await fetch('/api/health')
      const data = await response.json()
      addLog(`Health check: ${JSON.stringify(data)}`)
    } catch (err) {
      addLog(`Health check failed: ${err.message}`)
    }
  }

  const toggleMic = () => {
    setMicEnabled(!micEnabled)
    addLog(`Microphone ${!micEnabled ? 'enabled' : 'disabled'}`)
  }

  const toggleCam = () => {
    setCamEnabled(!camEnabled)
    addLog(`Camera ${!camEnabled ? 'enabled' : 'disabled'}`)
  }

  return (
    <div className="voice-bot-container">
      <h2>Pipecat Video Chatbot Test</h2>

      <div className="config-section">
        <h3>Configuration</h3>
        <div className="config-inputs">
          <label>
            Endpoint:
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="/api/offer"
            />
          </label>
          <label>
            Token:
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="test_token"
            />
          </label>
        </div>
      </div>

      <div className="media-controls">
        <h3>Media Controls</h3>
        <div className="control-buttons">
          <button
            onClick={toggleMic}
            className={`media-btn ${micEnabled ? 'enabled' : 'disabled'}`}
          >
            🎤 {micEnabled ? 'Mic On' : 'Mic Off'}
          </button>
          <button
            onClick={toggleCam}
            className={`media-btn ${camEnabled ? 'enabled' : 'disabled'}`}
          >
            📹 {camEnabled ? 'Cam On' : 'Cam Off'}
          </button>
        </div>
      </div>

      <div className="connection-status">
        <p>Status: <span className={isConnected ? "connected" : "disconnected"}>
          {isConnected ? "Connected" : "Disconnected"}
        </span></p>
        {error && <p className="error">Error: {error}</p>}
      </div>

      <div className="controls">
        {!isConnected ? (
          <button
            onClick={connectToBot}
            disabled={isConnecting}
            className="connect-btn"
          >
            {isConnecting ? "Connecting..." : "Connect to Bot"}
          </button>
        ) : (
          <button
            onClick={disconnectFromBot}
            className="disconnect-btn"
          >
            Disconnect
          </button>
        )}

        <button
          onClick={testHealthCheck}
          className="test-btn"
        >
          Test API Health
        </button>
      </div>

      {/* Video section with both local and remote video */}
      <div className="video-section">
        <h3>Video Feed</h3>
        <div className="video-container">
          <div className="video-wrapper">
            <h4>Remote Video (Bot)</h4>
            <PipecatClientVideo />
          </div>
          <div className="video-wrapper">
            <h4>Local Video (You)</h4>
            <LocalVideo />
          </div>
        </div>
      </div>

      {/* Pipecat audio component for receiving bot audio */}
      <div className="audio-section">
        <h3>Audio Output</h3>
        <PipecatClientAudio />
      </div>

      <div className="logs-section">
        <h3>Logs</h3>
        <div className="logs">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">{log}</div>
          ))}
        </div>
      </div>

      <div className="info">
        <p><strong>Transport:</strong> SmallWebRTCTransport (local testing only)</p>
        <p><strong>Media:</strong> Microphone {micEnabled ? 'enabled' : 'disabled'}, Camera {camEnabled ? 'enabled' : 'disabled'}</p>
        <p><strong>Note:</strong> For production, switch to DailyTransport.</p>
        <p><strong>Backend:</strong> Make sure your API server is running on port 8001</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <PipecatClientProvider client={pcClient}>
      <div className="app">
        <header>
          <h1>Pipecat Video Client Test</h1>
          <p>Testing Pipecat integration with SmallWebRTCTransport</p>
        </header>
        <main>
          <VoiceBot />
        </main>
      </div>
    </PipecatClientProvider>
  )
}

export default App
