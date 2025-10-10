import { useState, useEffect } from 'react'
import { useSupabase } from '../../../src/SupabaseContext.jsx'
import StatCard from '../../../src/components/StatCard.jsx'
import Spinner from '../../../src/components/Spinner.jsx'
import Toast from '../../../src/components/Toast.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const HiringDashboardView = () => {
  const supabase = useSupabase()
  const [stats, setStats] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const [tagStats, setTagStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setToast(null)
    try {
      if (!supabase) {
        // Mock data for development
        setStats({
          totalJobs: 8,
          activeJobs: 5,
          totalQuestions: 45,
          totalEvaluations: 23,
        })
        setRecentJobs([
          {
            id: '1',
            title: 'Senior Software Engineer',
            status: 'active',
            created_at: '2024-01-15',
            applications_count: 12
          },
          {
            id: '2',
            title: 'Product Manager',
            status: 'active',
            created_at: '2024-01-10',
            applications_count: 8
          },
          {
            id: '3',
            title: 'UX Designer',
            status: 'draft',
            created_at: '2024-01-08',
            applications_count: 0
          }
        ])
        setTagStats([
          { name: 'JavaScript', count: 15 },
          { name: 'React', count: 12 },
          { name: 'Python', count: 10 },
          { name: 'Leadership', count: 8 },
          { name: 'Communication', count: 6 },
          { name: 'Problem Solving', count: 9 },
          { name: 'Teamwork', count: 7 },
          { name: 'SQL', count: 5 }
        ])
      } else {
        await Promise.all([
          fetchJobStats(),
          fetchRecentJobs(),
          fetchTagStats()
        ])
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setToast({ message: 'Failed to load dashboard data. Please try again.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const fetchJobStats = async () => {
    // Fetch job count
    const { count: jobCount, error: jobsError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })

    if (jobsError) throw jobsError

    // Fetch question count
    const { count: questionCount, error: questionError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })

    if (questionError) throw questionError

    // Fetch evaluation count
    const { count: evaluationCount, error: evalError } = await supabase
      .from('evaluations')
      .select('*', { count: 'exact', head: true })

    if (evalError) throw evalError

    setStats({
      totalJobs: jobCount || 0,
      activeJobs: jobCount || 0, // Since we don't have status, all jobs are considered active
      totalQuestions: questionCount || 0,
      totalEvaluations: evaluationCount || 0,
    })
  }

  const fetchRecentJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        job_id,
        title,
        description
      `)
      .order('title', { ascending: true })
      .limit(5)

    if (error) throw error

    // For each job, count applications
    const jobsWithCounts = await Promise.all(
      data.map(async (job) => {
        const { count, error: countError } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.job_id)

        return {
          ...job,
          id: job.job_id, // Add id for compatibility
          applications_count: countError ? 0 : count || 0
        }
      })
    )

    setRecentJobs(jobsWithCounts)
  }

  const fetchTagStats = async () => {
    try {
      // Fetch job tags
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('required_tags')

      if (jobsError) throw jobsError

      // Fetch question tags
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('tags')

      if (questionsError) throw questionsError

      // Count tag occurrences
      const tagCounts = {}

      // Count job tags
      jobs.forEach(job => {
        if (job.required_tags && Array.isArray(job.required_tags)) {
          job.required_tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        }
      })

      // Count question tags
      questions.forEach(question => {
        if (question.tags && Array.isArray(question.tags)) {
          question.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        }
      })

      // Convert to array and sort by count
      const tagStatsArray = Object.entries(tagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 tags

      setTagStats(tagStatsArray)
    } catch (error) {
      console.error('Error fetching tag stats:', error)
      setTagStats([])
    }
  }

  if (loading) {
    return (
      <>
        <Spinner />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-cyan-400">Hiring Dashboard</h2>
        <p className="mt-1 text-sm text-gray-300">Overview of your hiring activities and job postings</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard icon="J" color="cyan" title="Total Jobs" value={stats.totalJobs} />
          <StatCard icon="A" color="green" title="Active Jobs" value={stats.activeJobs} />
          <StatCard icon="Q" color="yellow" title="Questions" value={stats.totalQuestions} />
          <StatCard icon="E" color="blue" title="Evaluations" value={stats.totalEvaluations} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="glass-ui rounded-lg p-6">
          <h3 className="text-lg font-medium text-cyan-400 mb-4">Recent Job Postings</h3>
          <div className="space-y-4">
            {recentJobs.map((job) => (
              <div key={job.job_id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">{job.title}</h4>
                  <p className="text-xs text-gray-400">
                    {job.applications_count} applications
                  </p>
                </div>
              </div>
            ))}
            {recentJobs.length === 0 && (
              <p className="text-gray-400 text-center py-4">No jobs posted yet</p>
            )}
          </div>
        </div>

        {/* Tag Distribution Chart */}
        <div className="glass-ui rounded-lg p-6">
          <h3 className="text-lg font-medium text-cyan-400 mb-4">Tag Distribution</h3>
          {tagStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tagStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="tagGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 218, 0.1)" />
                <XAxis
                  dataKey="name"
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
                <Bar dataKey="count" fill="url(#tagGradient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-400">No tag data available</p>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

export default HiringDashboardView