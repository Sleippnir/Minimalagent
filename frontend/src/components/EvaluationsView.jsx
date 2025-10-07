import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
import Spinner from './Spinner.jsx'
import SearchableDropdown from './SearchableDropdown.jsx'

const formatScore = (score) => {
  return score ? score.toFixed(1) : 'N/A'
}

const getScoreColor = (score) => {
  if (!score) return 'text-gray-400'
  if (score >= 8.5) return 'text-green-400'
  if (score >= 7.0) return 'text-yellow-400'
  return 'text-red-400'
}

const EvaluationDetailsRenderer = ({ data }) => {
  // Try to parse the data if it's a string
  let parsedData;
  try {
    parsedData = typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    // If parsing fails, show raw data
    return (
      <div className="bg-gray-900 p-4 rounded-lg">
        <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  // Check if this is the new structured format with evaluations object
  if (parsedData.evaluations && typeof parsedData.evaluations === 'object') {
    return (
      <div className="space-y-6">
        {/* Overall Summary */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-lg font-semibold text-cyan-400">Overall Assessment</h5>
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(parsedData.overall_score)}`}>
                  {parsedData.overall_score}/10
                </div>
                <div className="text-xs text-gray-400">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-400">
                  {parsedData.recommendation}
                </div>
                <div className="text-xs text-gray-400">Recommendation</div>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Evaluated on: {new Date(parsedData.evaluated_at).toLocaleString()}
          </div>
        </div>

        {/* Individual Evaluations */}
        {Object.entries(parsedData.evaluations).map(([key, evaluation]) => (
          <div key={key} className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-lg font-semibold text-white">
                {evaluation.model} ({evaluation.provider})
              </h5>
              <div className="flex items-center space-x-4">
                <div className={`text-xl font-bold ${getScoreColor(evaluation.score)}`}>
                  {evaluation.score}/10
                </div>
                <div className="text-sm text-green-400">
                  {evaluation.recommendation}
                </div>
              </div>
            </div>

            {evaluation.reasoning && (
              <div className="mb-4">
                <h6 className="text-sm font-medium text-cyan-400 mb-2">Reasoning</h6>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {evaluation.reasoning}
                </p>
              </div>
            )}

            {evaluation.strengths && Array.isArray(evaluation.strengths) && evaluation.strengths.length > 0 && (
              <div className="mb-4">
                <h6 className="text-sm font-medium text-green-400 mb-2">Strengths</h6>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                  {evaluation.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation.improvements && Array.isArray(evaluation.improvements) && evaluation.improvements.length > 0 && (
              <div className="mb-4">
                <h6 className="text-sm font-medium text-yellow-400 mb-2">Areas for Improvement</h6>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                  {evaluation.improvements.map((improvement, index) => (
                    <li key={index}>{improvement}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback for older format or single evaluation
  return (
    <div className="bg-gray-900 p-4 rounded-lg">
      <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(parsedData, null, 2)}
      </pre>
    </div>
  );
}

const EvaluationsView = () => {
  const supabase = useSupabase()
  const [evaluations, setEvaluations] = useState([])
  const [jobs, setJobs] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [filteredEvaluations, setFilteredEvaluations] = useState([])
  const [filteredCandidates, setFilteredCandidates] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    filterCandidates()
    setSelectedCandidate(null) // Clear candidate selection when job changes
  }, [selectedJob, evaluations])

  useEffect(() => {
    filterEvaluations()
  }, [evaluations, selectedJob, selectedCandidate])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchEvaluations(), fetchJobs(), fetchCandidates()])
      filterCandidates() // Initialize filtered candidates
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEvaluations = async () => {
    try {
      if (!supabase) {
        // Mock data for development
        setEvaluations([
          {
            evaluation_id: '1',
            interview_id: 'int-1',
            evaluator_llm_model: 'gpt-4-turbo',
            score: 8.5,
            reasoning: 'Strong technical skills demonstrated with clear communication. Shows good problem-solving approach.',
            raw_llm_response: { detailed_feedback: 'Mock detailed feedback for GPT-4' },
            created_at: '2024-01-15T10:30:00Z',
            interview: {
              applications: {
                candidates: { candidate_id: 'c1', first_name: 'John', last_name: 'Doe' },
                jobs: { job_id: 'j1', title: 'Software Engineer' }
              }
            }
          },
          {
            evaluation_id: '2',
            interview_id: 'int-1',
            evaluator_llm_model: 'claude-3',
            score: 7.8,
            reasoning: 'Good understanding of concepts but could improve on explaining complex topics clearly.',
            raw_llm_response: { detailed_feedback: 'Mock detailed feedback for Claude-3' },
            created_at: '2024-01-15T10:35:00Z',
            interview: {
              applications: {
                candidates: { candidate_id: 'c1', first_name: 'John', last_name: 'Doe' },
                jobs: { job_id: 'j1', title: 'Software Engineer' }
              }
            }
          },
          {
            evaluation_id: '3',
            interview_id: 'int-1',
            evaluator_llm_model: 'gemini-pro',
            score: 7.2,
            reasoning: 'Solid foundation but needs more experience with advanced concepts.',
            raw_llm_response: { detailed_feedback: 'Mock detailed feedback for Gemini' },
            created_at: '2024-01-15T10:40:00Z',
            interview: {
              applications: {
                candidates: { candidate_id: 'c1', first_name: 'John', last_name: 'Doe' },
                jobs: { job_id: 'j1', title: 'Software Engineer' }
              }
            }
          },
          {
            evaluation_id: '4',
            interview_id: 'int-2',
            evaluator_llm_model: 'gpt-4-turbo',
            score: 9.2,
            reasoning: 'Excellent leadership experience and strategic thinking. Very strong candidate.',
            raw_llm_response: { detailed_feedback: 'Mock detailed feedback for GPT-4 on PM role' },
            created_at: '2024-01-16T14:20:00Z',
            interview: {
              applications: {
                candidates: { candidate_id: 'c2', first_name: 'Jane', last_name: 'Smith' },
                jobs: { job_id: 'j2', title: 'Product Manager' }
              }
            }
          }
        ])
      } else {
        const { data, error } = await supabase
          .from('evaluations')
          .select(`
            evaluation_id,
            interview_id,
            evaluator_llm_model,
            score,
            reasoning,
            raw_llm_response,
            created_at,
            interview:interview_id (
              applications (
                candidates (
                  candidate_id,
                  first_name,
                  last_name
                ),
                jobs (
                  job_id,
                  title
                )
              )
            )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error
        setEvaluations(data)
      }
    } catch (error) {
      console.error('Error fetching evaluations:', error)
    }
  }

  const fetchJobs = async () => {
    try {
      if (!supabase) {
        setJobs([
          { job_id: 'j1', title: 'Software Engineer' },
          { job_id: 'j2', title: 'Product Manager' }
        ])
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .select('job_id, title')
          .order('title')

        if (error) throw error
        setJobs(data)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const fetchCandidates = async () => {
    try {
      if (!supabase) {
        setCandidates([
          { candidate_id: 'c1', first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          { candidate_id: 'c2', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }
        ])
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .select('candidate_id, first_name, last_name, email')
          .order('first_name')

        if (error) throw error
        setCandidates(data)
      }
    } catch (error) {
      console.error('Error fetching candidates:', error)
    }
  }

  const filterEvaluations = () => {
    let filtered = evaluations

    if (selectedJob) {
      filtered = filtered.filter(evaluation =>
        evaluation.interview?.applications?.jobs?.job_id === selectedJob.job_id
      )
    }

    if (selectedCandidate) {
      filtered = filtered.filter(evaluation =>
        evaluation.interview?.applications?.candidates?.candidate_id === selectedCandidate.candidate_id
      )
    }

    // Group by candidate for display
    const grouped = filtered.reduce((acc, evaluation) => {
      const candidateId = evaluation.interview?.applications?.candidates?.candidate_id
      if (!acc[candidateId]) {
        acc[candidateId] = {
          candidate: evaluation.interview?.applications?.candidates,
          evaluations: []
        }
      }
      acc[candidateId].evaluations.push(evaluation)
      return acc
    }, {})

    setFilteredEvaluations(Object.values(grouped))
  }

  const filterCandidates = () => {
    if (!selectedJob) {
      setFilteredCandidates(candidates)
      return
    }

    // Find candidates who have evaluations for the selected job
    const candidatesWithEvaluations = new Set()
    evaluations.forEach(evaluation => {
      if (evaluation.interview?.applications?.jobs?.job_id === selectedJob.job_id) {
        const candidateId = evaluation.interview?.applications?.candidates?.candidate_id
        if (candidateId) {
          candidatesWithEvaluations.add(candidateId)
        }
      }
    })

    const filtered = candidates.filter(candidate =>
      candidatesWithEvaluations.has(candidate.candidate_id)
    )

    setFilteredCandidates(filtered)
  }

  if (loading) {
    return <Spinner />
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-cyan-400">Evaluations</h2>
        <p className="mt-1 text-sm text-gray-300">AI-generated interview assessments</p>
      </div>

      {/* Filters */}
      <div className="glass-ui p-6 mb-6 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SearchableDropdown
            label="Filter by Job"
            options={jobs}
            value={selectedJob}
            onChange={setSelectedJob}
            displayKey="title"
            placeholder="Select a job position"
          />
          <SearchableDropdown
            label="Filter by Candidate"
            options={filteredCandidates}
            value={selectedCandidate}
            onChange={setSelectedCandidate}
            displayKey={(c) => `${c.first_name} ${c.last_name} (${c.email})`}
            placeholder="Select a candidate"
          />
        </div>
        {(selectedJob || selectedCandidate) && (
          <div className="mt-4 flex space-x-4">
            <button
              onClick={() => {
                setSelectedJob(null)
                setSelectedCandidate(null)
              }}
              className="text-cyan-400 hover:text-cyan-300 text-sm underline"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Evaluations List */}
      <div className="space-y-6">
        {selectedCandidate && (
          <EvaluationDetailView
            candidate={selectedCandidate}
            evaluations={filteredEvaluations.find(group =>
              group.candidate?.candidate_id === selectedCandidate.candidate_id
            )?.evaluations || []}
          />
        )}

        {!selectedCandidate && filteredEvaluations.length > 0 && (
          <div className="glass-ui p-8 text-center">
            <p className="text-gray-400">Select a candidate to view their evaluations</p>
          </div>
        )}

        {selectedCandidate && filteredEvaluations.length === 0 && (
          <div className="glass-ui p-8 text-center">
            <p className="text-gray-400">No evaluations found for the selected candidate.</p>
          </div>
        )}
      </div>
    </div>
  )
}

const EvaluationDetailView = ({ candidate, evaluations }) => {
  const [activeTab, setActiveTab] = useState(0)

  if (evaluations.length === 0) {
    return (
      <div className="glass-ui p-8 text-center">
        <p className="text-gray-400">No evaluations found for {candidate.first_name} {candidate.last_name}</p>
      </div>
    )
  }

  return (
    <div className="glass-ui p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white">
          {candidate.first_name} {candidate.last_name}
        </h3>
        <p className="text-sm text-gray-400">{candidate.email}</p>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex space-x-1">
          {evaluations.map((evaluation, index) => (
            <button
              key={evaluation.evaluation_id}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === index
                  ? 'bg-cyan-400 text-dark-blue'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {evaluation.evaluator_llm_model}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-b-lg p-6">
        {evaluations[activeTab] && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(evaluations[activeTab].score)}`}>
                  {formatScore(evaluations[activeTab].score)}
                </div>
                <div className="text-sm text-gray-400">Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {evaluations[activeTab].evaluator_llm_model}
                </div>
                <div className="text-sm text-gray-400">AI Model</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {new Date(evaluations[activeTab].created_at).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-400">Evaluation Date</div>
              </div>
            </div>

            {evaluations[activeTab].reasoning && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-cyan-400 mb-3">Assessment Summary</h4>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {evaluations[activeTab].reasoning}
                  </p>
                </div>
              </div>
            )}

            {evaluations[activeTab].raw_llm_response && (
              <div>
                <h4 className="text-lg font-medium text-cyan-400 mb-3">Full Evaluation Details</h4>
                <EvaluationDetailsRenderer data={evaluations[activeTab].raw_llm_response} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EvaluationsView