import { useEffect, useMemo, useRef, useState } from "react";
import { usePipecatClientMediaTrack } from "@pipecat-ai/client-react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function useParticipantAudioLevel(participantType) {
  const track = usePipecatClientMediaTrack("audio", participantType);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const frameRef = useRef(null);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const stop = () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* noop */
      }
      analyserRef.current = null;
      sourceRef.current = null;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context) {
        context.close().catch(() => undefined);
      }
    };

    stop();

    if (!track) {
      setLevel(0);
      return;
    }

    let audioContext;
    try {
      audioContext = new AudioContext();
    } catch (error) {
      console.warn("[AudioReactiveHalo] Failed to create AudioContext", error);
      return;
    }

    audioContextRef.current = audioContext;

    const stream = new MediaStream([track]);
    let source;
    try {
      source = audioContext.createMediaStreamSource(stream);
    } catch (error) {
      console.warn("[AudioReactiveHalo] Failed to connect audio track", error);
      audioContext.close().catch(() => undefined);
      audioContextRef.current = null;
      return;
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    analyserRef.current = analyser;
    sourceRef.current = source;

    const buffer = new Float32Array(analyser.fftSize);

    const update = () => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const sample = buffer[i];
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / buffer.length);
      const normalized = clamp((rms - 0.02) * 6, 0, 1);
      setLevel((prev) => clamp(prev * 0.75 + normalized * 0.25, 0, 1));

      frameRef.current = requestAnimationFrame(update);
    };

    audioContext.resume().catch(() => undefined);
    update();

    return stop;
  }, [track]);

  return useMemo(() => level, [level]);
}

export function AudioReactiveHalo({ participantType, className = "", children }) {
  const level = useParticipantAudioLevel(participantType);
  const haloScale = 1 + level * 0.18;
  const haloOpacity = level > 0.05 ? 0.18 + level * 0.28 : 0.08;

  const classes = ["audio-reactive-halo", className].filter(Boolean).join(" ");
  const style = {
    "--halo-scale": haloScale.toFixed(3),
    "--halo-opacity": haloOpacity.toFixed(3),
  };

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

export default AudioReactiveHalo;
