import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT =
  'prompt_version_id, version, content, prompts(name, purpose)'

export default function usePromptVersions({
  purpose,
  enabled = true,
  select = DEFAULT_SELECT,
  limit = 500,
} = {}) {
  const supabase = useSupabase()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canQuery = enabled && !!supabase
  const rangeTo = Math.max(limit - 1, 0)

  const fetchData = useCallback(async () => {
    if (!canQuery) {
      setData([])
      setLoading(false)
      return []
    }

    setLoading(true)
    try {
      let query = supabase
        .from('prompt_versions')
        .select(select)
        .order('version', { ascending: false })
        .range(0, rangeTo)

      if (purpose) {
        query = query.eq('prompts.purpose', purpose)
      }

      const { data, error } = await query
      if (error) throw error

      const filtered = (data ?? []).filter(item => {
        const versionLabel = String(item.version ?? '').toLowerCase()
        return versionLabel ? !versionLabel.includes('deprecated') : true
      })

      setData(filtered)
      setError(null)
      return filtered
    } catch (err) {
      console.error('Failed to load prompt versions', err)
      setError(err)
      setData([])
      return []
    } finally {
      setLoading(false)
    }
  }, [canQuery, purpose, rangeTo, select, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
