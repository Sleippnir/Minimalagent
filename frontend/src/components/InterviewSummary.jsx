const formatPrompt = (prompt) => {
  if (!prompt) return 'Not selected'
  const name = prompt.prompts?.name ?? prompt.name ?? 'Unknown'
  const version = prompt.version
  if (version === undefined || version === null || version === '') {
    return name
  }
  return `${name} (v${version})`
}

const formatRubric = (rubric) => {
  if (!rubric) return 'Not selected'
  const name = rubric.rubrics?.name ?? rubric.name ?? 'Unknown'
  const version = rubric.version
  if (version === undefined || version === null || version === '') {
    return name
  }
  return `${name} (v${version})`
}

const InterviewSummary = ({ formData }) => {
  const getDisplayName = (item, key) => {
    if (!item) return 'Not selected'
    return typeof key === 'function' ? key(item) : item[key]
  }

  return (
    <div className="glass-ui p-4 rounded-md">
      <h3 className="text-lg font-medium text-cyan-400 mb-4">Interview Summary</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-300">Candidate</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {formData.candidate ? `${formData.candidate.first_name} ${formData.candidate.last_name}` : 'Not selected'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-300">Job Position</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {getDisplayName(formData.job, 'title')}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-300">Resume</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {formData.resume ? 'Uploaded' : 'Not uploaded'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-300">Questions</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {formData.questions.length} selected
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-300">Interviewer Prompt</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {formatPrompt(formData.interviewerPrompt)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-300">Evaluator Prompt</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {formatPrompt(formData.evaluatorPrompt)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-gray-300">Evaluation Rubric</dt>
          <dd className="mt-1 text-sm text-gray-300">
            {formatRubric(formData.rubric)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default InterviewSummary
