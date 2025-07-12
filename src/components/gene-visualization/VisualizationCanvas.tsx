'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Upload, Database, MousePointer, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GTDBRecord, TaxonomicLevel } from '@/types/gene-visualization';

interface VisualizationCanvasProps {
  data: GTDBRecord[];
  selectedLevels: TaxonomicLevel[];
  activeGenes: string[];
  matrix: Uint8Array | null;
  coordMap: Map<string, number>;
  widthMap: Map<string, number>;
  asmIndex: Map<string, number>;
  geneIndex: Map<string, number>;
  countMap: Map<string, Record<string, number>>;
  onLineageClick: (level: TaxonomicLevel, category: string) => void;
  onWidthChange?: (width: number) => void;
  getColorScale: (level: TaxonomicLevel, categories: string[]) => d3.ScaleOrdinal<string, string>;
}

// Tooltip component
interface TooltipProps {
  isVisible: boolean;
  x: number;
  y: number;
  level: string;
  category: string;
  count: number;
}

function Tooltip({ isVisible, x, y, level, category, count }: TooltipProps) {
  if (!isVisible) return null;
  
  return (
    <div 
      className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-20 whitespace-nowrap"
      style={{ 
        left: `${x + 12}px`, 
        top: `${y + 12}px`,
        transform: 'translate(0, -100%)' // Position above cursor
      }}
    >
      <div className="font-semibold">{category}</div>
      <div>Count: {count.toLocaleString()}</div>
    </div>
  );
}

