const StatCard = ({ icon, color, title, value, className = "" }) => {
  return (
    <div className={`stat-card p-5 ${className}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 bg-${color}-400 rounded-md flex items-center justify-center`}>
            <span className="text-dark-blue text-sm font-medium">{icon}</span>
          </div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-300 truncate">{title}</dt>
            <dd className={`text-lg font-medium text-${color}-400`}>{value}</dd>
          </dl>
        </div>
      </div>
    </div>
  )
}

export default StatCard