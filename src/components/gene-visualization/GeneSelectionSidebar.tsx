'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
    <div className="flex flex-col">
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
            className="flex items-center gap-0.5 text-xs h-7 px-1"
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
            className="flex items-center gap-1 text-xs h-7 px-2"
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
      <CardContent className="pt-0 px-3 pb-3">
        <div className="space-y-3 flex flex-col">
          {/* Regular Genes */}
          <div>
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
            
            <Card className="border-gray-200">
              <CardContent className="p-0">
                {regularGenes.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Dna className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium mb-1">No genes available</p>
                    <p className="text-xs">Load a TSV file to see genes</p>
                  </div>
                ) : (
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
                    <p className="text-xs">Use the &#34;Gene Comparison&#34; controls above</p>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </div>
  )
} 