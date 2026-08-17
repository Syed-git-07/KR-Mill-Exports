'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calculator } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const KEYS = [
  ['C', 'sign', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', 'backspace', '='],
]

const OPERATORS = new Set(['÷', '×', '−', '+'])

function calculate(left, right, operator) {
  const a = Number(left)
  const b = Number(right)

  if (operator === '+') return a + b
  if (operator === '−') return a - b
  if (operator === '×') return a * b
  if (operator === '÷') return b === 0 ? null : a / b
  return b
}

function formatResult(value) {
  if (!Number.isFinite(value)) return 'Error'
  return String(Number(value.toPrecision(12)))
}

export default function SimpleCalculator() {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [storedValue, setStoredValue] = useState(null)
  const [operator, setOperator] = useState(null)
  const [replaceDisplay, setReplaceDisplay] = useState(false)

  const clear = useCallback(() => {
    setDisplay('0')
    setStoredValue(null)
    setOperator(null)
    setReplaceDisplay(false)
  }, [])

  const pressKey = useCallback((key) => {
    if (/^\d$/.test(key)) {
      setDisplay((current) => replaceDisplay || current === '0' || current === 'Error' ? key : `${current}${key}`)
      setReplaceDisplay(false)
      return
    }

    if (key === '.') {
      setDisplay((current) => {
        if (replaceDisplay || current === 'Error') return '0.'
        return current.includes('.') ? current : `${current}.`
      })
      setReplaceDisplay(false)
      return
    }

    if (key === 'C') {
      clear()
      return
    }

    if (key === 'backspace') {
      if (replaceDisplay) return
      setDisplay((current) => current.length > 1 ? current.slice(0, -1) : '0')
      return
    }

    if (key === 'sign') {
      setDisplay((current) => current === '0' || current === 'Error' ? current : current.startsWith('-') ? current.slice(1) : `-${current}`)
      return
    }

    if (key === '%') {
      setDisplay((current) => current === 'Error' ? current : formatResult(Number(current) / 100))
      return
    }

    if (OPERATORS.has(key)) {
      if (display === 'Error') return
      if (operator && storedValue !== null && !replaceDisplay) {
        const result = calculate(storedValue, display, operator)
        if (result === null) {
          setDisplay('Error')
          setStoredValue(null)
          setOperator(null)
          setReplaceDisplay(true)
          return
        }
        const formatted = formatResult(result)
        setDisplay(formatted)
        setStoredValue(formatted)
      } else {
        setStoredValue(display)
      }
      setOperator(key)
      setReplaceDisplay(true)
      return
    }

    if (key === '=' && operator && storedValue !== null && display !== 'Error') {
      const result = calculate(storedValue, display, operator)
      setDisplay(result === null ? 'Error' : formatResult(result))
      setStoredValue(null)
      setOperator(null)
      setReplaceDisplay(true)
    }
  }, [clear, display, operator, replaceDisplay, storedValue])

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      const keyMap = { '/': '÷', '*': '×', '-': '−', Enter: '=', Escape: null, Backspace: 'backspace' }
      const key = keyMap[event.key] ?? event.key
      if (/^\d$/.test(key) || ['.', '+', '−', '×', '÷', '=', '%', 'backspace'].includes(key)) {
        event.preventDefault()
        pressKey(key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, pressKey])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 border-blue-500 px-4 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          aria-label="Open calculator"
        >
          <Calculator className="h-5 w-5" />
          Calculator
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm gap-3 p-5" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Calculator
          </DialogTitle>
          <DialogDescription>Use the keypad or your keyboard for simple calculations.</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border bg-slate-950 px-4 py-3 text-right text-white">
          <div className="h-5 text-sm text-slate-400">{storedValue !== null && operator ? `${storedValue} ${operator}` : '\u00a0'}</div>
          <output className="block min-h-10 overflow-x-auto text-3xl font-semibold tabular-nums" aria-live="polite">
            {display}
          </output>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {KEYS.flat().map((key) => {
            const isOperator = OPERATORS.has(key) || key === '='
            const label = key === 'sign' ? '±' : key === 'backspace' ? '⌫' : key
            return (
              <Button
                key={key}
                type="button"
                variant="outline"
                className={cn(
                  'h-12 text-lg font-semibold',
                  key === '0' && 'col-span-1',
                  isOperator && 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white',
                  ['C', 'sign', '%'].includes(key) && 'bg-slate-100'
                )}
                onClick={() => pressKey(key)}
                aria-label={key === 'backspace' ? 'Backspace' : key === 'sign' ? 'Change sign' : key}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
