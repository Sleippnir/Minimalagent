import { useState } from 'react'

const SearchableDropdown = ({ label, options, value, onChange, displayKey, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(option => {
    const displayText = typeof displayKey === 'function' ? displayKey(option) : option[displayKey]
    return displayText.toLowerCase().includes(search.toLowerCase())
  })

  const handleSelect = (option) => {
    onChange(option)
    setSearch('')
    setIsOpen(false)
  }

  const displayValue = value ? (typeof displayKey === 'function' ? displayKey(value) : value[displayKey]) : ''

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-cyan-400">{label}</label>
      <div className="mt-1 relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full glass-ui border border-cyan-800 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
        >
          <span className="block truncate text-gray-300">{displayValue || placeholder}</span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full glass-ui shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-cyan-800 overflow-auto focus:outline-none sm:text-sm">
            <div className="sticky top-0 z-10 glass-ui border-b border-cyan-800">
              <input
                type="text"
                className="w-full border-0 border-b border-transparent glass-ui px-3 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-cyan-600 sm:text-sm"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {filteredOptions.map((option, index) => (
              <div
                key={index}
                onClick={() => handleSelect(option)}
                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-cyan-900 text-gray-300"
              >
                <span className="block truncate">
                  {typeof displayKey === 'function' ? displayKey(option) : option[displayKey]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchableDropdown