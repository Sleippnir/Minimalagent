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
            { candidate_id: '1', first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
            { candidate_id: '2', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }
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
            { prompt_id: '1', name: 'Friendly Interviewer', purpose: 'interviewer' },
            { prompt_id: '2', name: 'Detailed Evaluator', purpose: 'evaluator' }
          ],
          rubrics: [
            { rubric_id: '1', name: 'Technical Assessment' },
            { rubric_id: '2', name: 'Behavioral Assessment' }
          ],
        })
      } else {
        const [candidatesRes, jobsRes, questionsRes, promptsRes, rubricsRes] = await Promise.all([
          supabase.from('candidates').select('candidate_id, first_name, last_name, email'),
          supabase.from('jobs').select('job_id, title'),
          supabase.from('questions').select('question_id, text, category, tags'),
          supabase.from('prompts').select('prompt_id, name, purpose'),
          supabase.from('rubrics').select('rubric_id, name'),
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
      }
    } catch (error) {
      console.error('Error fetching form data:', error)
      setToast({ message: 'Failed to load form data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!supabase) {
      setToast({ message: 'Supabase not configured - resume upload disabled', type: 'error' })
      return
    }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `resumes/${fileName}`

      const { error } = await supabase.storage
        .from('resumes')
        .upload(filePath, file)

      if (error) throw error

      setFormData(prev => ({ ...prev, resume: filePath }))
      setToast({ message: 'Resume uploaded successfully', type: 'success' })
    } catch (error) {
      console.error('Error uploading resume:', error)
      setToast({ message: 'Failed to upload resume', type: 'error' })
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
      // Generate interview_id
      const interviewId = crypto.randomUUID()

      const { data, error } = await supabase.functions.invoke('schedule-interview', {
        body: {
          interview_id: interviewId,
          candidate_id: formData.candidate.candidate_id,
          job_id: formData.job.job_id,
          resume_path: formData.resume,
          question_ids: formData.questions.map(q => q.question_id),
          interviewer_prompt_id: formData.interviewerPrompt.prompt_id,
          evaluator_prompt_id: formData.evaluatorPrompt.prompt_id,
          rubric_id: formData.rubric.rubric_id,
        }
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
          <SearchableDropdown
            label="Candidate"
            options={data.candidates}
            value={formData.candidate}
            onChange={(candidate) => setFormData(prev => ({ ...prev, candidate }))}
            displayKey={(c) => `${c.first_name} ${c.last_name} (${c.email})`}
            placeholder="Select a candidate"
          />

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
          <input
            type="file"
            accept=".pdf"
            onChange={handleResumeUpload}
            className="mt-1 block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-400 file:text-dark-blue hover:file:bg-cyan-300"
          />
          {formData.resume && <p className="mt-1 text-sm text-green-400">Uploaded: {formData.resume}</p>}
        </div>

        <QuestionManager
          questions={data.questions}
          selectedQuestions={formData.questions}
          onChange={(questions) => setFormData(prev => ({ ...prev, questions }))}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SearchableDropdown
            label="Interviewer Prompt"
            options={data.prompts.filter(p => p.purpose === 'interviewer')}
            value={formData.interviewerPrompt}
            onChange={(prompt) => setFormData(prev => ({ ...prev, interviewerPrompt: prompt }))}
            displayKey="name"
            placeholder="Select interviewer prompt"
          />

          <SearchableDropdown
            label="Evaluator Prompt"
            options={data.prompts.filter(p => p.purpose === 'evaluator')}
            value={formData.evaluatorPrompt}
            onChange={(prompt) => setFormData(prev => ({ ...prev, evaluatorPrompt: prompt }))}
            displayKey="name"
            placeholder="Select evaluator prompt"
          />

          <SearchableDropdown
            label="Evaluation Rubric"
            options={data.rubrics}
            value={formData.rubric}
            onChange={(rubric) => setFormData(prev => ({ ...prev, rubric }))}
            displayKey="name"
            placeholder="Select rubric"
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