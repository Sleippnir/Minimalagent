import { useState } from 'react'
import { SupabaseProvider } from './SupabaseContext.jsx'
import DashboardView from './components/DashboardView.jsx'
import InterviewsView from './components/InterviewsView.jsx'
import CandidatesView from './components/CandidatesView.jsx'
import EvaluationsView from './components/EvaluationsView.jsx'

/**
 * Main application component that provides Supabase context and renders the top navigation and selected view.
 *
 * The navigation lets the user switch between Dashboard, Schedule Interview, Candidates, and Evaluations;
 * the currently selected view is rendered in the main content area.
 * @returns {JSX.Element} The app's root React element containing the navigation and the currently selected view.
 */
function App() {
  const [currentView, setCurrentView] = useState('dashboard')

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />
      case 'interviews':
        return <InterviewsView />
      case 'candidates':
        return <CandidatesView />
      case 'evaluations':
        return <EvaluationsView />
      default:
        return <DashboardView />
    }
  }

  return (
    <SupabaseProvider>
      <div className="min-h-screen main-background">
        <nav className="glass-ui shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold text-cyan-400">HR AI Assistant</h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`${
                      currentView === 'dashboard'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-300 hover:border-gray-300 hover:text-white'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setCurrentView('interviews')}
                    className={`${
                      currentView === 'interviews'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-300 hover:border-gray-300 hover:text-white'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Schedule Interview
                  </button>
                  <button
                    onClick={() => setCurrentView('candidates')}
                    className={`${
                      currentView === 'candidates'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-300 hover:border-gray-300 hover:text-white'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Candidates
                  </button>
                  <button
                    onClick={() => setCurrentView('evaluations')}
                    className={`${
                      currentView === 'evaluations'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-300 hover:border-gray-300 hover:text-white'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Evaluations
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {renderView()}
        </main>
      </div>
    </SupabaseProvider>
  )
}

export default App