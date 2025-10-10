import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
import Spinner from './Spinner.jsx'
import Toast from './Toast.jsx'
import InterviewSession from './InterviewSession.jsx'

const CandidatePortal = () => {
  const supabase = useSupabase()
  const [email, setEmail] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [currentInterview, setCurrentInterview] = useState(null)

  const handleLogout = () => {
    setCandidate(null)
    setInterviews([])
    setEmail('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setToast({ message: 'Please enter your email', type: 'error' })
      return
    }

    setLoading(true)
    try {
      if (!supabase) {
        // Mock data for development
        if (email === 'john@example.com') {
          setCandidate({ candidate_id: '1', first_name: 'John', last_name: 'Doe', email })
          setInterviews([
            {
              interview_id: '1',
              status: 'scheduled',
              auth_token: 'demo_token_123',
              applications: {
                jobs: { title: 'Software Engineer' }
              }
            },
            {
              interview_id: '2',
              status: 'completed',
              auth_token: null,
              applications: {
                jobs: { title: 'Product Manager' }
              }
            }
          ])
        } else {
          setToast({ message: 'Candidate not found', type: 'error' })
        }
      } else {
        // Find candidate by email
        const { data: candidateData, error: candidateError } = await supabase
          .from('candidates')
          .select('*')
          .eq('email', email.trim())
          .single()

        if (candidateError || !candidateData) {
          setToast({ message: 'Candidate not found', type: 'error' })
          return
        }

        setCandidate(candidateData)

        // Fetch interviews for this candidate
        const { data: interviewData, error: interviewError } = await supabase
          .from('interviews')
          .select(`
            interview_id,
            status,
            auth_token,
            applications!inner (
              jobs!inner (title)
            )
          `)
          .eq('applications.candidate_id', candidateData.candidate_id)
          .order('interview_id', { ascending: false })

        if (interviewError) {
          console.error('Error fetching interviews:', interviewError)
          setToast({ message: 'Error loading interviews', type: 'error' })
        } else {
          setInterviews(interviewData || [])
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setToast({ message: 'An error occurred', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleStartInterview = async (interview) => {
    if (!interview.auth_token) {
      setToast({ message: 'No auth token available for this interview', type: 'error' })
      return
    }

    try {
      // Make request to backend API
      const response = await fetch(`/api/interviews/${interview.auth_token}?launch_bot=true`)
      const data = await response.json()

      if (response.ok) {
        setToast({ 
          message: `Interview started successfully! ${data.bot_launched ? 'Bot launched.' : 'Bot not launched.'}`, 
          type: 'success' 
        })
        // Navigate to interview session
        setCurrentInterview(interview)
      } else {
        setToast({ message: `Failed to start interview: ${data.detail || 'Unknown error'}`, type: 'error' })
      }
    } catch (error) {
      console.error('Error starting interview:', error)
      setToast({ message: 'Network error while starting interview', type: 'error' })
    }
  }

  const handleBackToPortal = () => {
    setCurrentInterview(null)
  }

  const handleTranscriptUpdate = async (transcript) => {
    if (!currentInterview?.interview_id) return

    try {
      // Convert transcript to the expected format
      const transcriptTurns = transcript.map(entry => ({
        speaker: entry.role === 'user' ? 'candidate' : 'interviewer',
        text: entry.content,
        timestamp: entry.timestamp
      }))

      const response = await fetch(`/api/interviews/${currentInterview.interview_id}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ turns: transcriptTurns })
      })

      if (response.ok) {
        setToast({ message: 'Transcript submitted successfully', type: 'success' })
        // Refresh interviews to show updated status
        // This would need to be implemented based on your data fetching logic
      } else {
        const error = await response.json().catch(() => ({}))
        setToast({ message: `Failed to submit transcript: ${error.detail || 'Unknown error'}`, type: 'error' })
      }
    } catch (error) {
      console.error('Error submitting transcript:', error)
      setToast({ message: 'Network error while submitting transcript', type: 'error' })
    }
  }

  // Show interview session if one is active
  if (currentInterview) {
    return (
      <InterviewSession
        authToken={currentInterview.auth_token}
        onBack={handleBackToPortal}
        onTranscriptUpdate={handleTranscriptUpdate}
      />
    )
  }

  if (!candidate) {
    return (
      <div className="min-h-screen main-background flex items-center justify-center">
        <div className="glass-ui rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Candidate Portal</h1>
            <p className="text-gray-300">Enter your email to access your interviews</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="your.email@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
            >
              {loading ? 'Loading...' : 'Access Portal'}
            </button>
          </form>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen main-background">
      <nav className="glass-ui shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-cyan-400">Candidate Portal</h1>
            </div>
            <div className="flex items-center">
              <span className="text-gray-300 mr-4">Welcome, {candidate.first_name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Your Interviews</h2>
          <p className="text-gray-300">View your scheduled and completed interviews</p>
        </div>

        {loading ? (
          <Spinner />
        ) : interviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-300 text-lg">No interviews found</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {interviews.map((interview) => (
              <div key={interview.interview_id} className="glass-ui p-6 rounded-xl">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {interview.applications?.jobs?.title || 'Position'}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    interview.status === 'completed'
                      ? 'bg-green-600 text-white'
                      : interview.status === 'scheduled'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}>
                    {interview.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <span className="font-medium">Status:</span> {interview.status}
                  </p>
                  <p>
                    <span className="font-medium">Job:</span> {interview.applications?.jobs?.title || 'Position'}
                  </p>
                  <p>
                    <span className="font-medium">Interview ID:</span> {interview.interview_id}
                  </p>
                </div>

                {interview.status === 'scheduled' && interview.auth_token && (
                  <button 
                    onClick={() => handleStartInterview(interview)}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Start Interview
                  </button>
                )}

                {interview.status === 'completed' && (
                  <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
                    View Results
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

export default CandidatePortal