'use client'

import React from 'react'
import { useGeneVisualization } from '@/hooks/useGeneVisualization'
import { ControlPanel } from './ControlPanel'
import { GeneSelectionSidebar } from './GeneSelectionSidebar'
import { VisualizationCanvas } from './VisualizationCanvas'
import { Loader2 } from 'lucide-react'

// Loading overlay component
function LoadingOverlay({ isLoading, message }: { isLoading: boolean; message: string }) {
  if (!isLoading) return null;
  
  return (
    <div className="absolute inset-0 backdrop-blur-sm bg-white/30 loading-overlay flex items-center justify-center z-10 rounded-lg">
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-2xl flex flex-col items-center max-w-sm mx-4 border border-gray-300">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin-custom mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing...</h3>
        <p className="text-sm text-gray-600 text-center">{message}</p>
      </div>
    </div>
  );
}

export function GeneVisualization() {
  const {
    state,
    loadTSVData,
    setSelectedLevels,
    setNormalizeLevel,
    filterByLineage,
    filterBySize,
    resetFilters,
    toggleGeneSelection,
    toggleAllGenes,
    togglePresence,
    addDifferenceVisualization,
    filterAllZeroAssemblies,
    searchLineage,
    onWidthChange,
    getColorScale,
  } = useGeneVisualization()

  const handleFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.tsv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          loadTSVData(text)
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  // Calculate coverage percentages
  const inputCoverage = state.totalInput > 0 ? ((state.countMap.size / state.totalInput) * 100).toFixed(1) : '0.0'
  const gtdbCoverage = state.asmCount > 0 ? ((state.countMap.size / state.asmCount) * 100).toFixed(1) : '0.0'
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between py-2">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">Gene Presence Lineage Tool</h1>
              <p className="text-xs text-gray-500 leading-tight">Visualize gene presence & absence across GTDB taxonomic lineages</p>
            </div>
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>GTDB v214: {state.asmCount.toLocaleString()} assemblies</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>{state.selectedLevels.length} levels</span>
              </div>
              {state.totalInput > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>{state.activeGenes.length} genes active</span>
                </div>
              )}
            </div>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 lg:px-8 py-3">
        <ControlPanel
          onLoadTSV={handleFileUpload}
          selectedLevels={state.selectedLevels}
          onSelectedLevelsChange={setSelectedLevels}
          onSearch={searchLineage}
          onResetFilter={resetFilters}
          geneNames={state.geneNames}
          onAddDifference={(gene1, gene2, useCounts) => addDifferenceVisualization({ gene1, gene2, useCounts })}
          normalizeLevel={state.normalizeLevel}
          onNormalizeLevel={setNormalizeLevel}
          onFilterAssemblies={filterAllZeroAssemblies}
          onFilterBySize={filterBySize}
          mode="all"
        />
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row gap-6 h-[calc(100vh-160px)]">
          {/* Sidebar */}
          <div className="w-full lg:w-60 xl:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
              <GeneSelectionSidebar
                geneNames={state.geneNames}
                activeGenes={state.activeGenes}
                onToggleGene={toggleGeneSelection}
                onToggleAll={toggleAllGenes}
                onTogglePresence={togglePresence}
                showPresence={state.showPresence}
              />
            </div>
          </div>

          {/* Visualization Area */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col relative">
              {/* Loading Overlay - positioned relative to visualization area */}
              <LoadingOverlay isLoading={state.isLoading} message={state.loadingMessage} />
              
              <div className="p-3 flex flex-col">
                {/* Mapping Info */}
                {state.totalInput > 0 && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-blue-900">
                          Mapped {state.countMap.size.toLocaleString()} of {state.totalInput.toLocaleString()} input assemblies
                        </div>
                        <div className="text-xs text-blue-700 mt-1">
                          Coverage: {inputCoverage}% of input data • {gtdbCoverage}% of GTDB v214
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-blue-900">{inputCoverage}%</div>
                        <div className="text-xs text-blue-700">matched</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visualization */}
                <div className="w-full overflow-x-auto">
                  <VisualizationCanvas
                    data={state.raw}
                    selectedLevels={state.selectedLevels}
                    activeGenes={state.activeGenes}
                    matrix={state.matrix}
                    coordMap={state.coordMap}
                    widthMap={state.widthMap}
                    asmIndex={state.asmIndex}
                    geneIndex={state.geneIndex}
                    countMap={state.countMap}
                    onLineageClick={filterByLineage}
                    onWidthChange={onWidthChange}
                    getColorScale={getColorScale}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
} 