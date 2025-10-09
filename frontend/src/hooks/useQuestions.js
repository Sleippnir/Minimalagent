import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT =
  'question_id, text, ideal_answer, category, tags'

export default function useQuestions({
  enabled = true,
  select = DEFAULT_SELECT,
  category,
} = {}) {
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
        .from('questions')
        .select(select)
        .order('text', { ascending: true })

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query
      if (error) throw error

      setData(data ?? [])
      setError(null)
      return data ?? []
    } catch (err) {
      console.error('Failed to load questions', err)
      setError(err)
      setData([])
      return []
    } finally {
      setLoading(false)
    }
  }, [canQuery, category, select, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
