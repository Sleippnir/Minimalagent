import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT =
  'candidate_id, first_name, last_name, email, resume_path, phone, linkedin_url'

export default function useCandidates({ enabled = true, select = DEFAULT_SELECT } = {}) {
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
        .from('candidates')
        .select(select)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })

      if (error) throw error

      setData(data ?? [])
      setError(null)
      return data ?? []
    } catch (err) {
      console.error('Failed to load candidates', err)
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
