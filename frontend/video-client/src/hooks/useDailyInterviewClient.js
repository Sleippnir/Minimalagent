import { useCallback, useMemo, useRef, useState } from 'react'
import { PipecatClient } from '@pipecat-ai/client-js'
import { DailyTransport } from '@pipecat-ai/daily-transport'

export function useDailyInterviewClient({ onStateChange, onError } = {}) {
  const clientRef = useRef(null)
  const [state, setState] = useState({
    transport: 'disconnected',
    error: null,
    connecting: false,
  })

  const ensureClient = useCallback(() => {
    if (clientRef.current) {
      return clientRef.current
    }

    const client = new PipecatClient({
      enableCam: true,
      enableMic: true,
      transport: new DailyTransport(),
      callbacks: {
        onBotConnected: () => console.log('[DailyClient] Bot connected'),
        onBotReady: () => console.log('[DailyClient] Bot ready'),
        onBotDisconnected: () => console.log('[DailyClient] Bot disconnected'),
        onTransportStateChanged: (transportState) => {
          setState((prev) => ({ ...prev, transport: transportState }))
          onStateChange?.(transportState)
        },
        onError: (error) => {
          console.error('[DailyClient] Error', error)
          setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
          onError?.(error)
        },
      },
    })

    clientRef.current = client
    return client
  }, [onError, onStateChange])

  const connect = useCallback(
    async ({ roomUrl, roomToken }) => {
      const client = ensureClient()
      setState((prev) => ({ ...prev, connecting: true, error: null }))

      try {
        await client.initDevices?.()
        const connectParams = {
          room_url: roomUrl,
          ...(roomToken ? { token: roomToken } : {}),
        }
        await client.connect(connectParams)
        client.transport?.enableMic?.(true)
        client.transport?.enableCam?.(true)
      } catch (error) {
        console.error('[DailyClient] connect failed', error)
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
        throw error
      } finally {
        setState((prev) => ({ ...prev, connecting: false }))
      }
    },
    [ensureClient],
  )

  const disconnect = useCallback(async () => {
    if (!clientRef.current) return
    try {
      await clientRef.current.disconnect()
    } finally {
      setState((prev) => ({ ...prev, transport: 'disconnected' }))
    }
  }, [])

  const client = useMemo(() => ensureClient(), [ensureClient])

  return {
    client,
    connect,
    disconnect,
    state,
  }
}

