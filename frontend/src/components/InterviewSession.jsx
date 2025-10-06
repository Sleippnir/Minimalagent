import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, RotateCcw, CheckCircle, Loader2 } from 'lucide-react';

// Transport state constants
const TS = {
  Disconnected: 'Disconnected',
  Initializing: 'Initializing',
  Initialized: 'Initialized',
  Authenticating: 'Authenticating',
  Authenticated: 'Authenticated',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Ready: 'Ready',
  Disconnecting: 'Disconnecting',
  Error: 'Error',
};

const InterviewSession = ({ interview, onBack }) => {
  const [currentScreen, setCurrentScreen] = useState('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [videoError, setVideoError] = useState(false); // <-- moved up (fix TDZ)

  const introVideoRef = useRef(null);
  const outroVideoRef = useRef(null);

  // Pipecat client temporarily disabled - will be replaced with separate video interview app
  const pcClient = null;

  // Pipecat event listeners temporarily disabled - video interview will be separate app
  useEffect(() => {
    // Video interview functionality moved to separate application
  }, []);

  // Video interview connection - will be implemented in separate app
  const connectToBot = useCallback(async () => {
    // Video interview functionality moved to separate application
    console.log('Video interview will be handled by separate application');
  }, []);

  // Screen transition handlers
  const handleStartInterview = async () => {
    setIsLoading(true);
    // Await the full connection process. The promise resolves when state is 'Ready'.
    await connectToBot(); 
    setIsLoading(false);

    // Now that we are connected and ready, play the intro video.
    if (introVideoRef.current) {
      try {
        await introVideoRef.current.play();
        setCurrentScreen('intro-playing');
      } catch (error) {
        console.error('Intro video autoplay failed:', error);
        // If autoplay fails, show manual play option
        setCurrentScreen('intro-playing');
        setVideoError(true);
      }
    }
  };

  const handleIntroVideoEnd = () => {
    setCurrentScreen('interview');
    // The bot has already started the conversation on the server.
  };

  // Handle video play error
  const handleVideoError = () => {
    setVideoError(true);
  };

  // Manual play function
  const playIntroVideo = async () => {
    if (introVideoRef.current) {
      try {
        await introVideoRef.current.play();
        setCurrentScreen('intro-playing');
        setVideoError(false);
      } catch (error) {
        console.error('Manual video play failed:', error);
        // If manual play fails, skip to interview
        setCurrentScreen('interview');
      }
    }
  };

  const cleanup = useCallback(() => {
    try { pcClient?.disconnect(); } catch {}
    try {
      if (introVideoRef.current) { introVideoRef.current.pause(); introVideoRef.current.currentTime = 0; }
      if (outroVideoRef.current) { outroVideoRef.current.pause(); outroVideoRef.current.currentTime = 0; }
    } catch {}
  }, [pcClient]);

  // Cleanup on unmount
  useEffect(() => () => { cleanup(); }, [cleanup]);

  const handleRestart = () => {
    cleanup();
    setVideoError(false);
    setIsLoading(false);
    setCurrentScreen('intro');
  };

  const getStatusInfo = () => {
    const currentState = pcClient?.state;
    switch (currentState) {
      case TS.Authenticating:
      case TS.Authenticated:
        return { text: 'Authorizing...', color: '#f39c12', icon: <Loader2 className="animate-spin" /> };
      case TS.Initializing:
      case TS.Connecting:
        return { text: 'Connecting...', color: '#f39c12', icon: <Loader2 className="animate-spin" /> };
      case TS.Connected:
      case TS.Ready:
        return { text: 'Connected', color: '#2ecc71', icon: <CheckCircle /> };
      case TS.Disconnected:
      case TS.Error:
        return { text: 'Disconnected', color: '#e74c3c', icon: <RotateCcw /> };
      default:
        return { text: 'Disconnected', color: '#95a5a6', icon: <Loader2 /> };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="interview-session min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">

        {/* Intro Screen */}
        {currentScreen === 'intro' && (
          <div className="text-center space-y-8">
            <div className="backdrop-blur-md bg-white/10 rounded-2xl p-8 border border-white/20">
              <h1 className="text-4xl font-bold text-white mb-4">Welcome to Your Interview</h1>
              <p className="text-xl text-gray-300 mb-8">Click the button below to begin your AI-powered interview session.</p>
              <button
                onClick={handleStartInterview}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-xl text-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
              >
                <Play size={24} />
                Start Interview
              </button>
            </div>
          </div>
        )}

        {/* Intro Video Playing */}
        {currentScreen === 'intro-playing' && (
          <div className="text-center">
            <video
              ref={introVideoRef}
              className="rounded-2xl shadow-2xl max-w-4xl mx-auto"
              onEnded={handleIntroVideoEnd}
              onError={handleVideoError}
              autoPlay
              muted
              playsInline
            >
              <source src="/video/intro.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            {videoError && (
              <div className="mt-4">
                <button
                  onClick={playIntroVideo}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Play Intro Video
                </button>
                <button
                  onClick={() => setCurrentScreen('interview')}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg ml-4"
                >
                  Skip to Interview
                </button>
              </div>
            )}
          </div>
        )}

        {/* Interview Screen */}
        {currentScreen === 'interview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Avatar Video */}
            <div className="lg:col-span-2">
              <div className="backdrop-blur-md bg-black/30 rounded-2xl p-4 border border-white/20">
                <h3 className="text-white text-lg font-semibold mb-4 text-center">AI Interviewer</h3>
                {/* Temporarily commented out Pipecat components due to packaging issues */}
                {/* <PipecatClientVideo
                  participant="bot"
                  className="w-full rounded-xl bg-black"
                />
                <PipecatClientAudio /> */}
                <div className="w-full h-64 rounded-xl bg-black flex items-center justify-center">
                  <p className="text-white text-center">Video feed temporarily disabled</p>
                </div>
              </div>
            </div>

            {/* User Video & Controls */}
            <div className="space-y-4">

              {/* User Camera */}
              <div className="backdrop-blur-md bg-black/30 rounded-2xl p-4 border border-white/20">
                <h3 className="text-white text-sm font-semibold mb-2">Your Camera</h3>
                {/* Temporarily commented out Pipecat components due to packaging issues */}
                {/* <PipecatClientVideo
                  participant="local"
                  className="w-full rounded-lg bg-black"
                  mirror
                /> */}
                <div className="w-full h-32 rounded-lg bg-black flex items-center justify-center">
                  <p className="text-white text-center text-sm">Camera feed temporarily disabled</p>
                </div>
              </div>

              {/* Status & Controls */}
              <div className="backdrop-blur-md bg-white/10 rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: statusInfo.color }}
                  >
                    {statusInfo.icon && React.cloneElement(statusInfo.icon, {
                      size: 12,
                      className: "text-white"
                    })}
                  </div>
                  <span className="text-white font-medium">{statusInfo.text}</span>
                </div>

                {isLoading && (
                  <div className="text-center py-4">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} color="#ffffff" />
                    <p className="text-gray-300 text-sm">Setting up your interview...</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Outro Screen */}
        {currentScreen === 'outro' && (
          <div className="text-center space-y-8">
            <div className="backdrop-blur-md bg-white/10 rounded-2xl p-8 border border-white/20">
              <h1 className="text-3xl font-bold text-white mb-4">Thank You</h1>
              <p className="text-xl text-gray-300 mb-8">Your interview session has now ended.</p>

              <video
                ref={outroVideoRef}
                className="rounded-2xl shadow-2xl max-w-2xl mx-auto mb-8"
                autoPlay
                playsInline
                muted
              >
                <source src="/video/outro.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              <button
                onClick={handleRestart}
                className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
              >
                <RotateCcw size={20} />
                Start New Session
              </button>

              <button
                onClick={onBack}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 mt-4 block mx-auto"
              >
                Back to Portal
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default InterviewSession;