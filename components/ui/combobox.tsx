"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"

interface ComboboxProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function Combobox({ options, value, onChange, placeholder, className = "" }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(value)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!input) return options
    const q = input.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, input])

  useEffect(() => {
    setInput(value)
  }, [value])

  useEffect(() => {
    if (!open) setHighlightIdx(-1)
  }, [open])

  const reposition = useCallback(() => {
    if (!open || !inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [open])

  useEffect(() => {
    reposition()
  }, [reposition])

  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)
    return () => {
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
    }
  }, [open, reposition])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function openDropdown() {
    if (options.length === 0) return
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(true)
  }

  function selectOption(opt: string) {
    setInput(opt)
    onChange(opt)
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInput(v)
    onChange(v)
    openDropdown()
    setHighlightIdx(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        openDropdown()
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightIdx((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
        break
      case "Enter":
        e.preventDefault()
        if (highlightIdx >= 0 && highlightIdx < filtered.length) {
          selectOption(filtered[highlightIdx])
        } else {
          setOpen(false)
        }
        break
      case "Escape":
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={handleInputChange}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          className="fixed z-[var(--z-dropdown)] bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt) }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                i === highlightIdx
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
