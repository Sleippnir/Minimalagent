import { useState, useEffect } from 'react'
import { useSupabase } from '../SupabaseContext.jsx'
import Spinner from './Spinner.jsx'
import Toast from './Toast.jsx'
import SearchableDropdown from './SearchableDropdown.jsx'
import QuestionManager from './QuestionManager.jsx'
import InterviewSummary from './InterviewSummary.jsx'

const InterviewsView = () => {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showCandidateModal, setShowCandidateModal] = useState(false)
  const [showInspectModal, setShowInspectModal] = useState(false)
  const [inspectContent, setInspectContent] = useState('')
  const [inspectTitle, setInspectTitle] = useState('')
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
  const [data, setData] = useState({
    candidates: [],
    jobs: [],
    questions: [],
    prompts: [],
    rubrics: [],
    resumes: [],
  })

  useEffect(() => {
    fetchInterviewFormData()
  }, [])

  const fetchInterviewFormData = async () => {
    setLoading(true)
    try {
      if (!supabase) {
        // Mock data for development
        setData({
          candidates: [
            { candidate_id: '1', first_name: 'John', last_name: 'Doe', email: 'john@example.com', resume_path: 'https://example.com/resumes/John_Doe_Resume.pdf' },
            { candidate_id: '2', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', resume_path: null }
          ],
          jobs: [
            { job_id: '1', title: 'Software Engineer' },
            { job_id: '2', title: 'Product Manager' }
          ],
          questions: [
            { question_id: '1', text: 'Tell me about yourself', category: 'Behavioral', tags: ['intro'] },
            { question_id: '2', text: 'What are your strengths?', category: 'Behavioral', tags: ['personal'] }
          ],
          prompts: [
            { prompt_version_id: '1', prompts: { name: 'Friendly Interviewer', purpose: 'interviewer' } },
            { prompt_version_id: '2', prompts: { name: 'Detailed Evaluator', purpose: 'evaluator' } }
          ],
          rubrics: [
            { rubric_version_id: '1', rubrics: { name: 'Technical Assessment' } },
            { rubric_version_id: '2', rubrics: { name: 'Behavioral Assessment' } }
          ],
          resumes: [
            { resume_id: '1', candidate_id: '1', name: 'John_Doe_Resume.pdf', url: 'https://example.com/resumes/John_Doe_Resume.pdf' },
            { resume_id: '2', candidate_id: '2', name: 'Jane_Smith_Resume.pdf', url: 'https://example.com/resumes/Jane_Smith_Resume.pdf' }
          ],
        })

        // Set latest prompt versions and rubrics as defaults for mock data
        setFormData(prev => ({
          ...prev,
          interviewerPrompt: { prompt_version_id: '1', prompts: { name: 'Friendly Interviewer', purpose: 'interviewer' } },
          evaluatorPrompt: { prompt_version_id: '2', prompts: { name: 'Detailed Evaluator', purpose: 'evaluator' } },
          rubric: { rubric_version_id: '2', rubrics: { name: 'Behavioral Assessment' } },
        }))
      } else {
        const [candidatesRes, jobsRes, questionsRes, promptsRes, rubricsRes] = await Promise.all([
          supabase.from('candidates').select('candidate_id, first_name, last_name, email, resume_path'),
          supabase.from('jobs').select('job_id, title'),
          supabase.from('questions').select('question_id, text, category, tags'),
          supabase.from('prompt_versions').select('prompt_version_id, prompts(name, purpose)').order('version', { ascending: false }),
          supabase.from('rubric_versions').select('rubric_version_id, rubrics(name)').order('version', { ascending: false }),
        ])

        if (candidatesRes.error) throw candidatesRes.error
        if (jobsRes.error) throw jobsRes.error
        if (questionsRes.error) throw questionsRes.error
        if (promptsRes.error) throw promptsRes.error
        if (rubricsRes.error) throw rubricsRes.error

        setData({
          candidates: candidatesRes.data,
          jobs: jobsRes.data,
          questions: questionsRes.data,
          prompts: promptsRes.data,
          rubrics: rubricsRes.data,
        })

        // Set latest prompt versions and rubrics as defaults
        const interviewerPrompt = promptsRes.data
          .filter(p => p.prompts?.purpose === 'interviewer')
          .sort((a, b) => parseInt(b.prompt_version_id) - parseInt(a.prompt_version_id))[0]
        const evaluatorPrompt = promptsRes.data
          .filter(p => p.prompts?.purpose === 'evaluator')
          .sort((a, b) => parseInt(b.prompt_version_id) - parseInt(a.prompt_version_id))[0]
        const latestRubric = rubricsRes.data
          .sort((a, b) => parseInt(b.rubric_version_id) - parseInt(a.rubric_version_id))[0]

        setFormData(prev => ({
          ...prev,
          interviewerPrompt: interviewerPrompt || null,
          evaluatorPrompt: evaluatorPrompt || null,
          rubric: latestRubric || null,
        }))
      }
    } catch (error) {
      console.error('Error fetching form data:', error)
      setToast({ message: 'Failed to load form data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleInspect = async (type, item) => {
    if (!item) return

    try {
      let content = ''
      let title = ''

      if (type === 'prompt') {
        title = `${item.prompts?.name} (${item.prompts?.purpose})`
        if (!supabase) {
          content = `Mock content for ${title}`
        } else {
          const { data, error } = await supabase
            .from('prompt_versions')
            .select('content')
            .eq('prompt_version_id', item.prompt_version_id)
            .single()

          if (error) throw error
          content = data.content
        }
      } else if (type === 'rubric') {
        title = item.rubrics?.name
        if (!supabase) {
          content = `Mock rubric JSON for ${title}`
        } else {
          const { data, error } = await supabase
            .from('rubric_versions')
            .select('rubric_json')
            .eq('rubric_version_id', item.rubric_version_id)
            .single()

          if (error) throw error
          content = JSON.stringify(data.rubric_json, null, 2)
        }
      }

      setInspectTitle(title)
      setInspectContent(content)
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
      // Mock upload
      const mockUrl = `https://example.com/resumes/${file.name}`
      setData(prev => ({
        ...prev,
        candidates: prev.candidates.map(c =>
          c.candidate_id === formData.candidate.candidate_id ? { ...c, resume_path: mockUrl } : c
        )
      }))
      setFormData(prev => ({ ...prev, resume: mockUrl, candidate: { ...prev.candidate, resume_path: mockUrl } }))
      setToast({ message: 'Resume uploaded successfully (mock)', type: 'success' })
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

      setData(prev => ({
        ...prev,
        candidates: prev.candidates.map(c =>
          c.candidate_id === formData.candidate.candidate_id ? { ...c, resume_path: publicUrl } : c
        )
      }))
      setFormData(prev => ({ ...prev, resume: publicUrl, candidate: { ...prev.candidate, resume_path: publicUrl } }))
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
      let newCandidate
      if (!supabase) {
        // Mock adding candidate
        newCandidate = {
          candidate_id: Date.now().toString(),
          ...candidateFormData
        }
        setData(prev => ({ ...prev, candidates: [...prev.candidates, newCandidate] }))
        setToast({ message: 'Candidate added successfully (mock)', type: 'success' })
      } else {
        const { data, error } = await supabase
          .from('candidates')
          .insert([candidateFormData])
          .select()

        if (error) throw error

        newCandidate = data[0]
        setData(prev => ({ ...prev, candidates: [...prev.candidates, newCandidate] }))
        setToast({ message: 'Candidate added successfully', type: 'success' })
      }
      setFormData(prev => ({ ...prev, candidate: newCandidate }))
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

  if (loading) {
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
              options={data.candidates}
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
            options={data.jobs}
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
          questions={data.questions}
          selectedQuestions={formData.questions}
          onChange={(questions) => setFormData(prev => ({ ...prev, questions }))}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SearchableDropdown
            label="Interviewer Prompt"
            options={data.prompts.filter(p => p.prompts?.purpose === 'interviewer')}
            value={formData.interviewerPrompt}
            onChange={(prompt) => setFormData(prev => ({ ...prev, interviewerPrompt: prompt }))}
            displayKey={(p) => p.prompts?.name || 'Unknown'}
            placeholder="Select interviewer prompt"
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
            options={data.prompts.filter(p => p.prompts?.purpose === 'evaluator')}
            value={formData.evaluatorPrompt}
            onChange={(prompt) => setFormData(prev => ({ ...prev, evaluatorPrompt: prompt }))}
            displayKey={(p) => p.prompts?.name || 'Unknown'}
            placeholder="Select evaluator prompt"
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
            options={data.rubrics}
            value={formData.rubric}
            onChange={(rubric) => setFormData(prev => ({ ...prev, rubric }))}
            displayKey={(r) => r.rubrics?.name || 'Unknown'}
            placeholder="Select rubric"
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

        <InterviewSummary formData={formData} data={data} />

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
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">{inspectContent}</pre>
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