import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
import Spinner from './Spinner.jsx'
import Toast from './Toast.jsx'

const CandidatesView = () => {
  const supabase = useSupabase()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
  })

  useEffect(() => {
    fetchCandidates()
  }, [])

  const fetchCandidates = async () => {
    setLoading(true)
    try {
      if (!supabase) {
        // Mock data for development
        setCandidates([
          { candidate_id: '1', first_name: 'John', last_name: 'Doe', email: 'john@example.com', phone: '123-456-7890', linkedin_url: 'https://linkedin.com/in/johndoe' },
          { candidate_id: '2', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', phone: '098-765-4321', linkedin_url: null }
        ])
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .select('*')
          .order('last_name')

        if (error) throw error
        setCandidates(data)
      }
    } catch (error) {
      console.error('Error fetching candidates:', error)
      setToast({ message: 'Failed to load candidates', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!supabase) {
        // Mock adding candidate
        const newCandidate = {
          candidate_id: Date.now().toString(),
          ...formData
        }
        setCandidates(prev => [...prev, newCandidate])
        setToast({ message: 'Candidate added successfully (mock)', type: 'success' })
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .insert([formData])
          .select()

        if (error) throw error

        setCandidates(prev => [...prev, ...data])
        setToast({ message: 'Candidate added successfully', type: 'success' })
      }
      setShowModal(false)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        linkedin_url: '',
      })
    } catch (error) {
      console.error('Error adding candidate:', error)
      setToast({ message: 'Failed to add candidate', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Spinner />
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400">Candidates</h2>
          <p className="mt-1 text-sm text-gray-300">Manage candidate information</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          Add Candidate
        </button>
      </div>

      <div className="table-container overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-cyan-800">
          <thead className="table-header">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-cyan-400 uppercase tracking-wider">
                LinkedIn
              </th>
            </tr>
          </thead>
          <tbody className="glass-ui divide-y divide-cyan-800">
            {candidates.map((candidate) => (
              <tr key={candidate.candidate_id} className="table-row">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cyan-400">
                  {candidate.first_name} {candidate.last_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {candidate.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {candidate.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {candidate.linkedin_url ? (
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
                      View Profile
                    </a>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom glass-ui rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-cyan-400 mb-4">Add New Candidate</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">First Name</label>
                          <input
                            type="text"
                            required
                            value={formData.first_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">Last Name</label>
                          <input
                            type="text"
                            required
                            value={formData.last_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">Email</label>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">Phone</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">LinkedIn URL</label>
                          <input
                            type="url"
                            value={formData.linkedin_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="glass-ui px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {submitting ? 'Adding...' : 'Add Candidate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default CandidatesView