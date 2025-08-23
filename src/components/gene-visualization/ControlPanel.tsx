'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCw } from 'lucide-react'
import type { TaxonomicLevel } from '@/types/gene-visualization'

interface ControlPanelProps {
  onLoadTSV: () => void
  selectedLevels: TaxonomicLevel[]
  onSelectedLevelsChange: (levels: TaxonomicLevel[]) => void
  onResetFilter: () => void
  geneNames: string[]
  onAddDifference: (gene1: string, gene2: string, useCounts: boolean) => void
  normalizeLevel: TaxonomicLevel | '__ALL__' | null
  onNormalizeLevel: (level: TaxonomicLevel | '__ALL__' | null) => void
  onFilterAssemblies: () => void
  onFilterBySize: (level: TaxonomicLevel, threshold: number) => void
  mode: 'all' | 'display' | 'filters' | 'analysis'

  // Dataset selection
  datasetOptions: readonly string[]
  selectedDataset: string
  onDatasetChange: (dataset: string) => void
  
  // Autocomplete component
  SearchLineageInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.ReactElement
}

const allLevels: TaxonomicLevel[] = ['phylum', 'class', 'order', 'family', 'genus']

export function ControlPanel({
  onLoadTSV,
  selectedLevels,
  onSelectedLevelsChange,
  onResetFilter,
  geneNames,
  onAddDifference,
  normalizeLevel,
  onNormalizeLevel,
  onFilterAssemblies,
  onFilterBySize,
  datasetOptions,
  selectedDataset,
  onDatasetChange,
  SearchLineageInput,
}: ControlPanelProps) {
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

  const handleAddDifference = () => {
    if (diffGene1 && diffGene2 && diffGene1 !== diffGene2) {
      onAddDifference(diffGene1, diffGene2, useCounts)
    }
  }

  const handleSizeFilter = () => {
    if (sizeFilterLevel) {
      onFilterBySize(sizeFilterLevel as TaxonomicLevel, sizeThreshold)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 overflow-x-auto pb-1.5 xl:flex-nowrap w-full text-[13px]">
      {/* Choose Taxonomy */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16">
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Choose Taxonomy</span>
        <div className="flex items-center gap-1">
          <Select value={selectedDataset} onValueChange={onDatasetChange}>
            <SelectTrigger className="h-7 text-xs w-44">
              <SelectValue placeholder="Select GTDB dataset" />
            </SelectTrigger>
            <SelectContent>
              {datasetOptions.map((file) => (
                <SelectItem key={file} value={file} className="text-xs">
                  {file.replace(/\.json$/, '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Loading */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16">
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Load Data</span>
        <div className="flex items-center gap-1">
          <Button onClick={onLoadTSV} size="sm" className="h-7 text-xs px-2">Load TSV</Button>
        </div>
      </div>

      {/* Lineage Levels */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16">
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Levels to Show</span>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1">
          {(['phylum','class','order'] as TaxonomicLevel[]).map(level => (
            <label key={level} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox
                checked={selectedLevels.includes(level)}
                onCheckedChange={(checked) => handleLevelChange(level, checked as boolean)}
              />
              <span className="capitalize">{level}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {(['family','genus'] as TaxonomicLevel[]).map(level => (
            <label key={level} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox
                checked={selectedLevels.includes(level)}
                onCheckedChange={(checked) => handleLevelChange(level, checked as boolean)}
              />
              <span className="capitalize">{level}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16">
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Search</span>
        <div className="flex items-center gap-1">
          <div className="w-40">
            <SearchLineageInput
              placeholder="Search lineage"
              className="text-xs h-7 w-full"
            />
          </div>
          <Button onClick={onResetFilter} size="sm" variant="outline" className="px-2 h-7">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Gene Comparison */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16">
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Compare Genes</span>
        <div className="flex items-center gap-1">
          <Select value={diffGene1} onValueChange={setDiffGene1}>
            <SelectTrigger className="h-7 text-xs w-20">
              <SelectValue placeholder="Gene 1" />
            </SelectTrigger>
            <SelectContent>
              {geneNames.map(gene => (
                <SelectItem key={gene} value={gene}>{gene}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={diffGene2} onValueChange={setDiffGene2}>
            <SelectTrigger className="h-7 text-xs w-20">
              <SelectValue placeholder="Gene 2" />
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
          <Button onClick={handleAddDifference} size="sm" disabled={!diffGene1 || !diffGene2 || diffGene1 === diffGene2} className="h-7 text-xs px-2">
            Add
          </Button>
        </div>
      </div>

      {/* Normalize */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16"> 
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Normalize</span>
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
      </div>

      {/* Filters */}
      <div className="flex flex-col justify-between items-start gap-1 px-2.5 py-1 bg-gray-50 rounded border min-w-fit h-16"> 
        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-gray-600">Filter Genomes</span>
        <div className="flex items-center gap-1">
          <Button onClick={onFilterAssemblies} size="sm" variant="outline" className="text-xs px-2 h-7">
            All Zero
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
            className="text-xs !h-7 w-14"
            placeholder="Min"
          />
          <Button onClick={handleSizeFilter} size="sm" disabled={!sizeFilterLevel} className="h-7 text-xs px-2">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
} 