'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

export default function SearchFilter({ fields, onSearch, onShowAll }) {
  // Handle both array of strings (old format) and array of objects (new format)
  const normalizedFields = fields.map(f => 
    typeof f === 'string' ? { label: f, value: f.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '') } : f
  )
  
  const [searchField, setSearchField] = useState(normalizedFields[0].value)
  const [condition, setCondition] = useState('Like')
  const [value, setValue] = useState('')

  const conditions = ['Like', 'Equal']

  const handleSearch = () => {
    onSearch(searchField, condition, value)
  }

  const handleShowAll = () => {
    setValue('')
    onShowAll()
  }

  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4 bg-muted/30 rounded-lg border">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Search Field</label>
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {normalizedFields.map(field => (
                <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Condition</label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conditions.map(cond => (
                <SelectItem key={cond} value={cond}>{cond}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium">Value</label>
          <Input 
            value={value} 
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full"
            placeholder="Enter search value..."
          />
        </div>
        
        <div className="flex gap-2 items-end sm:col-span-2 lg:col-span-1">
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button variant="outline" className="border-gray-300 hover:bg-gray-50 flex-1 whitespace-nowrap" onClick={handleShowAll}>
            Show All
          </Button>
        </div>
      </div>
    </div>
  )
}
