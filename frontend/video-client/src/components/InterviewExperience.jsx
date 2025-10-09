import '../styles/interview-experience.css'

import { useMemo, useRef, useState } from 'react'
import {
  ThemeProvider,
  PipecatAppBase,
  ControlBar,
  ConnectButton,
  UserAudioControl,
  UserVideoControl,
  UserAudioOutputControl,
  BotVideoPanel,
  BotAudioPanel,
  ConversationPanel,
  ClientStatus,
  SessionInfo,
  InfoPanel,
  EventsPanel,
  VoiceVisualizer,
  TranscriptOverlay,
} from '@pipecat-ai/voice-ui-kit'

import { useTranscriptRecorder } from '../lib/transcriptRecorder.js'

const TranscriptCapture = ({ onUpdate, children }) => {
  useTranscriptRecorder({ enabled: true, onUpdate })
  return children
}

export default function InterviewExperience() {
  const [token, setToken] = useState('AnyoneAI')
  const [connectParams, setConnectParams] = useState(null)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState(null)
  const [capturedTranscript, setCapturedTranscript] = useState([])
  const abortRef = useRef(null)

  const dailyConnectParams = useMemo(() => {
    if (!connectParams) return null
    return {
      room_url: connectParams.roomUrl,
      ...(connectParams.roomToken ? { token: connectParams.roomToken } : {}),
    }
  }, [connectParams])

  const handleLaunch = async () => {
    if (!token) return
    setLaunching(true)
    setLaunchError(null)
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(`/api/interviews/${token}?launch_bot=true`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || response.statusText || 'Failed to launch interview bot')
      }

      const payload = await response.json()
      const roomUrl = payload?.room?.room_url

      if (!roomUrl) {
        throw new Error('Launch response did not include Daily room details')
      }

      setConnectParams({
        roomUrl,
        roomToken: payload.room.room_token ?? undefined,
      })
    } catch (error) {
      if (error.name === 'AbortError') return
      console.error('Failed to launch bot:', error)
      setLaunchError(error.message || 'Failed to launch bot')
      setConnectParams(null)
    } finally {
      setLaunching(false)
    }
  }

  const handleDownloadTranscript = () => {
    if (!capturedTranscript.length) return
    const blob = new Blob([JSON.stringify(capturedTranscript, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `interview-transcript-${token || 'session'}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="interview-shell main-background">
        <header className="interview-header glass-ui">
          <div className="header-left">
            <h1 className="title">AI Interview Experience</h1>
            <p className="subtitle">Schedule-ready interface powered by Pipecat Voice UI Kit</p>
          </div>

          <div className="header-right glass-ui inset">
            <label className="token-label">Login Token</label>
            <div className="token-input-row">
              <input
                className="token-input"
                type="text"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="AnyoneAI"
              />
              <button className="btn-primary" onClick={handleLaunch} disabled={launching}>
                {launching ? 'Launching...' : 'Launch Interview'}
              </button>
            </div>

            {launchError && <p className="token-error">{launchError}</p>}
            {connectParams && <p className="token-success">Daily room ready for {token}</p>}

            <div className="transcript-actions">
              <button
                className="btn-secondary"
                onClick={handleDownloadTranscript}
                disabled={!capturedTranscript.length}
              >
                Download Transcript JSON
              </button>
              <span className="transcript-count">
                {capturedTranscript.length} entries captured
              </span>
            </div>
          </div>
        </header>

        <main className="interview-main">
          {dailyConnectParams ? (
            <PipecatAppBase transportType="daily" connectParams={dailyConnectParams} noThemeProvider>
              {({ client, handleConnect, handleDisconnect, transformedStartBotResponse }) => (
                <TranscriptCapture onUpdate={setCapturedTranscript}>
                  {client ? (
                    <ExperienceLayout
                      handleConnect={handleConnect}
                      handleDisconnect={handleDisconnect}
                      transformedStartBotResponse={transformedStartBotResponse}
                    />
                  ) : (
                    <div className="loading-state glass-ui">
                      <p className="loading-headline">Initializing interview session...</p>
                      <p className="loading-text">Setting up voice connection</p>
                    </div>
                  )}
                </TranscriptCapture>
              )}
            </PipecatAppBase>
          ) : (
            <div className="empty-state glass-ui">
              <p className="empty-headline">Launch an interview to begin</p>
              <p className="empty-text">
                We will create a Daily room using the Pipecat backend and connect automatically once credentials are ready.
              </p>
            </div>
          )}
        </main>

        <footer className="interview-footer glass-ui inset">
          <span className="footer-brand">Minimalagent Interview Suite</span>
          <span className="footer-divider">•</span>
          <span className="footer-note">Powered by Pipecat Voice UI Kit</span>
        </footer>
      </div>
    </ThemeProvider>
  )
}

const ExperienceLayout = ({ handleConnect, handleDisconnect, transformedStartBotResponse }) => (
  <div className="experience-grid">
    <section className="media-stack glass-ui">
      <div className="remote-video">
        <BotVideoPanel collapsed />
      </div>

      <div className="audio-visualizer glass-ui inset">
        <VoiceVisualizer participantType="bot" variant="waveform" />
      </div>

      <div className="controls glass-ui inset">
        <ControlBar>
          <UserAudioControl />
          <UserVideoControl />
          <UserAudioOutputControl />
          <ConnectButton onConnect={handleConnect} onDisconnect={handleDisconnect} />
        </ControlBar>
      </div>
    </section>

    <section className="conversation-stack glass-ui">
      <div className="transcript-overlay">
        <TranscriptOverlay participant="remote" className="transcript-overlay-card" showParticipantName />
      </div>
      <div className="conversation-panel">
        <ConversationPanel title="Live Transcript" emptyState="Waiting for conversation..." />
      </div>
    </section>

    <aside className="insights-stack glass-ui">
      <div className="status-grid">
        <ClientStatus />
        <SessionInfo response={transformedStartBotResponse} />
      </div>
      <div className="bot-audio">
        <BotAudioPanel />
      </div>
      <div className="events-panel">
        <EventsPanel />
      </div>
      <div className="info-panel">
        <InfoPanel />
      </div>
    </aside>
  </div>
)

