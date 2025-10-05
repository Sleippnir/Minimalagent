import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
import Spinner from './Spinner.jsx'

const DashboardView = () => {
  const supabase = useSupabase()
  const [stats, setStats] = useState(null)
  const [recentInterviews, setRecentInterviews] = useState([])
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
        await Promise.all([fetchDashboardStats(), fetchRecentInterviews()])
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
      .order('interview_id', { ascending: false })
      .limit(10)

    if (error) throw error

    setRecentInterviews(data)
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
  )
}

export default DashboardView