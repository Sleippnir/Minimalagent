import { useState } from 'react'
import SearchableDropdown from './SearchableDropdown.jsx'

const QuestionManager = ({ questions, selectedQuestions, onChange }) => {
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const categories = [...new Set(questions.map(q => q.category))]

  const filteredQuestions = questions.filter(q => {
    const matchesText = q.text.toLowerCase().includes(filter.toLowerCase())
    const matchesCategory = !categoryFilter || q.category === categoryFilter
    return matchesText && matchesCategory
  })

  const isSelected = (question) => selectedQuestions.some(sq => sq.question_id === question.question_id)

  const toggleQuestion = (question) => {
    if (isSelected(question)) {
      onChange(selectedQuestions.filter(sq => sq.question_id !== question.question_id))
    } else {
      onChange([...selectedQuestions, question])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-cyan-400 mb-2">Interview Questions</label>

      <div className="mb-4 space-y-2">
        <input
          type="text"
          placeholder="Search questions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 glass-ui border-2 border-white rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm text-gray-300"
        />
        <SearchableDropdown
          label="Filter by Category"
          options={categories.map(cat => ({ value: cat, label: cat }))}
          value={categoryFilter ? { value: categoryFilter, label: categoryFilter } : null}
          onChange={(option) => setCategoryFilter(option ? option.value : '')}
          displayKey="label"
          placeholder="All Categories"
        />
      </div>

      <div className="glass-ui border border-cyan-800 rounded-md max-h-96 overflow-y-auto">
        {filteredQuestions.map(question => (
          <div
            key={question.question_id}
            className={`p-3 border-b border-cyan-800 cursor-pointer hover:bg-cyan-900 ${
              isSelected(question) ? 'bg-cyan-900' : ''
            }`}
            onClick={() => toggleQuestion(question)}
          >
            <div className="flex items-start">
              <input
                type="checkbox"
                checked={isSelected(question)}
                onChange={() => toggleQuestion(question)}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <p className="text-sm text-gray-300">{question.text}</p>
                <p className="text-xs text-cyan-400 mt-1">Category: {question.category}</p>
                {question.tags && question.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {question.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-800 text-cyan-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-medium text-cyan-400 mb-2">Selected Questions ({selectedQuestions.length})</h4>
        <div className="space-y-1">
          {selectedQuestions.map((question, index) => (
            <div key={question.question_id} className="flex items-center justify-between glass-ui p-2 rounded">
              <span className="text-sm text-gray-300">{index + 1}. {question.text}</span>
              <button
                onClick={() => toggleQuestion(question)}
                className="text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QuestionManager