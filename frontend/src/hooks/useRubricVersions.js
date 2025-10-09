import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT =
  'rubric_version_id, version, rubric_json, rubrics(name)'

export default function useRubricVersions({
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
      const { data, error } = await supabase
        .from('rubric_versions')
        .select(select)
        .order('version', { ascending: false })
        .range(0, rangeTo)

      if (error) throw error

      const filtered = (data ?? []).filter(item => {
        const versionLabel = String(item.version ?? '').toLowerCase()
        return versionLabel ? !versionLabel.includes('deprecated') : true
      })

      setData(filtered)
      setError(null)
      return filtered
    } catch (err) {
      console.error('Failed to load rubric versions', err)
      setError(err)
      setData([])
      return []
    } finally {
      setLoading(false)
    }
  }, [canQuery, rangeTo, select, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
