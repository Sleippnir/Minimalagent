import React from 'react'

/**
 * MetricsSummary Component
 * Displays key performance metrics in a compact grid layout
 * Used in HR Dashboard for completion rate and pending reviews
 * Reusable across different dashboard roles (HR, Hiring Manager, Admin)
 *
 * Props:
 * - completionRate: number (percentage)
 * - pendingEvaluations: number
 */
const MetricsSummary = ({ completionRate, pendingEvaluations }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass-ui p-3 rounded-lg text-center">
        <div className="text-lg font-bold text-cyan-400">{completionRate || 0}%</div>
        <div className="text-xs text-gray-300">Completion Rate</div>
      </div>
      <div className="glass-ui p-3 rounded-lg text-center">
        <div className="text-lg font-bold text-yellow-400">{pendingEvaluations || 0}</div>
        <div className="text-xs text-gray-300">Pending Reviews</div>
      </div>
    </div>
  )
}

export default MetricsSummary