import { createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'

const SupabaseContext = createContext()

const getSupabaseClient = () => {
  if (!getSupabaseClient.instance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey && supabaseUrl.trim() && supabaseAnonKey.trim()) {
      getSupabaseClient.instance = createClient(supabaseUrl, supabaseAnonKey)
    } else {
      console.warn('Supabase environment variables not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')
      getSupabaseClient.instance = null
    }
  }
  return getSupabaseClient.instance
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}

export const SupabaseProvider = ({ children }) => {
  const supabase = getSupabaseClient()
  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}