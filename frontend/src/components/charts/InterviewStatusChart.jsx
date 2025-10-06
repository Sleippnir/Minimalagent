import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const InterviewStatusChart = ({ data, height = 200, className = "" }) => {
  if (!data || data.length === 0) return null

  return (
    <div className={`glass-ui p-4 rounded-lg ${className}`}>
      <h4 className="text-sm font-medium text-cyan-400 mb-4">Interview Status</h4>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(31, 41, 55, 0.9)',
              border: '1px solid rgba(34, 197, 218, 0.2)',
              borderRadius: '8px',
              color: '#e5e7eb'
            }}
          />
          <Legend
            wrapperStyle={{ color: '#e5e7eb', fontSize: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default InterviewStatusChart