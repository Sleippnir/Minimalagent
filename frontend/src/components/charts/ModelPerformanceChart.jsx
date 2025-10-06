import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

// Color mapping for different AI providers
const getModelColor = (modelName) => {
  const model = modelName.toLowerCase()
  if (model.includes('gpt') || model.includes('openai')) {
    return '#06b6d4' // Cyan (OpenAI blue)
  } else if (model.includes('claude') || model.includes('anthropic')) {
    return '#f97316' // Orange (Anthropic orange)
  } else if (model.includes('gemini') || model.includes('google') || model.includes('bard')) {
    return '#10b981' // Green (Google green)
  } else if (model.includes('deepseek')) {
    return '#8b5cf6' // Purple (DeepSeek purple)
  } else if (model.includes('perplexity')) {
    return '#f59e0b' // Amber (Perplexity amber)
  } else {
    return '#6b7280' // Gray (default)
  }
}

const ModelPerformanceChart = ({ data, height = 200, className = "" }) => {
  if (!data || data.length === 0) return null

  return (
    <div className={`glass-ui p-4 rounded-lg ${className}`}>
      <h4 className="text-sm font-medium text-cyan-400 mb-4">AI Model Performance</h4>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 218, 0.1)" />
          <XAxis
            dataKey="model"
            stroke="#9ca3af"
            fontSize={10}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis stroke="#9ca3af" fontSize={10} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(31, 41, 55, 0.9)',
              border: '1px solid rgba(34, 197, 218, 0.2)',
              borderRadius: '8px',
              color: '#e5e7eb'
            }}
          />
          <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getModelColor(entry.model)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ModelPerformanceChart