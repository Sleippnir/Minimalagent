import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import Spinner from './Spinner.jsx'

const DashboardView = () => {
  const supabase = useSupabase()
  const [stats, setStats] = useState(null)
  const [recentInterviews, setRecentInterviews] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [chartData, setChartData] = useState({
    statusDistribution: [],
    modelPerformance: [],
    weeklyTrends: []
  })
  const [loading, setLoading] = useState(true)
  // Color mapping for different AI providers
  const getModelColor = (modelName) => {
    const model = modelName.toLowerCase()
    if (model.includes('gpt') || model.includes('openai')) {
      return '#06b6d4' // Cyan (OpenAI blue)
    } else if (model.includes('claude') || model.includes('anthropic')) {
      return '#f97316' // Orange (Anthropic orange)
    } else if (model.includes('gemini') || model.includes('google') || model.includes('bard')) {
      return '#10b981' // Green (Google green)
    } else if (model.includes('deepseek')) {
      return '#8b5cf6' // Purple (DeepSeek purple)
    } else if (model.includes('perplexity')) {
      return '#f59e0b' // Amber (Perplexity amber)
    } else {
      return '#6b7280' // Gray (default)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      if (!supabase) {
        // Mock data for development
        setStats({
          total: 15,
          scheduled: 5,
          completed: 7,
          evaluated: 3,
        })
        setMetrics({
          completionRate: 78,
          avgProcessingTime: 12,
          pendingEvaluations: 2,
          topQuestions: [
            { text: "Tell me about a challenging project", count: 8 },
            { text: "How do you handle feedback?", count: 6 },
            { text: "Describe your problem-solving approach", count: 5 }
          ],
          modelPerformance: {
            "gpt-4-turbo": { avgScore: 8.2, count: 12 },
            "claude-3": { avgScore: 7.8, count: 8 },
            "gemini-pro": { avgScore: 7.5, count: 6 },
            "deepseek-chat": { avgScore: 7.2, count: 4 }
          }
        })
        setChartData({
          statusDistribution: [
            { name: 'Scheduled', value: 5, color: '#fbbf24' },
            { name: 'Completed', value: 7, color: '#3b82f6' },
            { name: 'Evaluated', value: 3, color: '#10b981' }
          ],
          modelPerformance: [
            { model: 'gpt-4-turbo', avgScore: 8.2, evaluations: 12 },
            { model: 'claude-3', avgScore: 7.8, evaluations: 8 },
            { model: 'gemini-pro', avgScore: 7.5, evaluations: 6 },
            { model: 'deepseek-chat', avgScore: 7.2, evaluations: 4 }
          ],
          weeklyTrends: [
            { day: 'Mon', interviews: 3, evaluations: 2 },
            { day: 'Tue', interviews: 5, evaluations: 3 },
            { day: 'Wed', interviews: 2, evaluations: 4 },
            { day: 'Thu', interviews: 6, evaluations: 3 },
            { day: 'Fri', interviews: 4, evaluations: 5 },
            { day: 'Sat', interviews: 1, evaluations: 2 },
            { day: 'Sun', interviews: 0, evaluations: 1 }
          ]
        })
        setRecentInterviews([
          {
            interview_id: '1',
            status: 'scheduled',
            applications: {
              candidates: { first_name: 'John', last_name: 'Doe' },
              jobs: { title: 'Software Engineer' }
            }
          },
          {
            interview_id: '2',
            status: 'completed',
            applications: {
              candidates: { first_name: 'Jane', last_name: 'Smith' },
              jobs: { title: 'Product Manager' }
            }
          }
        ])
      } else {
        await Promise.all([fetchDashboardStats(), fetchRecentInterviews(), fetchMetricsData(), fetchChartData()])
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboardStats = async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select('status')

    if (error) throw error

    const statusCounts = data.reduce((acc, interview) => {
      acc[interview.status] = (acc[interview.status] || 0) + 1
      return acc
    }, {})

    setStats({
      total: data.length,
      scheduled: statusCounts.scheduled || 0,
      completed: statusCounts.completed || 0,
      evaluated: statusCounts.evaluated || 0,
    })
  }

  const fetchRecentInterviews = async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        interview_id,
        status,
        created_at,
        interviewer_prompt_version:interviewer_prompt_version_id (
          prompt: prompt_id (
            name
          )
        ),
        evaluator_prompt_version:evaluator_prompt_version_id (
          prompt: prompt_id (
            name
          )
        ),
        rubric_version:rubric_version_id (
          rubric: rubric_id (
            name
          )
        ),
        applications (
          candidates (
            first_name,
            last_name,
            email
          ),
          jobs (
            title
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error

    setRecentInterviews(data)
  }

  const fetchChartData = async () => {
    // Status distribution for pie chart
    const { data: interviews } = await supabase
      .from('interviews')
      .select('status')

    const statusCounts = interviews.reduce((acc, interview) => {
      acc[interview.status] = (acc[interview.status] || 0) + 1
      return acc
    }, {})

    const statusDistribution = [
      { name: 'Scheduled', value: statusCounts.scheduled || 0, color: '#fbbf24' },
      { name: 'Completed', value: statusCounts.completed || 0, color: '#3b82f6' },
      { name: 'Evaluated', value: statusCounts.evaluated || 0, color: '#10b981' }
    ]

    // Model performance for bar chart
    const { data: evaluations } = await supabase
      .from('evaluations')
      .select('evaluator_llm_model, score')

    const modelStats = evaluations.reduce((acc, evaluation) => {
      const model = evaluation.evaluator_llm_model
      if (!acc[model]) {
        acc[model] = { total: 0, count: 0 }
      }
      acc[model].total += evaluation.score || 0
      acc[model].count += 1
      return acc
    }, {})

    const modelPerformance = Object.entries(modelStats)
      .map(([model, stats]) => ({
        model: model.length > 15 ? model.substring(0, 15) + '...' : model,
        avgScore: Math.round((stats.total / stats.count) * 10) / 10,
        evaluations: stats.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)

    // Mock weekly trends (in real app, would query by date)
    const weeklyTrends = [
      { day: 'Mon', interviews: 3, evaluations: 2 },
      { day: 'Tue', interviews: 5, evaluations: 3 },
      { day: 'Wed', interviews: 2, evaluations: 4 },
      { day: 'Thu', interviews: 6, evaluations: 3 },
      { day: 'Fri', interviews: 4, evaluations: 5 },
      { day: 'Sat', interviews: 1, evaluations: 2 },
      { day: 'Sun', interviews: 0, evaluations: 1 }
    ]

    setChartData({
      statusDistribution,
      modelPerformance,
      weeklyTrends
    })
  }

  const fetchMetricsData = async () => {
    // Completion rate calculation
    const { data: interviews, error: interviewsError } = await supabase
      .from('interviews')
      .select('status')

    if (interviewsError) throw interviewsError

    const total = interviews.length
    const completed = interviews.filter(i => i.status === 'completed' || i.status === 'evaluated').length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Pending evaluations
    const pendingEvaluations = interviews.filter(i => i.status === 'completed').length

    // Top questions
    const { data: questionData, error: questionError } = await supabase
      .from('interview_questions')
      .select(`
        question_id,
        questions (
          text
        )
      `)

    if (questionError) throw questionError

    const questionCounts = questionData.reduce((acc, item) => {
      const text = item.questions?.text
      if (text) {
        acc[text] = (acc[text] || 0) + 1
      }
      return acc
    }, {})

    const topQuestions = Object.entries(questionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([text, count]) => ({ text: text.length > 30 ? text.substring(0, 30) + '...' : text, count }))

    // Model performance
    const { data: evalData, error: evalError } = await supabase
      .from('evaluations')
      .select('evaluator_llm_model, score')

    if (evalError) throw evalError

    const modelStats = evalData.reduce((acc, evaluation) => {
      const model = evaluation.evaluator_llm_model
      if (!acc[model]) {
        acc[model] = { total: 0, count: 0 }
      }
      acc[model].total += evaluation.score || 0
      acc[model].count += 1
      return acc
    }, {})

    const modelPerformance = Object.entries(modelStats).reduce((acc, [model, stats]) => {
      acc[model] = {
        avgScore: Math.round((stats.total / stats.count) * 10) / 10,
        count: stats.count
      }
      return acc
    }, {})

    setMetrics({
      completionRate,
      pendingEvaluations,
      topQuestions,
      modelPerformance
    })
  }

  if (loading) {
    return <Spinner />
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-cyan-400">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-300">Overview of interview activities</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="stat-card p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-cyan-400 rounded-md flex items-center justify-center">
                  <span className="text-dark-blue text-sm font-medium">T</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Total Interviews</dt>
                  <dd className="text-lg font-medium text-cyan-400">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="stat-card p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-400 rounded-md flex items-center justify-center">
                  <span className="text-dark-blue text-sm font-medium">S</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Scheduled</dt>
                  <dd className="text-lg font-medium text-yellow-400">{stats.scheduled}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="stat-card p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-400 rounded-md flex items-center justify-center">
                  <span className="text-dark-blue text-sm font-medium">C</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Completed</dt>
                  <dd className="text-lg font-medium text-blue-400">{stats.completed}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="stat-card p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-400 rounded-md flex items-center justify-center">
                  <span className="text-dark-blue text-sm font-medium">E</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-300 truncate">Evaluated</dt>
                  <dd className="text-lg font-medium text-green-400">{stats.evaluated}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side: Recent Interviews */}
        <div className="lg:col-span-2">
          <div className="table-container overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-cyan-400">Recent Interviews</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-300">Latest interview activities</p>
            </div>
            <ul className="divide-y divide-cyan-800">
              {recentInterviews.map((interview) => (
                <li key={interview.interview_id} className="table-row px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-cyan-400 flex items-center justify-center">
                          <span className="text-dark-blue text-sm font-medium">
                            {interview.applications?.candidates?.first_name?.[0]}{interview.applications?.candidates?.last_name?.[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-cyan-400">
                          {interview.applications?.candidates?.first_name} {interview.applications?.candidates?.last_name}
                        </div>
                        <div className="text-sm text-gray-300">
                          {interview.applications?.jobs?.title}
                        </div>
                        <div className="text-xs text-gray-400">
                          Created: {interview.created_at ? new Date(interview.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Interviewer Prompt: {interview.interviewer_prompt_version?.prompt?.name || 'None'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Evaluator Prompt: {interview.evaluator_prompt_version?.prompt?.name || 'None'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Rubric: {interview.rubric_version?.rubric?.name || 'None'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        interview.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                        interview.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        interview.status === 'evaluated' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {interview.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right side: Metrics Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Interview Status Distribution */}
          {chartData.statusDistribution.length > 0 && (
            <div className="glass-ui p-4 rounded-lg">
              <h4 className="text-sm font-medium text-cyan-400 mb-4">Interview Status</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.9)',
                      border: '1px solid rgba(34, 197, 218, 0.2)',
                      borderRadius: '8px',
                      color: '#e5e7eb'
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI Model Performance */}
          {chartData.modelPerformance.length > 0 && (
            <div className="glass-ui p-4 rounded-lg">
              <h4 className="text-sm font-medium text-cyan-400 mb-4">AI Model Performance</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.modelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 218, 0.1)" />
                  <XAxis
                    dataKey="model"
                    stroke="#9ca3af"
                    fontSize={10}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.9)',
                      border: '1px solid rgba(34, 197, 218, 0.2)',
                      borderRadius: '8px',
                      color: '#e5e7eb'
                    }}
                  />
                  <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
                    {chartData.modelPerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getModelColor(entry.model)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly Activity Trends */}
          {chartData.weeklyTrends.length > 0 && (
            <div className="glass-ui p-4 rounded-lg">
              <h4 className="text-sm font-medium text-cyan-400 mb-4">Weekly Activity</h4>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData.weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 218, 0.1)" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(31, 41, 55, 0.9)',
                      border: '1px solid rgba(34, 197, 218, 0.2)',
                      borderRadius: '8px',
                      color: '#e5e7eb'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="evaluations"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Key Metrics Cards */}
          {metrics && (
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-ui p-3 rounded-lg text-center">
                <div className="text-lg font-bold text-cyan-400">{metrics?.completionRate || 0}%</div>
                <div className="text-xs text-gray-300">Completion Rate</div>
              </div>
              <div className="glass-ui p-3 rounded-lg text-center">
                <div className="text-lg font-bold text-yellow-400">{metrics?.pendingEvaluations || 0}</div>
                <div className="text-xs text-gray-300">Pending Reviews</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardView