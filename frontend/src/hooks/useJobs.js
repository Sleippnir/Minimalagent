import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT = 'job_id, title, description, required_tags'

export default function useJobs({ enabled = true, select = DEFAULT_SELECT } = {}) {
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
      const { data, error } = await supabase
        .from('jobs')
        .select(select)
        .order('title', { ascending: true })

      if (error) throw error

      setData(data ?? [])
      setError(null)
      return data ?? []
    } catch (err) {
      console.error('Failed to load jobs', err)
      setError(err)
      setData([])
      return []
    } finally {
      setLoading(false)
    }
  }, [canQuery, select, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
