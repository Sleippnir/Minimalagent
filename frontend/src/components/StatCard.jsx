const COLOR_MAP = {
  cyan: { bg: 'bg-cyan-400', text: 'text-cyan-400' },
  yellow: { bg: 'bg-yellow-400', text: 'text-yellow-400' },
  blue: { bg: 'bg-blue-400', text: 'text-blue-400' },
  green: { bg: 'bg-green-400', text: 'text-green-400' },
  purple: { bg: 'bg-purple-400', text: 'text-purple-400' },
  orange: { bg: 'bg-orange-400', text: 'text-orange-400' },
  red: { bg: 'bg-red-400', text: 'text-red-400' },
  gray: { bg: 'bg-gray-400', text: 'text-gray-400' },
}

const StatCard = ({ icon, color, title, value, className = "" }) => {
  const resolvedColors = COLOR_MAP[color] || COLOR_MAP.gray

  return (
    <div className={`stat-card p-5 ${className}`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 ${resolvedColors.bg} rounded-md flex items-center justify-center`}>
            <span className="text-dark-blue text-sm font-medium">{icon}</span>
          </div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-300 truncate">{title}</dt>
            <dd className={`text-lg font-medium ${resolvedColors.text}`}>{value}</dd>
          </dl>
        </div>
      </div>
    </div>
  )
}

export default StatCard
