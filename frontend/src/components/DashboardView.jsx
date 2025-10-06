import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
// Extracted reusable chart components - check these before creating new chart components
import InterviewStatusChart from './charts/InterviewStatusChart.jsx'
import ModelPerformanceChart from './charts/ModelPerformanceChart.jsx'
import WeeklyActivityChart from './charts/WeeklyActivityChart.jsx'
// Extracted reusable UI components - check these before creating new stat/metrics components
import StatCard from './StatCard.jsx'
import RecentInterviews from './RecentInterviews.jsx'
import MetricsSummary from './MetricsSummary.jsx'
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
          <StatCard icon="T" color="cyan" title="Total Interviews" value={stats.total} />
          <StatCard icon="S" color="yellow" title="Scheduled" value={stats.scheduled} />
          <StatCard icon="C" color="blue" title="Completed" value={stats.completed} />
          <StatCard icon="E" color="green" title="Evaluated" value={stats.evaluated} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side: Recent Interviews */}
        <div className="lg:col-span-2">
          <RecentInterviews interviews={recentInterviews} />
        </div>

        {/* Right side: Metrics Panel */}
        <div className="lg:col-span-1 space-y-6">
          <InterviewStatusChart data={chartData.statusDistribution} />

          <ModelPerformanceChart data={chartData.modelPerformance} />

          <WeeklyActivityChart data={chartData.weeklyTrends} />

          {/* Key Metrics Cards */}
          {metrics && (
            <MetricsSummary
              completionRate={metrics.completionRate}
              pendingEvaluations={metrics.pendingEvaluations}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardView