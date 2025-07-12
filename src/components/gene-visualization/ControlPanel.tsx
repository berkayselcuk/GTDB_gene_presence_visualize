'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Search, Settings, Filter, BarChart3, RefreshCw } from 'lucide-react'
import type { TaxonomicLevel } from '@/types/gene-visualization'

interface ControlPanelProps {
  onLoadTSV: () => void
  selectedLevels: TaxonomicLevel[]
  onSelectedLevelsChange: (levels: TaxonomicLevel[]) => void
  onSearch: (term: string) => void
  onResetFilter: () => void
  geneNames: string[]
  onAddDifference: (gene1: string, gene2: string, useCounts: boolean) => void
  normalizeLevel: TaxonomicLevel | '__ALL__' | null
  onNormalizeLevel: (level: TaxonomicLevel | '__ALL__' | null) => void
  onFilterAssemblies: () => void
  onFilterBySize: (level: TaxonomicLevel, threshold: number) => void
  mode: 'all' | 'display' | 'filters' | 'analysis'
}

const allLevels: TaxonomicLevel[] = ['phylum', 'class', 'order', 'family', 'genus']

export function ControlPanel({
  onLoadTSV,
  selectedLevels,
  onSelectedLevelsChange,
  onSearch,
  onResetFilter,
  geneNames,
  onAddDifference,
  normalizeLevel,
  onNormalizeLevel,
  onFilterAssemblies,
  onFilterBySize,
}: ControlPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [diffGene1, setDiffGene1] = useState('')
  const [diffGene2, setDiffGene2] = useState('')
  const [useCounts, setUseCounts] = useState(false)
  const [sizeFilterLevel, setSizeFilterLevel] = useState<TaxonomicLevel | ''>('')
  const [sizeThreshold, setSizeThreshold] = useState(0)

  const handleLevelChange = (level: TaxonomicLevel, checked: boolean) => {
    if (checked) {
      onSelectedLevelsChange([...selectedLevels, level])
    } else {
      onSelectedLevelsChange(selectedLevels.filter(l => l !== level))
    }
  }

  const handleSearch = () => {
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim())
    }
  }

  const handleAddDifference = () => {
    if (diffGene1 && diffGene2 && diffGene1 !== diffGene2) {
      onAddDifference(diffGene1, diffGene2, useCounts)
    }
  }

  const handleNormalize = () => {
    onNormalizeLevel(normalizeLevel)
  }

  const handleSizeFilter = () => {
    if (sizeFilterLevel) {
      onFilterBySize(sizeFilterLevel as TaxonomicLevel, sizeThreshold)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 xl:flex-nowrap w-full">
      {/* Data Loading */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded border min-w-fit">
        <Upload className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium">Load Data</span>
        <Button onClick={onLoadTSV} size="sm" className="text-xs px-2 py-1">Load TSV</Button>
      </div>

      {/* Lineage Levels */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded border min-w-fit">
        <BarChart3 className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium">Levels</span>
        <div className="flex gap-1">
          {allLevels.map(level => (
            <label key={level} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox
                checked={selectedLevels.includes(level)}
                onCheckedChange={(checked) => handleLevelChange(level, checked as boolean)}
              />
              <span className="capitalize">{level.charAt(0)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1 px-3 py-1 bg-gray-50 rounded border min-w-fit">
        <Input
          placeholder="Search lineage"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="text-xs h-7 w-32"
        />
        <Button onClick={handleSearch} size="sm" variant="outline" className="px-2 h-7">
          <Search className="w-3 h-3" />
        </Button>
        <Button onClick={onResetFilter} size="sm" variant="outline" className="px-2 h-7">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Gene Comparison */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded border min-w-fit">
        <BarChart3 className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-medium">Compare</span>
        <Select value={diffGene1} onValueChange={setDiffGene1}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="G1" />
          </SelectTrigger>
          <SelectContent>
            {geneNames.map(gene => (
              <SelectItem key={gene} value={gene}>{gene}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={diffGene2} onValueChange={setDiffGene2}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="G2" />
          </SelectTrigger>
          <SelectContent>
            {geneNames.map(gene => (
              <SelectItem key={gene} value={gene}>{gene}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1 text-xs">
          <Checkbox checked={useCounts} onCheckedChange={(checked) => setUseCounts(checked as boolean)} />
          <span>Counts</span>
        </label>
        <Button onClick={handleAddDifference} size="sm" disabled={!diffGene1 || !diffGene2 || diffGene1 === diffGene2} className="text-xs px-2 py-1">
          Add
        </Button>
      </div>

      {/* Normalize */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded border min-w-fit">
        <Settings className="w-4 h-4 text-orange-600" />
        <span className="text-sm font-medium">Normalize</span>
        <Select value={normalizeLevel || 'none'} onValueChange={(value) => onNormalizeLevel(value === 'none' ? null : value as TaxonomicLevel)}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {allLevels.map(level => (
              <SelectItem key={level} value={level} className="capitalize">{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleNormalize} size="sm" className="text-xs px-2 py-1">Apply</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded border min-w-fit"> 
        <Filter className="w-4 h-4 text-red-600" />
        <span className="text-sm font-medium">Filter</span>
        <Button onClick={onFilterAssemblies} size="sm" variant="outline" className="text-xs px-2 py-1">
          Zero
        </Button>
        <Select value={sizeFilterLevel} onValueChange={(value) => setSizeFilterLevel(value as TaxonomicLevel | '')}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {allLevels.map(level => (
              <SelectItem key={level} value={level} className="capitalize">{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={sizeThreshold}
          onChange={(e) => setSizeThreshold(+e.target.value)}
          className="text-xs h-7 w-16"
          placeholder="Min"
        />
        <Button onClick={handleSizeFilter} size="sm" disabled={!sizeFilterLevel} className="text-xs px-2 py-1">
          Apply
        </Button>
      </div>
    </div>
  );
} 