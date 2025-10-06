const RecentInterviews = ({ interviews, className = "" }) => {
  if (!interviews || interviews.length === 0) {
    return (
      <div className={`table-container overflow-hidden sm:rounded-md ${className}`}>
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-cyan-400">Recent Interviews</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-300">No recent interviews found</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`table-container overflow-hidden sm:rounded-md ${className}`}>
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-cyan-400">Recent Interviews</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-300">Latest interview activities</p>
      </div>
      <ul className="divide-y divide-cyan-800">
        {interviews.map((interview) => (
          <li key={interview.interview_id} className="table-row px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10">
                  <div className="h-10 w-10 rounded-full bg-cyan-400 flex items-center justify-center">
                    <span className="text-dark-blue text-sm font-medium">
                      {interview.applications?.candidates?.first_name?.[0]}{interview.applications?.candidates?.last_name?.[0]}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-cyan-400">
                    {interview.applications?.candidates?.first_name} {interview.applications?.candidates?.last_name}
                  </div>
                  <div className="text-sm text-gray-300">
                    {interview.applications?.jobs?.title}
                  </div>
                  <div className="text-xs text-gray-400">
                    Created: {interview.created_at ? new Date(interview.created_at).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Interviewer Prompt: {interview.interviewer_prompt_version?.prompt?.name || 'None'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Evaluator Prompt: {interview.evaluator_prompt_version?.prompt?.name || 'None'}
                  </div>
                  <div className="text-xs text-gray-400">
                    Rubric: {interview.rubric_version?.rubric?.name || 'None'}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  interview.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                  interview.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  interview.status === 'evaluated' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {interview.status}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RecentInterviews