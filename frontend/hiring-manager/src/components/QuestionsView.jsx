import { useState, useEffect } from 'react'
import useQuestions from '../../../src/hooks/useQuestions.js'
import Spinner from '../../../src/components/Spinner.jsx'
import Toast from '../../../src/components/Toast.jsx'
import ConfirmationDialog from '../../../src/components/ConfirmationDialog.jsx'
import SearchableDropdown from '../../../src/components/SearchableDropdown.jsx'

const QuestionsView = () => {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState([])
  const [confirmationDialog, setConfirmationDialog] = useState(null)
  const [formData, setFormData] = useState({
    text: '',
    category: '',
    ideal_answer: '',
    tags: []
  })

  const { data: questions, loading, error, createQuestion, updateQuestion, deleteQuestion } = useQuestions({
    search,
    category: categoryFilter
  })

  // Extract unique categories from questions
  useEffect(() => {
    if (questions && questions.length > 0) {
      const uniqueCategories = [...new Set(questions.map(q => q.category).filter(Boolean))].map(category => ({
        value: category,
        label: category
      }))
      setCategories(uniqueCategories)
    }
  }, [questions])

  const handleCreateQuestion = async (e) => {
    e.preventDefault()
    try {
      await createQuestion(formData)
      setShowCreateForm(false)
      setFormData({ text: '', category: '', ideal_answer: '', tags: [] })
      setToast({ message: 'Question created successfully!', type: 'success' })
    } catch (error) {
      console.error('Error creating question:', error)
      setToast({ message: 'Failed to create question. Please try again.', type: 'error' })
    }
  }

  const handleUpdateQuestion = async (e) => {
    e.preventDefault()
    try {
      await updateQuestion(editingQuestion.question_id, formData)
      setEditingQuestion(null)
      setFormData({ text: '', category: '', ideal_answer: '', tags: [] })
      setToast({ message: 'Question updated successfully!', type: 'success' })
    } catch (error) {
      console.error('Error updating question:', error)
      setToast({ message: 'Failed to update question. Please try again.', type: 'error' })
    }
  }

  const handleEditQuestion = (question) => {
    setEditingQuestion(question)
    setFormData({
      text: question.text,
      category: question.category,
      ideal_answer: question.ideal_answer,
      tags: question.tags || []
    })
  }

  const handleDeleteQuestion = (questionId, questionText) => {
    setConfirmationDialog({
      message: `Are you sure you want to delete this question? "${questionText.substring(0, 50)}${questionText.length > 50 ? '...' : ''}"`,
      onConfirm: async () => {
        try {
          await deleteQuestion(questionId)
          setToast({ message: 'Question deleted successfully!', type: 'success' })
        } catch (error) {
          console.error('Error deleting question:', error)
          setToast({ message: 'Failed to delete question. Please try again.', type: 'error' })
        }
        setConfirmationDialog(null)
      },
      onCancel: () => setConfirmationDialog(null)
    })
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setEditingQuestion(null)
    setFormData({ text: '', category: '', ideal_answer: '', tags: [] })
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400">Question Bank</h2>
          <p className="mt-1 text-sm text-gray-300">Manage interview questions and ideal answers</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-cyan-500 rounded-lg hover:bg-cyan-500 hover:border-cyan-400 hover:scale-105 hover:shadow-lg active:bg-cyan-700 active:border-cyan-600 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Question
        </button>
      </div>

      {/* Search and Filter */}
      <div className="glass-ui rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Search Questions</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by question text, category, or ideal answer..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="sm:w-48">
            <SearchableDropdown
              label="Filter by Category"
              options={categories}
              value={categories.find(cat => cat.value === categoryFilter) || null}
              onChange={(option) => setCategoryFilter(option ? option.value : '')}
              displayKey="label"
              placeholder="Select a category"
            />
          </div>
        </div>
      </div>

      {(showCreateForm || editingQuestion) && (
        <div className="glass-ui rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-cyan-400 mb-4">
            {editingQuestion ? 'Edit Question' : 'Add New Question'}
          </h3>
          <form onSubmit={editingQuestion ? handleUpdateQuestion : handleCreateQuestion} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Question Text</label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                  placeholder="e.g., Technical, Experience, Soft Skills"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags.join(', ')}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Enter tags separated by commas"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Ideal Answer (Optional)</label>
              <textarea
                value={formData.ideal_answer}
                onChange={(e) => setFormData({ ...formData, ideal_answer: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                placeholder="Describe what makes a good answer to this question..."
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
                {editingQuestion ? 'Update Question' : 'Add Question'}
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
        {questions.map((question) => (
          <div key={question.question_id} className="glass-ui rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <p className="text-white font-medium mb-2">{question.text}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-400 mb-2">
                  <span>Category: {question.category || 'Uncategorized'}</span>
                </div>
                {question.tags && question.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {question.tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-800 text-cyan-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleEditQuestion(question)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-cyan-400 bg-cyan-900/30 border border-cyan-600/50 rounded-lg hover:bg-cyan-600/60 hover:border-cyan-400 hover:text-cyan-300 hover:scale-105 hover:shadow-lg active:bg-cyan-700/70 active:border-cyan-500 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteQuestion(question.question_id, question.text)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-400 bg-red-900/30 border border-red-600/50 rounded-lg hover:bg-red-600/60 hover:border-red-400 hover:text-red-300 hover:scale-105 hover:shadow-lg active:bg-red-700/70 active:border-red-500 active:scale-95 active:shadow-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
            {question.ideal_answer && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <h4 className="text-sm font-medium text-cyan-400 mb-2">Ideal Answer</h4>
                <p className="text-sm text-gray-300">{question.ideal_answer}</p>
              </div>
            )}
          </div>
        ))}
        {questions.length === 0 && (
          <div className="glass-ui rounded-lg p-6 text-center">
            <p className="text-gray-400">No questions found matching your criteria. Try adjusting your search or filters.</p>
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

export default QuestionsView