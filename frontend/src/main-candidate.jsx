import React from 'react'
import ReactDOM from 'react-dom/client'
import { SupabaseProvider } from '../src/SupabaseContext.jsx'
import CandidatePortal from '../src/components/CandidatePortal.jsx'
import '../src/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SupabaseProvider>
      <CandidatePortal />
    </SupabaseProvider>
  </React.StrictMode>,
)