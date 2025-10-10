import { useState } from 'react'
import { SupabaseProvider } from '../../src/SupabaseContext.jsx'
import EvaluationsView from '../../src/components/EvaluationsView.jsx'
import JobsView from './components/JobsView.jsx'
import QuestionsView from './components/QuestionsView.jsx'
import HiringDashboardView from './components/HiringDashboardView.jsx'

function App() {
  const [currentView, setCurrentView] = useState('dashboard')

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <HiringDashboardView />
      case 'jobs':
        return <JobsView />
      case 'questions':
        return <QuestionsView />
      case 'evaluations':
        return <EvaluationsView />
      default:
        return <HiringDashboardView />
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
                  <h1 className="text-xl font-bold text-cyan-400">Hiring Manager Dashboard</h1>
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
                    onClick={() => setCurrentView('jobs')}
                    className={`${
                      currentView === 'jobs'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-300 hover:border-gray-300 hover:text-white'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Jobs
                  </button>
                  <button
                    onClick={() => setCurrentView('questions')}
                    className={`${
                      currentView === 'questions'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-300 hover:border-gray-300 hover:text-white'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Questions
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
              <div className="flex items-center">
                <button
                  onClick={() => window.location.href = '/'}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 hover:border-gray-500 hover:text-white transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
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