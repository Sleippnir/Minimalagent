import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const WeeklyActivityChart = ({ data, height = 150, className = "" }) => {
  if (!data || data.length === 0) return null

  return (
    <div className={`glass-ui p-4 rounded-lg ${className}`}>
      <h4 className="text-sm font-medium text-cyan-400 mb-4">Weekly Activity</h4>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 218, 0.1)" />
          <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} />
          <YAxis stroke="#9ca3af" fontSize={10} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(31, 41, 55, 0.9)',
              border: '1px solid rgba(34, 197, 218, 0.2)',
              borderRadius: '8px',
              color: '#e5e7eb'
            }}
          />
          <Line
            type="monotone"
            dataKey="interviews"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="evaluations"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default WeeklyActivityChart