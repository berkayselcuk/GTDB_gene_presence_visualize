'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { EyeOff, Eye, CheckSquare, Square, Dna, GitCompare } from 'lucide-react'

interface GeneSelectionSidebarProps {
  geneNames: string[]
  activeGenes: string[]
  onToggleGene: (gene: string) => void
  onToggleAll: () => void
  onTogglePresence: () => void
  showPresence: boolean
}

export function GeneSelectionSidebar({
  geneNames,
  activeGenes,
  onToggleGene,
  onToggleAll,
  onTogglePresence,
  showPresence,
}: GeneSelectionSidebarProps) {
  const regularGenes = geneNames.filter(gene => !gene.includes('>') && !gene.includes('-'))
  const differenceGenes = geneNames.filter(gene => gene.includes('>') || gene.includes('-'))
  const activeRegularGenes = activeGenes.filter(gene => !gene.includes('>') && !gene.includes('-'))
  const activeDifferenceGenes = activeGenes.filter(gene => gene.includes('>') || gene.includes('-'))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-1 px-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Dna className="w-5 h-5 text-blue-600" />
          Gene Selection
        </CardTitle>
        <div className="flex flex-wrap gap-1 mt-1">
          <Button
            onClick={onToggleAll}
            size="sm"
            variant="outline"
            className="flex items-center gap-1 text-xs px-2 py-1"
          >
            {activeGenes.length === 0 ? (
              <>
                <CheckSquare className="w-3 h-3" />
                Select All
              </>
            ) : (
              <>
                <Square className="w-3 h-3" />
                Deselect All
              </>
            )}
          </Button>
          <Button
            onClick={onTogglePresence}
            size="sm"
            variant="outline"
            className="flex items-center gap-1 text-xs px-2 py-1"
          >
            {showPresence ? (
              <>
                <EyeOff className="w-3 h-3" />
                Show Absence
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                Show Presence
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex-1 pt-0 overflow-hidden px-3 pb-3">
        <div className="space-y-3 h-full flex flex-col">
          {/* Regular Genes */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                <Dna className="w-4 h-4 text-gray-600" />
                Genes
              </h3>
              <div className="flex items-center gap-2">
                {regularGenes.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {regularGenes.length} total
                  </Badge>
                )}
                {activeRegularGenes.length > 0 && (
                  <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                    {activeRegularGenes.length} active
                  </Badge>
                )}
              </div>
            </div>
            
            <Card className="border-gray-200 h-full flex flex-col">
              <CardContent className="p-0 flex-1 overflow-hidden">
                {regularGenes.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Dna className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium mb-1">No genes available</p>
                    <p className="text-xs">Load a TSV file to see genes</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-2 grid grid-cols-2 gap-1">
                      {regularGenes.map((gene) => (
                        <label 
                          key={gene} 
                          className="flex items-center space-x-1 p-1 rounded hover:bg-gray-50 cursor-pointer group"
                        >
                          <Checkbox
                            checked={activeGenes.includes(gene)}
                            onCheckedChange={() => onToggleGene(gene)}
                          />
                          <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900 flex-1 truncate">
                            {gene.replace(/_count$/, '')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Separator */}
          <Separator className="my-2" />

          {/* Difference Genes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-purple-600" />
                Comparisons
              </h3>
              <div className="flex items-center gap-2">
                {differenceGenes.length > 0 && (
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                    {differenceGenes.length} total
                  </Badge>
                )}
                {activeDifferenceGenes.length > 0 && (
                  <Badge variant="default" className="text-xs bg-purple-100 text-purple-800">
                    {activeDifferenceGenes.length} active
                  </Badge>
                )}
              </div>
            </div>
            
            <Card className="border-purple-200">
              <CardContent className="p-0">
                {differenceGenes.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <GitCompare className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-medium mb-1">No comparisons created</p>
                    <p className="text-xs">Use the "Gene Comparison" controls above</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full max-h-40">
                    <div className="p-2 grid grid-cols-2 gap-1">
                      {differenceGenes.map((gene) => (
                        <label 
                          key={gene} 
                          className="flex items-center space-x-1 p-1 rounded hover:bg-purple-50 cursor-pointer group"
                        >
                          <Checkbox
                            checked={activeGenes.includes(gene)}
                            onCheckedChange={() => onToggleGene(gene)}
                          />
                          <span className="text-xs font-medium text-purple-700 group-hover:text-purple-900 flex-1 truncate">
                            {gene}
                          </span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          {activeGenes.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-900">
                      {activeGenes.length} genes selected
                    </p>
                    <p className="text-xs text-blue-700">
                      {activeRegularGenes.length} genes • {activeDifferenceGenes.length} comparisons
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-900">
                      {((activeGenes.length / Math.max(geneNames.length, 1)) * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-blue-700">of total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </div>
  )
} 