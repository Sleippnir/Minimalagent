import { useState, useEffect, useRef } from 'react'
import { PipecatClient } from '@pipecat-ai/client-js'
import { PipecatClientAudio, PipecatClientVideo, PipecatClientProvider, usePipecatClient } from '@pipecat-ai/client-react'
import { DailyTransport } from '@pipecat-ai/daily-transport'
import './App.css'

// Create Pipecat client with Daily transport
const pcClient = new PipecatClient({
  transport: new DailyTransport(),
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
  const [token, setToken] = useState('AnyoneAI')
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [isLaunching, setIsLaunching] = useState(false)
  const [roomDetails, setRoomDetails] = useState(null)

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
      let room = roomDetails
      if (!room) {
        addLog("No room details found, launching bot first...")
        room = await launchBotViaApi(true)
        if (!room) {
          throw new Error("Unable to launch bot for Daily room")
        }
        // ensure state in sync
        setRoomDetails(room)
      }

      if (!room.roomUrl) {
        throw new Error("Missing Daily room URL from launch response")
      }

      const connectParams = {
        room_url: room.roomUrl,
        ...(room.roomToken ? { token: room.roomToken } : {}),
      }

      addLog(`Connecting to Daily room ${room.roomUrl}`)
      await client.connect(connectParams)

      if (client?.transport?.enableMic) {
        client.transport.enableMic(micEnabled)
      }
      if (client?.transport?.enableCam) {
        client.transport.enableCam(camEnabled)
      }

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

  const launchBotViaApi = async (silent = false) => {
    if (!token) {
      addLog("Cannot launch bot: token is required")
      return null
    }

    setError(null)
    if (!silent) {
      setIsLaunching(true)
      addLog("Launching bot via API...")
    }

    try {
      const response = await fetch(`/api/interviews/${token}?launch_bot=true`)
      const data = await response.json()

      if (!response.ok) {
        const message = data?.detail || data?.error || response.statusText
        throw new Error(message || "Launch request failed")
      }

      addLog(`Launch response: ${JSON.stringify(data)}`)
      if (data?.room) {
        const room = {
          roomUrl: data.room.room_url,
          roomToken: data.room.room_token,
        }
        setRoomDetails(room)
        addLog(`Daily room ready: ${room.roomUrl}`)
        return room
      }
      return null

    } catch (err) {
      console.error("Failed to launch bot:", err)
      const message = err.message || "Failed to launch bot"
      addLog(`Launch failed: ${message}`)
      setError(message)
      return null
    } finally {
      if (!silent) {
        setIsLaunching(false)
      }
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
    const next = !micEnabled
    setMicEnabled(next)
    try {
      if (client?.transport?.enableMic) {
        client.transport.enableMic(next)
      }
    } catch (err) {
      console.error("Failed toggling mic:", err)
    }
    addLog(`Microphone ${next ? 'enabled' : 'disabled'}`)
  }

  const toggleCam = () => {
    const next = !camEnabled
    setCamEnabled(next)
    try {
      if (client?.transport?.enableCam) {
        client.transport.enableCam(next)
      }
    } catch (err) {
      console.error("Failed toggling camera:", err)
    }
    addLog(`Camera ${next ? 'enabled' : 'disabled'}`)
  }

  return (
    <div className="voice-bot-container">
      <h2>Pipecat Video Chatbot Test</h2>

      <div className="config-section">
        <h3>Configuration</h3>
        <div className="config-inputs">
          <label>
            Token:
            <input
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setRoomDetails(null)
              }}
              placeholder="AnyoneAI"
            />
          </label>
        </div>
        {roomDetails && (
          <div className="room-details">
            <p><strong>Room URL:</strong> {roomDetails.roomUrl}</p>
          </div>
        )}
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
        <button
          onClick={launchBotViaApi}
          disabled={isLaunching}
          className="launch-btn"
        >
          {isLaunching ? "Launching..." : "Launch Bot via API"}
        </button>
      </div>

      {/* Video section with both local and remote video */}
      <div className="video-section">
        <h3>Video Feed</h3>
        <div className="video-container">
          <div className="video-wrapper">
            <h4>Remote Video (Bot)</h4>
            <PipecatClientVideo participant="bot" />
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
        <p><strong>Transport:</strong> DailyTransport</p>
        <p><strong>Media:</strong> Microphone {micEnabled ? 'enabled' : 'disabled'}, Camera {camEnabled ? 'enabled' : 'disabled'}</p>
        <p><strong>Workflow:</strong> Launch bot to mint a Daily room, then connect.</p>
        <p><strong>Backend:</strong> Ensure the API server is running on port 8001</p>
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
          <p>Testing Pipecat integration with DailyTransport</p>
        </header>
        <main>
          <VoiceBot />
        </main>
      </div>
    </PipecatClientProvider>
  )
}

export default App
