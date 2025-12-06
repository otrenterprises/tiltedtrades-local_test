/**
 * Tag Input Component
 * Multi-select tag input with autocomplete and tag selection dropdown
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
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
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get existing tags for suggestions
  const { data: existingTags = [] } = useJournalTags(userId)

  // Get available tags (not already selected) filtered by input
  const availableTags = useMemo(() => {
    const notSelected = existingTags.filter((tag: string) => !tags.includes(tag))
    if (input.trim()) {
      return notSelected.filter((tag: string) =>
        tag.toLowerCase().includes(input.toLowerCase())
      )
    }
    return notSelected
  }, [existingTags, tags, input])

  // Check if input would create a new tag
  const isNewTag = useMemo(() => {
    if (!input.trim()) return false
    const normalizedInput = input.trim().toLowerCase()
    return !existingTags.some((tag: string) => tag.toLowerCase() === normalizedInput) &&
           !tags.some((tag: string) => tag.toLowerCase() === normalizedInput)
  }, [input, existingTags, tags])

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset selected index when dropdown opens or available tags change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [showDropdown, availableTags.length])

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
      setSelectedIndex(-1)
      // Keep dropdown open if there are more tags to select
      if (availableTags.length <= 1) {
        setShowDropdown(false)
      }
    }
  }

  // Remove a tag
  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  // Calculate total selectable items (available tags + new tag option if applicable)
  const totalItems = availableTags.length + (isNewTag ? 1 : 0)

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < availableTags.length) {
        addTag(availableTags[selectedIndex])
      } else if (selectedIndex === availableTags.length && isNewTag) {
        addTag(input)
      } else if (input.trim()) {
        addTag(input)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showDropdown) {
        setShowDropdown(true)
      } else {
        setSelectedIndex(prev =>
          prev < totalItems - 1 ? prev + 1 : 0
        )
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (showDropdown) {
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : totalItems - 1
        )
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setSelectedIndex(-1)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Tag Display and Input */}
      <div
        className={`flex flex-wrap items-center gap-2 p-3 bg-tertiary rounded-lg border transition cursor-text ${
          showDropdown ? 'border-blue-500' : 'border-theme'
        }`}
        onClick={() => {
          inputRef.current?.focus()
          if (tags.length < maxTags) {
            setShowDropdown(true)
          }
        }}
      >
        {/* Existing Tags */}
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center px-3 py-1 bg-blue-600 bg-opacity-20 text-blue-400 rounded-full text-sm"
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeTag(index)
              }}
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
          <div className="flex-1 flex items-center min-w-[120px]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (!showDropdown) setShowDropdown(true)
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowDropdown(true)}
              placeholder={tags.length === 0 ? placeholder : 'Add more...'}
              className="flex-1 bg-transparent text-primary outline-none placeholder-muted"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
              }}
              className="p-1 text-tertiary hover:text-secondary transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Dropdown with existing tags and new tag option */}
      {showDropdown && tags.length < maxTags && (
        <div
          ref={dropdownRef}
          className="absolute z-10 mt-1 w-full bg-secondary border border-theme rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {/* Available existing tags */}
          {availableTags.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-medium text-muted border-b border-theme">
                Existing Tags
              </div>
              {availableTags.map((tag, index) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-tertiary ${
                    index === selectedIndex ? 'bg-tertiary text-primary' : 'text-secondary'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </>
          )}

          {/* New tag option */}
          {isNewTag && (
            <>
              {availableTags.length > 0 && (
                <div className="border-t border-theme" />
              )}
              <button
                type="button"
                onClick={() => addTag(input)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-tertiary flex items-center gap-2 ${
                  selectedIndex === availableTags.length ? 'bg-tertiary text-primary' : 'text-secondary'
                }`}
              >
                <span className="text-green-400">+</span>
                Create "{input.trim()}"
              </button>
            </>
          )}

          {/* Empty state */}
          {availableTags.length === 0 && !isNewTag && (
            <div className="px-4 py-3 text-sm text-muted text-center">
              {existingTags.length === 0
                ? 'No tags yet. Type to create one.'
                : input.trim()
                  ? 'No matching tags. Press Enter to create.'
                  : 'All tags selected.'}
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>Click to select or type to create new</span>
        <span>{tags.length}/{maxTags} tags</span>
      </div>
    </div>
  )
}