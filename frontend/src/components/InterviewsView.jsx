import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useSupabase } from '../SupabaseContext.jsx'
import Spinner from './Spinner.jsx'
import Toast from './Toast.jsx'
import SearchableDropdown from './SearchableDropdown.jsx'
import QuestionManager from './QuestionManager.jsx'
import InterviewSummary from './InterviewSummary.jsx'
import {
  useCandidates,
  useJobs,
  useQuestions,
  usePromptVersions,
  useRubricVersions,
} from '../hooks/index.js'

const InterviewsView = () => {
  const supabase = useSupabase()
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showCandidateModal, setShowCandidateModal] = useState(false)
  const [showInspectModal, setShowInspectModal] = useState(false)
  const [inspectContent, setInspectContent] = useState('')
  const [inspectTitle, setInspectTitle] = useState('')
  const [inspectType, setInspectType] = useState('')
  const [candidateFormData, setCandidateFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
  })
  const [formData, setFormData] = useState({
    candidate: null,
    job: null,
    resume: null,
    questions: [],
    interviewerPrompt: null,
    evaluatorPrompt: null,
    rubric: null,
  })

  const formatPromptLabel = (prompt) => {
    if (!prompt) return 'Not selected'
    const name = prompt.prompts?.name ?? prompt.name ?? 'Unknown'
    const version = prompt.version
    if (version === undefined || version === null || version === '') {
      return name
    }
    return `${name} (v${version})`
  }

  const formatRubricLabel = (rubric) => {
    if (!rubric) return 'Not selected'
    const name = rubric.rubrics?.name ?? rubric.name ?? 'Unknown'
    const version = rubric.version
    if (version === undefined || version === null || version === '') {
      return name
    }
    return `${name} (v${version})`
  }

  const {
    data: candidateList = [],
    loading: candidatesLoading,
    error: candidatesError,
    refetch: refetchCandidates,
  } = useCandidates()

  const {
    data: jobList = [],
    loading: jobsLoading,
    error: jobsError,
  } = useJobs()

  const {
    data: questionList = [],
    loading: questionsLoading,
    error: questionsError,
  } = useQuestions()

  const {
    data: interviewerPromptVersions = [],
    loading: interviewerPromptsLoading,
    error: interviewerPromptsError,
  } = usePromptVersions({ purpose: 'interviewer' })

  const {
    data: evaluatorPromptVersions = [],
    loading: evaluatorPromptsLoading,
    error: evaluatorPromptsError,
  } = usePromptVersions({ purpose: 'evaluator' })

  const {
    data: rubricVersions = [],
    loading: rubricsLoading,
    error: rubricsError,
  } = useRubricVersions()

  const isLoading =
    candidatesLoading ||
    jobsLoading ||
    questionsLoading ||
    interviewerPromptsLoading ||
    evaluatorPromptsLoading ||
    rubricsLoading

  const anyError =
    candidatesError ||
    jobsError ||
    questionsError ||
    interviewerPromptsError ||
    evaluatorPromptsError ||
    rubricsError

  const prompts = useMemo(
    () => [...interviewerPromptVersions, ...evaluatorPromptVersions],
    [interviewerPromptVersions, evaluatorPromptVersions]
  )

  useEffect(() => {
    if (anyError) {
      console.error('Error fetching form data:', anyError)
      setToast(prev =>
        prev?.type === 'error'
          ? prev
          : { message: 'Failed to load form data', type: 'error' }
      )
    }
  }, [anyError])

  const handleInspect = async (type, item) => {
    if (!item) return

    if (!supabase) {
      setToast({ message: 'Supabase not configured', type: 'error' })
      return
    }

    try {
      let content = ''
      let title = ''

      if (type === 'prompt') {
        title = `${item.prompts?.name} (${item.prompts?.purpose})`
        const { data, error } = await supabase
          .from('prompt_versions')
          .select('content')
          .eq('prompt_version_id', item.prompt_version_id)
          .single()

        if (error) throw error
        content = data.content
      } else if (type === 'rubric') {
        title = item.rubrics?.name
        const { data, error } = await supabase
          .from('rubric_versions')
          .select('rubric_json')
          .eq('rubric_version_id', item.rubric_version_id)
          .single()

        if (error) throw error
        content = JSON.stringify(data.rubric_json, null, 2)
      }

      setInspectTitle(title)
      setInspectContent(content)
      setInspectType(type)
      setShowInspectModal(true)
    } catch (error) {
      console.error('Error fetching content:', error)
      setToast({ message: 'Failed to load content', type: 'error' })
    }
  }

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!formData.candidate) {
      setToast({ message: 'Please select a candidate first', type: 'error' })
      return
    }

    if (!supabase) {
      setToast({ message: 'Supabase not configured', type: 'error' })
      return
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `resumes/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath)

      // Update candidate with resume path
      const { error: updateError } = await supabase
        .from('candidates')
        .update({ resume_path: publicUrl })
        .eq('candidate_id', formData.candidate.candidate_id)

      if (updateError) throw updateError

      setFormData(prev => ({ ...prev, resume: publicUrl, candidate: { ...prev.candidate, resume_path: publicUrl } }))
      await refetchCandidates()
      setToast({ message: 'Resume uploaded successfully', type: 'success' })
    } catch (error) {
      console.error('Error uploading resume:', error)
      setToast({ message: 'Failed to upload resume', type: 'error' })
    }
  }

  const handleAddCandidate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!supabase) {
        setToast({ message: 'Supabase not configured', type: 'error' })
        return
      }

      const { data, error } = await supabase
        .from('candidates')
        .insert([candidateFormData])
        .select()

      if (error) throw error

      const newCandidate = data[0]
      await refetchCandidates()
      setFormData(prev => ({ ...prev, candidate: newCandidate }))
      setToast({ message: 'Candidate added successfully', type: 'success' })
      setShowCandidateModal(false)
      setCandidateFormData({
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

  const handleScheduleInterview = async () => {
    if (!formData.candidate || !formData.job || !formData.questions.length || !formData.interviewerPrompt || !formData.evaluatorPrompt || !formData.rubric) {
      setToast({ message: 'Please fill all required fields', type: 'error' })
      return
    }

    if (!supabase) {
      setToast({ message: 'Supabase not configured - interview scheduling disabled', type: 'error' })
      return
    }

    setSubmitting(true)
    try {
      // Create/find application record first
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .upsert({ candidate_id: formData.candidate.candidate_id, job_id: formData.job.job_id }, { onConflict: 'candidate_id,job_id' })
        .select()
        .single()

      if (appError) throw appError

      const applicationId = appData.application_id

      // Invoke the edge function with application_id, question_ids, resume_path, and prompt version IDs
      const functionBody = {
        application_id: applicationId,
        question_ids: formData.questions.map(q => q.question_id),
        interviewer_prompt_version_id: formData.interviewerPrompt?.prompt_version_id,
        evaluator_prompt_version_id: formData.evaluatorPrompt?.prompt_version_id,
      }

      // Include resume_path only if it exists
      if (formData.resume) {
        functionBody.resume_path = formData.resume
      }

      const { data, error } = await supabase.functions.invoke('schedule-interview', {
        body: functionBody
      })

      if (error) throw error

      setToast({ message: 'Interview scheduled successfully', type: 'success' })
      // Reset form
      setFormData({
        candidate: null,
        job: null,
        resume: null,
        questions: [],
        interviewerPrompt: null,
        evaluatorPrompt: null,
        rubric: null,
      })
    } catch (error) {
      console.error('Error scheduling interview:', error)
      setToast({ message: 'Failed to schedule interview', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <Spinner />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-cyan-400">Schedule Interview</h2>
        <p className="mt-1 text-sm text-gray-300">Create a new AI-powered interview</p>
      </div>

      <div className="glass-ui p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <SearchableDropdown
              label="Candidate"
              options={candidateList}
              value={formData.candidate}
              onChange={(candidate) => setFormData(prev => ({ ...prev, candidate, resume: candidate?.resume_path || null }))}
              displayKey={(c) => `${c.first_name} ${c.last_name} (${c.email})`}
              placeholder="Select a candidate"
            />
            <button
              type="button"
              onClick={() => setShowCandidateModal(true)}
              className="mt-2 text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Add New Candidate
            </button>
          </div>

          <SearchableDropdown
            label="Job Position"
            options={jobList}
            value={formData.job}
            onChange={(job) => setFormData(prev => ({ ...prev, job }))}
            displayKey="title"
            placeholder="Select a job"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-cyan-400">Resume</label>
          {formData.candidate && formData.candidate.resume_path && (
            <div className="mt-1 mb-2">
              <SearchableDropdown
                label=""
                options={[{ name: decodeURIComponent(formData.candidate.resume_path.split('/').pop()), url: formData.candidate.resume_path }]}
                value={formData.resume ? { name: decodeURIComponent(formData.resume.split('/').pop()), url: formData.resume } : null}
                onChange={(resume) => setFormData(prev => ({ ...prev, resume: resume ? resume.url : null }))}
                displayKey="name"
                placeholder="Select resume"
              />
            </div>
          )}
          <input
            type="file"
            accept=".pdf"
            onChange={handleResumeUpload}
            className="mt-1 block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-400 file:text-dark-blue hover:file:bg-cyan-300"
          />
          {formData.resume && <p className="mt-1 text-sm text-green-400">Selected: {decodeURIComponent(formData.resume.split('/').pop())}</p>}
        </div>

        <QuestionManager
          questions={questionList}
          selectedQuestions={formData.questions}
          onChange={(questions) => setFormData(prev => ({ ...prev, questions }))}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SearchableDropdown
            label="Interviewer Prompt"
            options={prompts.filter(p => p.prompts?.purpose === 'interviewer')}
            value={formData.interviewerPrompt}
            onChange={(prompt) => setFormData(prev => ({ ...prev, interviewerPrompt: prompt }))}
            displayKey={formatPromptLabel}
            placeholder="Interviewer"
            extraButton={
              formData.interviewerPrompt ? (
                <button
                  type="button"
                  onClick={() => handleInspect('prompt', formData.interviewerPrompt)}
                  className="text-cyan-400 hover:text-cyan-300 p-1"
                  title="Inspect prompt content"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              ) : null
            }
          />

          <SearchableDropdown
            label="Evaluator Prompt"
            options={prompts.filter(p => p.prompts?.purpose === 'evaluator')}
            value={formData.evaluatorPrompt}
            onChange={(prompt) => setFormData(prev => ({ ...prev, evaluatorPrompt: prompt }))}
            displayKey={formatPromptLabel}
            placeholder="Evaluator"
            extraButton={
              formData.evaluatorPrompt ? (
                <button
                  type="button"
                  onClick={() => handleInspect('prompt', formData.evaluatorPrompt)}
                  className="text-cyan-400 hover:text-cyan-300 p-1"
                  title="Inspect prompt content"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              ) : null
            }
          />

          <SearchableDropdown
            label="Evaluation Rubric"
            options={rubricVersions}
            value={formData.rubric}
            onChange={(rubric) => setFormData(prev => ({ ...prev, rubric }))}
            displayKey={formatRubricLabel}
            placeholder="Rubric"
            extraButton={
              formData.rubric ? (
                <button
                  type="button"
                  onClick={() => handleInspect('rubric', formData.rubric)}
                  className="text-cyan-400 hover:text-cyan-300 p-1"
                  title="Inspect rubric content"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              ) : null
            }
          />
        </div>

        <InterviewSummary formData={formData} />

        <div className="flex justify-end">
          <button
            onClick={handleScheduleInterview}
            disabled={submitting}
            className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium text-dark-blue bg-cyan-400 hover:shadow-lg disabled:opacity-50"
          >
            {submitting ? 'Scheduling...' : 'Schedule Interview'}
          </button>
        </div>
      </div>

      {showCandidateModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom glass-ui rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleAddCandidate}>
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
                            value={candidateFormData.first_name}
                            onChange={(e) => setCandidateFormData(prev => ({ ...prev, first_name: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">Last Name</label>
                          <input
                            type="text"
                            required
                            value={candidateFormData.last_name}
                            onChange={(e) => setCandidateFormData(prev => ({ ...prev, last_name: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">Email</label>
                          <input
                            type="email"
                            required
                            value={candidateFormData.email}
                            onChange={(e) => setCandidateFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">Phone</label>
                          <input
                            type="tel"
                            value={candidateFormData.phone}
                            onChange={(e) => setCandidateFormData(prev => ({ ...prev, phone: e.target.value }))}
                            className="form-input mt-1 block w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-cyan-400">LinkedIn URL</label>
                          <input
                            type="url"
                            value={candidateFormData.linkedin_url}
                            onChange={(e) => setCandidateFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
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
                    onClick={() => setShowCandidateModal(false)}
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

      {showInspectModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto" onClick={() => setShowInspectModal(false)}>
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom glass-ui rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-cyan-400 mb-4">{inspectTitle}</h3>
                    <div className="bg-dark-blue p-4 rounded-md max-h-96 overflow-y-auto">
                      {inspectType === 'prompt' ? (
                        <div className="text-sm text-gray-300 prose prose-invert max-w-none">
                          <ReactMarkdown>{inspectContent}</ReactMarkdown>
                        </div>
                      ) : (
                        <SyntaxHighlighter language="json" style={oneDark} className="text-sm">
                          {inspectContent}
                        </SyntaxHighlighter>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowInspectModal(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
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

export default InterviewsView

