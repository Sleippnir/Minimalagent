import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'

const DEFAULT_SELECT = 'question_id, text, category, ideal_answer, tags'

export default function useQuestions({
  enabled = true,
  select = DEFAULT_SELECT,
  search = '',
  category = ''
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

      if (search) {
        query = query.or(`text.ilike.%${search}%,category.ilike.%${search}%,ideal_answer.ilike.%${search}%`)
      }

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
  }, [canQuery, select, search, category, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createQuestion = useCallback(async (questionData) => {
    if (!canQuery) return null

    try {
      const { data, error } = await supabase
        .from('questions')
        .insert([questionData])
        .select()
        .single()

      if (error) throw error

      setData(prev => [data, ...prev])
      return data
    } catch (err) {
      console.error('Failed to create question', err)
      throw err
    }
  }, [canQuery, supabase])

  const updateQuestion = useCallback(async (id, questionData) => {
    if (!canQuery) return null

    try {
      const { data, error } = await supabase
        .from('questions')
        .update(questionData)
        .eq('question_id', id)
        .select()
        .single()

      if (error) throw error

      setData(prev => prev.map(question =>
        question.question_id === id ? { ...question, ...data } : question
      ))
      return data
    } catch (err) {
      console.error('Failed to update question', err)
      throw err
    }
  }, [canQuery, supabase])

  const deleteQuestion = useCallback(async (id) => {
    if (!canQuery) return

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('question_id', id)

      if (error) throw error

      setData(prev => prev.filter(question => question.question_id !== id))
    } catch (err) {
      console.error('Failed to delete question', err)
      throw err
    }
  }, [canQuery, supabase])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    createQuestion,
    updateQuestion,
    deleteQuestion
  }
}
