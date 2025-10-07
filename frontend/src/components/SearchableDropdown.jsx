import { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

const SearchableDropdown = ({ label, options, value, onChange, displayKey, placeholder, extraButton }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)

  const filteredOptions = options.filter(option => {
    const displayText = typeof displayKey === 'function' ? displayKey(option) : option[displayKey]
    return displayText?.toLowerCase().includes(search.toLowerCase())
  })

  const handleSelect = (option) => {
    onChange(option)
    setSearch('')
    setIsOpen(false)
  }

  const handleInputChange = (e) => {
    setSearch(e.target.value)
    setIsOpen(true)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleInputBlur = () => {
    // Delay closing to allow click on options
    setTimeout(() => setIsOpen(false), 150)
  }

  const displayValue = value ? ((typeof displayKey === 'function' ? displayKey(value) : value[displayKey]) ?? '') : ''

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-cyan-400">{label}</label>
        {extraButton}
      </div>
      <div className="mt-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="cursor-pointer w-full glass-ui border border-cyan-800 rounded-md shadow-sm px-3 py-2 text-left focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm text-gray-300"
        />
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full glass-ui shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-cyan-800 overflow-auto focus:outline-none sm:text-sm">
            {filteredOptions.length === 0 ? (
              <div className="py-2 pl-3 pr-9 text-gray-500 italic">
                No results found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={index}
                  onMouseDown={() => handleSelect(option)}
                  className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-cyan-900 text-gray-300"
                >
                  <span className="block truncate">
                    {typeof displayKey === 'function' ? displayKey(option) : option[displayKey]}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

SearchableDropdown.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.string])).isRequired,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  displayKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,
  placeholder: PropTypes.string,
  extraButton: PropTypes.node
}

export default SearchableDropdown
