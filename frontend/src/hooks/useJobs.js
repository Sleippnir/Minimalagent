import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT = 'job_id, title, description, required_tags'

export default function useJobs({ enabled = true, select = DEFAULT_SELECT, search = '' } = {}) {
  const supabase = useSupabase()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canQuery = enabled && !!supabase

  const fetchData = useCallback(async () => {
    if (!canQuery) {
      setData([])
      setLoading(false)
      return []
    }

    setLoading(true)
    try {
      let query = supabase
        .from('jobs')
        .select(select)
        .order('title', { ascending: true })

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Get application counts for each job
      const jobsWithCounts = await Promise.all(
        data.map(async (job) => {
          const { count, error: countError } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.job_id)

          return {
            ...job,
            applications_count: countError ? 0 : count || 0
          }
        })
      )

      setData(jobsWithCounts)
      setError(null)
      return jobsWithCounts
    } catch (err) {
      console.error('Failed to load jobs', err)
      setError(err)
      setData([])
      return []
    } finally {
      setLoading(false)
    }
  }, [canQuery, select, search, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createJob = useCallback(async (jobData) => {
    if (!canQuery) return null

    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single()

      if (error) throw error

      // Add application count
      const newJob = { ...data, applications_count: 0 }
      setData(prev => [newJob, ...prev])
      return newJob
    } catch (err) {
      console.error('Failed to create job', err)
      throw err
    }
  }, [canQuery, supabase])

  const updateJob = useCallback(async (id, jobData) => {
    if (!canQuery) return null

    try {
      const { data, error } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('job_id', id)
        .select()
        .single()

      if (error) throw error

      setData(prev => prev.map(job =>
        job.job_id === id ? { ...job, ...data } : job
      ))
      return data
    } catch (err) {
      console.error('Failed to update job', err)
      throw err
    }
  }, [canQuery, supabase])

  const deleteJob = useCallback(async (id) => {
    if (!canQuery) return

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('job_id', id)

      if (error) throw error

      setData(prev => prev.filter(job => job.job_id !== id))
    } catch (err) {
      console.error('Failed to delete job', err)
      throw err
    }
  }, [canQuery, supabase])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    createJob,
    updateJob,
    deleteJob
  }
}
