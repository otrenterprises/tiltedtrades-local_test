/**
 * Tag Input Component
 * Multi-select tag input with autocomplete
 */

import React, { useState, useRef, useEffect } from 'react'
import { useJournalTags } from '../../hooks/useJournal'
import { useAuth } from '@/contexts/AuthContext'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add tags...',
  maxTags = 10
}) => {
  const { user } = useAuth()
  const userId = user?.userId || ''
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Get existing tags for suggestions
  const { data: existingTags = [] } = useJournalTags(userId)

  // Filter suggestions based on input
  // Convert existingTags to string to avoid infinite loop from array reference changes
  const existingTagsStr = existingTags.join(',')

  useEffect(() => {
    if (input.trim()) {
      const filtered = existingTags
        .filter((tag: string) =>
          tag.toLowerCase().includes(input.toLowerCase()) &&
          !tags.includes(tag)
        )
        .slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [input, existingTagsStr]) // Use string instead of array for stable dependency

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Add a tag
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (
      trimmedTag &&
      !tags.includes(trimmedTag) &&
      tags.length < maxTags
    ) {
      onChange([...tags, trimmedTag])
      setInput('')
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }

  // Remove a tag
  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        addTag(suggestions[selectedIndex])
      } else if (input.trim()) {
        addTag(input)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="relative">
      {/* Tag Display and Input */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-700 rounded-lg border border-gray-600 focus-within:border-blue-500 transition">
        {/* Existing Tags */}
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center px-3 py-1 bg-blue-600 bg-opacity-20 text-blue-400 rounded-full text-sm"
          >
            {tag}
            <button
              onClick={() => removeTag(index)}
              className="ml-2 hover:text-blue-300"
              type="button"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}

        {/* Input Field */}
        {tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            placeholder={tags.length === 0 ? placeholder : 'Add more...'}
            className="flex-1 min-w-[120px] bg-transparent text-white outline-none placeholder-gray-500"
          />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 ${
                index === selectedIndex ? 'bg-gray-700 text-white' : 'text-gray-300'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Helper Text */}
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>Press Enter to add a tag</span>
        <span>{tags.length}/{maxTags} tags</span>
      </div>
    </div>
  )
}