import { useState } from 'react'
import useJobs from '../../../src/hooks/useJobs.js'
import Spinner from '../../../src/components/Spinner.jsx'
import Toast from '../../../src/components/Toast.jsx'
import ConfirmationDialog from '../../../src/components/ConfirmationDialog.jsx'
import ReactMarkdown from 'react-markdown'
import SearchableDropdown from '../../../src/components/SearchableDropdown.jsx'

const JobsView = () => {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [confirmationDialog, setConfirmationDialog] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    required_tags: []
  })

  const { data: jobs, loading, error, createJob, updateJob, deleteJob } = useJobs({
    search
  })

  const handleCreateJob = async (e) => {
    e.preventDefault()
    try {
      await createJob(formData)
      setShowCreateForm(false)
      setFormData({ title: '', description: '', required_tags: [] })
      setToast({ message: 'Job created successfully!', type: 'success' })
    } catch (error) {
      console.error('Error creating job:', error)
      setToast({ message: 'Failed to create job. Please try again.', type: 'error' })
    }
  }

  const handleUpdateJob = async (e) => {
    e.preventDefault()
    try {
      await updateJob(editingJob.job_id, formData)
      setEditingJob(null)
      setFormData({ title: '', description: '', required_tags: [] })
      setToast({ message: 'Job updated successfully!', type: 'success' })
    } catch (error) {
      console.error('Error updating job:', error)
      setToast({ message: 'Failed to update job. Please try again.', type: 'error' })
    }
  }

  const handleEditJob = (job) => {
    setEditingJob(job)
    setFormData({
      title: job.title,
      description: job.description,
      required_tags: job.required_tags || []
    })
  }

  const handleDeleteJob = (jobId, jobTitle) => {
    setConfirmationDialog({
      message: `Are you sure you want to delete the job "${jobTitle}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteJob(jobId)
          setToast({ message: 'Job deleted successfully!', type: 'success' })
        } catch (error) {
          console.error('Error deleting job:', error)
          setToast({ message: 'Failed to delete job. Please try again.', type: 'error' })
        }
        setConfirmationDialog(null)
      },
      onCancel: () => setConfirmationDialog(null)
    })
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setEditingJob(null)
    setFormData({ title: '', description: '', required_tags: [] })
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400">Job Management</h2>
          <p className="mt-1 text-sm text-gray-300">Create and manage job postings</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-cyan-500 rounded-lg hover:bg-cyan-500 hover:border-cyan-400 hover:scale-105 hover:shadow-lg active:bg-cyan-700 active:border-cyan-600 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New Job
        </button>
      </div>

      {/* Search */}
      <div className="glass-ui rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Search Jobs</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or description..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {(showCreateForm || editingJob) && (
        <div className="glass-ui rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-cyan-400 mb-4">
            {editingJob ? 'Edit Job' : 'Create New Job'}
          </h3>
          <form onSubmit={editingJob ? handleUpdateJob : handleCreateJob} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Job Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Required Tags</label>
              <input
                type="text"
                value={formData.required_tags.join(', ')}
                onChange={(e) => setFormData({ ...formData, required_tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                placeholder="Enter tags separated by commas"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-cyan-500 rounded-lg hover:bg-cyan-500 hover:border-cyan-400 hover:scale-105 hover:shadow-lg active:bg-cyan-700 active:border-cyan-600 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {editingJob ? 'Update Job' : 'Create Job'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 hover:border-gray-500 hover:scale-105 hover:shadow-lg active:bg-gray-800 active:border-gray-700 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.job_id} className="glass-ui rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-white">{job.title}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {job.applications_count} applications
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleEditJob(job)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-cyan-400 bg-cyan-900/30 border border-cyan-600/50 rounded-lg hover:bg-cyan-600/60 hover:border-cyan-400 hover:text-cyan-300 hover:scale-105 hover:shadow-lg active:bg-cyan-700/70 active:border-cyan-500 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteJob(job.job_id, job.title)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-400 bg-red-900/30 border border-red-600/50 rounded-lg hover:bg-red-600/60 hover:border-red-400 hover:text-red-300 hover:scale-105 hover:shadow-lg active:bg-red-700/70 active:border-red-500 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-cyan-400 mb-2">Description</h4>
                <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{job.description}</ReactMarkdown>
                </div>
              </div>
              {job.required_tags && job.required_tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-cyan-400 mb-2">Required Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {job.required_tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-800 text-cyan-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="glass-ui rounded-lg p-6 text-center">
            <p className="text-gray-400">No jobs found matching your criteria. Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmationDialog && (
        <ConfirmationDialog
          message={confirmationDialog.message}
          onConfirm={confirmationDialog.onConfirm}
          onCancel={confirmationDialog.onCancel}
        />
      )}
    </div>
  )
}

export default JobsView