export function VisualizationCanvas({
  data,
  selectedLevels,
  activeGenes,
  matrix,
  coordMap,
  widthMap,
  asmIndex,
  geneIndex,
  countMap,
  onLineageClick,
  onWidthChange,
  getColorScale,
}: VisualizationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [tooltip, setTooltip] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    level: string;
    category: string;
    count: number;
  }>({
    isVisible: false,
    x: 0,
    y: 0,
    level: '',
    category: '',
    count: 0,
  });

  const [highlightedRect, setHighlightedRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Resize observer to detect container width changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        console.log('ResizeObserver detected width:', newWidth);
        if (newWidth > 0 && newWidth !== containerWidth) {
          setContainerWidth(newWidth);
          onWidthChange?.(newWidth);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerWidth, onWidthChange]);

  // Initial width detection with multiple attempts
  useEffect(() => {
    const detectWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        console.log('Width detection attempt:', rect.width);
        if (rect.width > 0) {
          setContainerWidth(rect.width);
          onWidthChange?.(rect.width);
          return true;
        }
      }
      return false;
    };

    // Try immediate detection
    if (!detectWidth()) {
      // If failed, try after a delay
      const timeout1 = setTimeout(() => {
        if (!detectWidth()) {
          // If still failed, try after a longer delay
          const timeout2 = setTimeout(() => {
            detectWidth();
          }, 500);
        }
      }, 100);
    }
  }, [onWidthChange]);

  useEffect(() => {
    console.log('Visualization effect triggered:', { 
      svgRef: !!svgRef.current, 
      dataLength: data.length, 
      containerWidth,
      selectedLevels: selectedLevels.length,
      coordMapSize: coordMap.size,
      widthMapSize: widthMap.size
    });
    
    if (!svgRef.current || !data.length || containerWidth <= 0 || coordMap.size === 0 || widthMap.size === 0) {
      console.log('Early return - missing requirements:', {
        svgRef: !!svgRef.current,
        dataLength: data.length,
        containerWidth,
        coordMapSize: coordMap.size,
        widthMapSize: widthMap.size
      });
      return;
    }

    const svg = d3.select(svgRef.current);

    // Clear previous visualization
    svg.selectAll('*').remove();

    // Constants - use consistent margins with buildLayout
    const MARGINS = { top: 40, right: 20, bottom: 40, left: 140 };
    
    // Use the full container width minus only the left margin for the plot area
    // The coordMap and widthMap already account for the proper spacing
    const AVAILABLE_WIDTH = containerWidth - MARGINS.left - MARGINS.right;
    
    console.log('Available width:', AVAILABLE_WIDTH, 'Container width:', containerWidth);
    console.log('CoordMap size:', coordMap.size, 'WidthMap size:', widthMap.size);
    
    // Ensure we have reasonable available width
    if (AVAILABLE_WIDTH <= 100) {
      console.log('Available width too small:', AVAILABLE_WIDTH);
      return;
    }

    const LEVEL_HEIGHT = 28;
    const INNER_PAD = 2;
    const RUG_HEIGHT = 14;
    const RUG_PAD = 4;
    const BASE_GAP = 20;
    const GOLDEN = 0.618033988749895;

    // Use the color scale function passed as prop (already has pastel colors and stable mapping)

    // Set up SVG dimensions
    const svgHeight = MARGINS.top + 
                      selectedLevels.length * LEVEL_HEIGHT + 
                      (activeGenes.length ? BASE_GAP + activeGenes.length * (RUG_HEIGHT + RUG_PAD) : 0) + 
                      MARGINS.bottom;

    // Set SVG dimensions to use full container width
    svg.attr('width', containerWidth)
       .attr('height', svgHeight);
    
    console.log('SVG dimensions set:', { width: containerWidth, height: svgHeight });

    const plot = svg.append('g')
      .attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);

    // Draw lineage levels
    const assemblies = data.map(d => d.assembly);
    const counts: Record<string, Map<string, number>> = {};
    
    selectedLevels.forEach(level => {
      counts[level] = d3.rollup(data, v => v.length, d => d[level]);
    });

    selectedLevels.forEach((level, i) => {
      const y = i * LEVEL_HEIGHT;
      const g = plot.append('g')
        .attr('class', 'level')
        .attr('transform', `translate(0,${y})`);

      // Create runs for this level
      const runs: Array<{cat: string, start: number, end: number}> = [];
      let start = 0;
      let currentCat = data[0][level];

      for (let k = 1; k < assemblies.length; k++) {
        if (data[k][level] !== currentCat) {
          runs.push({ cat: currentCat, start, end: k - 1 });
          currentCat = data[k][level];
          start = k;
        }
      }
      runs.push({ cat: currentCat, start, end: assemblies.length - 1 });

      const scale = getColorScale(level, Array.from(counts[level].keys()));

      // Draw rectangles using full calculated coordinates
      g.selectAll('rect')
        .data(runs)
        .join('rect')
        .attr('x', d => coordMap.get(assemblies[d.start]) || 0)
        .attr('y', 0)
        .attr('width', d => {
          const startX = coordMap.get(assemblies[d.start]) || 0;
          const endX = coordMap.get(assemblies[d.end]) || 0;
          const endW = widthMap.get(assemblies[d.end]) || 0;
          return endX + endW - startX;
        })
        .attr('height', LEVEL_HEIGHT - INNER_PAD)
        .attr('fill', d => scale(d.cat))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          onLineageClick(level, d.cat);
        })
        .on('mouseover', (event, d) => {
          // Set highlight rectangle
          const startX = coordMap.get(assemblies[d.start]) || 0;
          const endX = coordMap.get(assemblies[d.end]) || 0;
          const endW = widthMap.get(assemblies[d.end]) || 0;
          const rectWidth = endX + endW - startX;
          
          setHighlightedRect({
            x: startX,
            y: y,
            width: rectWidth,
            height: LEVEL_HEIGHT - INNER_PAD,
          });
          
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setTooltip({
              isVisible: true,
              x: event.clientX - containerRect.left,
              y: event.clientY - containerRect.top,
              level: level,
              category: d.cat,
              count: counts[level].get(d.cat) || 0,
            });
          }
        })
        .on('mousemove', (event) => {
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setTooltip(prev => ({
              ...prev,
              x: event.clientX - containerRect.left,
              y: event.clientY - containerRect.top,
            }));
          }
        })
        .on('mouseout', (event) => {
          setHighlightedRect(null);
          setTooltip(prev => ({ ...prev, isVisible: false }));
        });

      // Add level label
      g.append('text')
        .attr('x', -10)
        .attr('y', LEVEL_HEIGHT / 2)
        .attr('dy', '.35em')
        .attr('text-anchor', 'end')
        .text(level)
        .style('font-size', '13px')
        .style('font-weight', '500')
        .style('fill', '#374151');
    });

    // Keep SVG labels for gene rugs - they're not the performance bottleneck
    if (activeGenes.length > 0) {
      const rugLabels = plot.append('g').attr('class', 'rug-labels');
      const baseY = selectedLevels.length * LEVEL_HEIGHT + BASE_GAP;

      activeGenes.forEach((gene, geneIdx) => {
        const y = baseY + geneIdx * (RUG_HEIGHT + RUG_PAD);
        
        // Add gene label (keep in SVG for easy text rendering)
        rugLabels.append('text')
          .attr('x', -10)
          .attr('y', y + RUG_HEIGHT / 2)
          .attr('dy', '.35em')
          .attr('text-anchor', 'end')
          .text(gene.replace(/_count$/, ''))
          .style('font-size', '12px')
          .style('font-weight', '500')
          .style('fill', gene.includes('-') || gene.includes('>') ? '#7c3aed' : '#374151');
      });
    }

    // Add highlight layer on top of everything
    plot.append('g').attr('class', 'highlight-layer');

      }, [data, selectedLevels, activeGenes, matrix, coordMap, widthMap, asmIndex, geneIndex, onLineageClick, getColorScale]);

  // Separate effect for Canvas-based gene rug rendering
  useEffect(() => {
    console.log('Canvas gene rug rendering triggered:', { 
      canvasRef: !!canvasRef.current, 
      activeGenes: activeGenes.length,
      matrixExists: !!matrix,
      containerWidth 
    });
    
    if (!canvasRef.current || !matrix || activeGenes.length === 0 || containerWidth <= 0) {
      console.log('Canvas early return - missing requirements');
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Constants matching SVG version
    const MARGINS = { top: 40, right: 20, bottom: 40, left: 140 };
    const LEVEL_HEIGHT = 28;
    const RUG_HEIGHT = 14;
    const RUG_PAD = 4;
    const BASE_GAP = 20;

    // Calculate canvas dimensions to match SVG exactly
    const svgHeight = MARGINS.top + 
                      selectedLevels.length * LEVEL_HEIGHT + 
                      (activeGenes.length ? BASE_GAP + activeGenes.length * (RUG_HEIGHT + RUG_PAD) : 0) + 
                      MARGINS.bottom;

    // Set canvas dimensions with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = svgHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${svgHeight}px`;
    context.scale(dpr, dpr);
    


    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gene rugs using Canvas
    const assemblies = data.map(d => d.assembly);
    const baseY = MARGINS.top + selectedLevels.length * LEVEL_HEIGHT + BASE_GAP;

    let totalRectangles = 0;
    activeGenes.forEach((gene, geneIdx) => {
      const y = baseY + geneIdx * (RUG_HEIGHT + RUG_PAD);
      const geneIndexValue = geneIndex.get(gene);
      
      if (geneIndexValue !== undefined) {
        // Use consistent dark color for all gene rugs
        context.fillStyle = '#1f2937';
        context.globalAlpha = 1.0;
        
        let geneRectangles = 0;
        assemblies.forEach((assembly, assemblyIdx) => {
          const asmIndexValue = asmIndex.get(assembly);
          if (asmIndexValue !== undefined && matrix[geneIndexValue * asmIndex.size + asmIndexValue]) {
            // Canvas coordinate system - need to add MARGINS.left since Canvas is absolute
            const x = (coordMap.get(assembly) || 0) + MARGINS.left;
            const width = widthMap.get(assembly) || 0;
            

            
            context.fillRect(x, y, width, RUG_HEIGHT);
            geneRectangles++;
            totalRectangles++;
          }
        });
        

        context.globalAlpha = 1.0;
      }
    });
    

  }, [data, selectedLevels, activeGenes, matrix, coordMap, widthMap, asmIndex, geneIndex, containerWidth]);

  // Container interaction handling for gene rug tooltips
  useEffect(() => {
    if (!containerRef.current || !matrix || activeGenes.length === 0) return;

    const container = containerRef.current;
    const MARGINS = { top: 40, right: 20, bottom: 40, left: 140 };
    const LEVEL_HEIGHT = 28;
    const RUG_HEIGHT = 14;
    const RUG_PAD = 4;
    const BASE_GAP = 20;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Only handle mouse events in the gene rug area
      const baseY = MARGINS.top + selectedLevels.length * LEVEL_HEIGHT + BASE_GAP;
      const lineageAreaMaxY = MARGINS.top + selectedLevels.length * LEVEL_HEIGHT;
      
      // If mouse is in lineage area, don't show gene tooltips
      if (y < lineageAreaMaxY) {
        return;
      }

      // Check if mouse is over any gene rug
      let hoveredGene: string | null = null;
      let hoveredAssembly: string | null = null;

      for (let geneIdx = 0; geneIdx < activeGenes.length; geneIdx++) {
        const gene = activeGenes[geneIdx];
        const rugY = baseY + geneIdx * (RUG_HEIGHT + RUG_PAD);
        
        if (y >= rugY && y <= rugY + RUG_HEIGHT) {
          // Mouse is over this gene's row, check which assembly
          const assemblies = data.map(d => d.assembly);
          for (const assembly of assemblies) {
            const asmX = (coordMap.get(assembly) || 0) + MARGINS.left;
            const asmWidth = widthMap.get(assembly) || 0;
            
            if (x >= asmX && x <= asmX + asmWidth) {
              const geneIndexValue = geneIndex.get(gene);
              const asmIndexValue = asmIndex.get(assembly);
              
              if (geneIndexValue !== undefined && asmIndexValue !== undefined && 
                  matrix[geneIndexValue * asmIndex.size + asmIndexValue]) {
                hoveredGene = gene;
                hoveredAssembly = assembly;
                break;
              }
            }
          }
          break;
        }
      }

      if (hoveredGene && hoveredAssembly) {
        // Get actual count from countMap
        const assemblyData = countMap.get(hoveredAssembly);
        const actualCount = assemblyData?.[hoveredGene] || 0;
        
        setTooltip({
          isVisible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          level: 'Gene',
          category: hoveredGene.replace(/_count$/, ''),
          count: actualCount,
        });
      } else {
        // Hide tooltip when not hovering over any gene
        setTooltip(prev => ({ ...prev, isVisible: false }));
      }
    };

    const handleMouseLeave = () => {
      setTooltip(prev => ({ ...prev, isVisible: false }));
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [activeGenes, matrix, data, selectedLevels, coordMap, widthMap, asmIndex, geneIndex, countMap]);

  // Separate effect to handle highlight updates
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const highlightLayer = svg.select('.highlight-layer');
    
    if (highlightLayer.empty()) return;
    
    // Clear existing highlight
    highlightLayer.selectAll('.highlight-rect').remove();
    
    // Add new highlight if needed
    if (highlightedRect) {
      highlightLayer.append('rect')
        .attr('class', 'highlight-rect')
        .attr('x', highlightedRect.x)
        .attr('y', highlightedRect.y)
        .attr('width', highlightedRect.width)
        .attr('height', highlightedRect.height)
        .attr('fill', 'none')
        .attr('stroke', '#000000')
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    }
  }, [highlightedRect]);

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tsv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          // You would need to call the loadTSVData function here
          // For now, just trigger the file input
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (!data.length) {
    return (
      <Card className="border-dashed border-2 border-gray-300">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Database className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Loaded</h3>
          <p className="text-sm text-gray-600 mb-6 text-center max-w-md">
            Upload a TSV file containing gene count data to start visualizing gene presence across GTDB taxonomic lineages
          </p>
          <Button onClick={handleFileUpload} size="lg" className="mb-4">
            <Upload className="w-5 h-5 mr-2" />
            Load TSV File
          </Button>
          <div className="text-xs text-gray-500 text-center">
            <p>Expected format: Assembly ID in first column, gene counts in subsequent columns</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visualization Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Database className="w-3 h-3" />
            {data.length.toLocaleString()} assemblies
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <MousePointer className="w-3 h-3" />
            Click blocks to filter
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          {activeGenes.length > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {activeGenes.length} genes visualized
            </Badge>
          )}
        </div>
      </div>

      {/* Visualization */}
      <Card>
        <CardContent className="p-0">
          <div 
            ref={containerRef}
            className="relative bg-white rounded-lg overflow-hidden w-full min-h-[200px]"
          >
            <svg 
              ref={svgRef} 
              className="w-full h-auto block min-h-[200px]"
              style={{ background: 'transparent', maxWidth: '100%' }}
            />
            <canvas 
              ref={canvasRef} 
              className="absolute top-0 left-0"
              style={{ width: '100%', height: 'auto', pointerEvents: 'none' }}
            />
            <Tooltip 
              isVisible={tooltip.isVisible}
              x={tooltip.x}
              y={tooltip.y}
              level={tooltip.level}
              category={tooltip.category}
              count={tooltip.count}
            />
          </div>
        </CardContent>
      </Card>


    </div>
  );
} 