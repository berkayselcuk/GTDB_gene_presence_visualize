'use client';

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { Upload, Database, MousePointer, Download } from 'lucide-react';
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
  onLineageClick: (level: TaxonomicLevel, category: string, range?: { start: number; end: number }) => void;
  onDomainClick: () => void;
  onWidthChange?: (width: number) => void;
  getColorScale: (level: TaxonomicLevel, categories: string[]) => d3.ScaleOrdinal<string, string>;
  rugMode?: 'binary' | 'normalized' | 'heatmap';
  onDownloadTSV?: () => void;
}

export type VisualizationCanvasHandle = {
  downloadSVG: () => void;
};

// Heatmap color anchors (wheat → red → black)
// Ranges: 1–5 (wheat→red), 5–20 (red→black), >20 saturates at black
const HEAT_MID_WHEAT = '#F5DEB3';     // start wheat
const HEAT_HIGH_RED = '#DC2626';      // mid red
const HEAT_BLACK = '#000000';         // high black
const CORE_LABEL = 'Core genes present';

// Tooltip component
interface TooltipProps {
  isVisible: boolean;
  x: number;
  y: number;
  category: string;
  count: number;
  containerWidth: number;
  containerHeight: number;
  label?: string;
}

function Tooltip({ isVisible, x, y, category, count, label }: TooltipProps) {
  if (!isVisible) return null;
  return (
    <div 
      className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg z-50 whitespace-nowrap"
      style={{ 
        left: `${x - 12}px`, 
        top: `${y + 12}px`,
        transform: 'translate(-100%, 0)'
      }}
    >
      <div className="font-semibold">{category}</div>
      <div>Count: {count.toLocaleString()}</div>
      {label ? (<div>{label}</div>) : null}
    </div>
  );
}

export const VisualizationCanvas = forwardRef<VisualizationCanvasHandle, VisualizationCanvasProps>(function VisualizationCanvas(
{
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
  onDomainClick,
  onWidthChange,
  getColorScale,
  rugMode = 'binary',
  onDownloadTSV,
}: VisualizationCanvasProps,
ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [lastSvgHeight, setLastSvgHeight] = useState(0);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const original = svgRef.current;
    const clone = original.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('version', '1.1');
    const vbWidth = containerWidth;
    const vbHeight = (lastSvgHeight && lastSvgHeight > 0) ? lastSvgHeight : (canvasRef.current ? Math.round((canvasRef.current.height || 0) / (window.devicePixelRatio || 1)) : 0);
    if (vbWidth && vbHeight) {
      clone.setAttribute('viewBox', `0 0 ${vbWidth} ${vbHeight}`);
    }
    const canvas = canvasRef.current;
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      try { img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl); } catch {}
      img.setAttribute('href', dataUrl);
      img.setAttribute('x', '0');
      img.setAttribute('y', '0');
      img.setAttribute('width', String(containerWidth));
      img.setAttribute('height', String((lastSvgHeight && lastSvgHeight > 0) ? lastSvgHeight : Math.round((canvas.height || 0) / (window.devicePixelRatio || 1)) || canvas.getBoundingClientRect().height));
      img.setAttribute('preserveAspectRatio', 'none');
      clone.insertBefore(img, clone.firstChild);
    }
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gene-visualization.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [containerWidth, lastSvgHeight]);
  const [tooltip, setTooltip] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    level: string;
    category: string;
    count: number;
    label?: string;
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

  // Extra space at the bottom to prevent tooltip clipping
  const EXTRA_BOTTOM_PADDING = 50; // adjust as desired

  // Enhanced ResizeObserver with improved responsiveness
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    const updateWidth = (newWidth: number) => {
      if (newWidth > 0 && Math.abs(newWidth - containerWidth) > 1) { // Only update if significant change
        console.log('ResizeObserver detected width change:', containerWidth, '->', newWidth);
        setContainerWidth(newWidth);
        onWidthChange?.(newWidth);
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize if available for more accurate measurements
        let newWidth: number;
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          newWidth = entry.borderBoxSize[0].inlineSize;
        } else {
          newWidth = entry.contentRect.width;
        }
        updateWidth(newWidth);
      }
    });

    resizeObserver.observe(container);

    // Also listen to window resize as a fallback
    const handleWindowResize = () => {
      const rect = container.getBoundingClientRect();
      updateWidth(rect.width);
    };
    
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [containerWidth, onWidthChange]);

  // Enhanced initial width detection with better timing
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

    // Multiple detection attempts with different timing strategies
    const timeouts: NodeJS.Timeout[] = [];
    
    // Immediate attempt
    if (!detectWidth()) {
      // Quick retry (useful for initial render)
      timeouts.push(setTimeout(() => {
        if (!detectWidth()) {
          // Medium delay (useful after DOM updates)
          timeouts.push(setTimeout(() => {
            if (!detectWidth()) {
              // Longer delay (fallback for slow rendering)
              timeouts.push(setTimeout(() => {
                detectWidth();
              }, 1000));
            }
          }, 200));
        }
      }, 50));
    }

    // Also detect width on next animation frame (good for React rendering)
    const rafId = requestAnimationFrame(() => {
      detectWidth();
    });

    return () => {
      timeouts.forEach(clearTimeout);
      cancelAnimationFrame(rafId);
    };
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

    // Constants - use consistent margins with buildLayout (tighter)
    const MARGINS = { top: 20, right: 16, bottom: 24 + EXTRA_BOTTOM_PADDING, left: 100 };
    
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

    const LEVEL_HEIGHT = 21; // ~25% smaller
    const INNER_PAD = 2;
    const RUG_HEIGHT = 10; // ~25% smaller
    const RUG_PAD = 3; // ~25% smaller
    const BASE_GAP = 15; // ~25% smaller

    // Use the color scale function passed as prop (already has pastel colors and stable mapping)

    // Set up SVG dimensions
    const totalLevels = selectedLevels.length + 1; // +1 for domain row
    const svgHeight = MARGINS.top + 
                      totalLevels * LEVEL_HEIGHT + 
                      (activeGenes.length ? BASE_GAP + activeGenes.length * (RUG_HEIGHT + RUG_PAD) : 0) + 
                      MARGINS.bottom;

    // Set SVG dimensions to use full container width
    svg.attr('width', containerWidth)
       .attr('height', svgHeight);
    
    console.log('SVG dimensions set:', { width: containerWidth, height: svgHeight });
    setLastSvgHeight(svgHeight);

    const plot = svg.append('g')
      .attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);

    // Draw lineage levels
    const assemblies = data.map(d => d.assembly);
    const counts: Record<string, Map<string, number>> = {};
    
    selectedLevels.forEach(level => {
      counts[level] = d3.rollup(data, v => v.length, d => d[level]);
    });

    // Helper to clean lineage names like p__/c__/...
    const cleanLineageName = (name: string) => name.replace(/^[a-z]__/, '');

    // Utility: pick readable text color for a given background
    const textFillForBg = (bg: string) => {
      const c = d3.color(bg);
      if (!c) return '#111827';
      const rgb = c.rgb();
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      return brightness < 130 ? '#ffffff' : '#111827';
    };

    // Draw Domain row at the top spanning all assemblies
    {
      const y = 0;
      const g = plot.append('g')
        .attr('class', 'level domain')
        .attr('transform', `translate(0,${y})`);

      const firstAsm = assemblies[0];
      const lastAsm = assemblies[assemblies.length - 1];
      const startX = coordMap.get(firstAsm) || 0;
      const endX = coordMap.get(lastAsm) || 0;
      const endW = widthMap.get(lastAsm) || 0;
      const rectWidth = endX + endW - startX;

      // Domain rectangle
      g.append('rect')
        .attr('x', startX)
        .attr('y', 0)
        .attr('width', rectWidth)
        .attr('height', LEVEL_HEIGHT - INNER_PAD)
        .attr('fill', '#e5e7eb') // light gray
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('click', () => {
          onDomainClick();
        })
        .on('mouseover', (e: MouseEvent) => {
          // Show highlight around the domain rectangle
          setHighlightedRect({
            x: startX,
            y: 0,
            width: rectWidth,
            height: LEVEL_HEIGHT - INNER_PAD,
          });
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect && e) {
            setTooltip({
              isVisible: true,
              x: e.clientX - containerRect.left,
              y: e.clientY - containerRect.top,
              level: 'domain',
              category: 'Bacteria',
              count: assemblies.length,
            });
          }
        })
        .on('mouseout', () => {
          setHighlightedRect(null);
          setTooltip(prev => ({ ...prev, isVisible: false }));
        });

      // Domain label centered if it fits
      const domainLabel = 'Bacteria';
      const approxCharWidth = 6; // px at ~10px font
      if (rectWidth - 6 > domainLabel.length * approxCharWidth) {
        g.append('text')
          .attr('x', startX + rectWidth / 2)
          .attr('y', (LEVEL_HEIGHT - INNER_PAD) / 2)
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .text(domainLabel)
          .style('font-size', '10px')
          .style('font-weight', '500')
          .style('fill', '#374151');
      }

      // Left-side level label
      g.append('text')
        .attr('x', -6)
        .attr('y', LEVEL_HEIGHT / 2)
        .attr('dy', '.35em')
        .attr('text-anchor', 'end')
        .text('domain')
        .style('font-size', '10px')
        .style('font-weight', '500')
        .style('fill', '#374151');
    }

    selectedLevels.forEach((level, i) => {
      const y = (i + 1) * LEVEL_HEIGHT; // shift down by domain row
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
          onLineageClick(level, d.cat, { start: d.start, end: d.end });
        })
        .on('mouseover', (e: MouseEvent, d) => {
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
          if (containerRect && e) {
            setTooltip({
              isVisible: true,
              x: e.clientX - containerRect.left,
              y: e.clientY - containerRect.top,
              level: level,
              category: d.cat,
              count: counts[level].get(d.cat) || 0,
            });
          }
        })
        .on('mousemove', (evt: MouseEvent) => {
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setTooltip(prev => ({
              ...prev,
              x: evt.clientX - containerRect.left,
              y: evt.clientY - containerRect.top,
            }));
          }
        })
        .on('mouseout', () => {
          setHighlightedRect(null);
          setTooltip(prev => ({ ...prev, isVisible: false }));
        });

      // Add in-rect labels for runs if the text fits
      g.selectAll('text.run-label')
        .data(runs)
        .join('text')
        .attr('class', 'run-label')
        .attr('x', d => {
          const startX = coordMap.get(assemblies[d.start]) || 0;
          const endX = coordMap.get(assemblies[d.end]) || 0;
          const endW = widthMap.get(assemblies[d.end]) || 0;
          return startX + (endX + endW - startX) / 2;
        })
        .attr('y', (LEVEL_HEIGHT - INNER_PAD) / 2)
        .attr('dy', '.35em')
        .attr('text-anchor', 'middle')
        .text(d => cleanLineageName(d.cat))
        .style('font-size', '9px')
        .style('font-weight', '500')
        .style('fill', d => textFillForBg(scale(d.cat)))
        .style('pointer-events', 'none')
        .each(function(d) {
          const startX = coordMap.get(assemblies[d.start]) || 0;
          const endX = coordMap.get(assemblies[d.end]) || 0;
          const endW = widthMap.get(assemblies[d.end]) || 0;
          const w = endX + endW - startX;
          const label = cleanLineageName(d.cat);
          const approxCharWidth = 5.5; // slightly smaller for 9px font
          const fits = w - 6 > label.length * approxCharWidth;
          d3.select(this as SVGTextElement).style('opacity', fits ? 1 : 0);
        });

      // Add level label
      g.append('text')
        .attr('x', -6)
        .attr('y', LEVEL_HEIGHT / 2)
        .attr('dy', '.35em')
        .attr('text-anchor', 'end')
        .text(level)
        .style('font-size', '10px')
        .style('font-weight', '500')
        .style('fill', '#374151');
    });

    // Keep SVG labels for gene rugs - they're not the performance bottleneck
    if (activeGenes.length > 0) {
      const rugLabels = plot.append('g').attr('class', 'rug-labels');
      const baseY = (selectedLevels.length + 1) * LEVEL_HEIGHT + BASE_GAP;

      activeGenes.forEach((gene, geneIdx) => {
        const y = baseY + geneIdx * (RUG_HEIGHT + RUG_PAD);
        
        // Add gene label (keep in SVG for easy text rendering)
        rugLabels.append('text')
          .attr('x', -6)
          .attr('y', y + RUG_HEIGHT / 2)
          .attr('dy', '.35em')
          .attr('text-anchor', 'end')
          .text(gene.replace(/_count$/, ''))
          .style('font-size', '9px')
          .style('font-weight', '500')
          .style('fill', gene.includes('-') || gene.includes('>') ? '#7c3aed' : '#374151');
      });
    }

    // Add highlight layer on top of everything
    plot.append('g').attr('class', 'highlight-layer');

      }, [data, selectedLevels, activeGenes, matrix, coordMap, widthMap, asmIndex, geneIndex, onLineageClick, getColorScale, containerWidth, onDomainClick]);

  // Separate effect for Canvas-based gene rug rendering
  useEffect(() => {
    console.log('Canvas gene rug rendering triggered:', { 
      canvasRef: !!canvasRef.current, 
      activeGenes: activeGenes.length,
      matrixExists: !!matrix,
      containerWidth 
    });
    
    if (!canvasRef.current || containerWidth <= 0) {
      console.log('Canvas early return - no canvas or width');
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Constants matching SVG version
    const MARGINS = { top: 20, right: 16, bottom: 24 + EXTRA_BOTTOM_PADDING, left: 100 }; // keep in sync with SVG
    const LEVEL_HEIGHT = 21; // ~25% smaller
    const RUG_HEIGHT = 10; // ~25% smaller
    const RUG_PAD = 3; // ~25% smaller
    const BASE_GAP = 15; // ~25% smaller

    // Calculate canvas dimensions to match SVG exactly
    const svgHeight = MARGINS.top + 
                      (selectedLevels.length + 1) * LEVEL_HEIGHT + 
                      (activeGenes.length ? BASE_GAP + activeGenes.length * (RUG_HEIGHT + RUG_PAD) : 0) + 
                      MARGINS.bottom;

    // Set canvas dimensions with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = svgHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${svgHeight}px`;
    // Reset any previous transforms before scaling
    // so repeated renders don't compound the scale
    // Then apply the DPR scale for crisp lines
    const anyContext = context as unknown as { setTransform?: (a: number, b: number, c: number, d: number, e: number, f: number) => void };
    if (typeof anyContext.setTransform === 'function') {
      anyContext.setTransform(1, 0, 0, 1, 0, 0);
    }
    context.scale(dpr, dpr);
    


    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // If there is no matrix or no active genes, we've already cleared and resized
    // the canvas, so we can stop here to ensure no stale rugs remain visible
    if (!matrix || activeGenes.length === 0) {
      return;
    }

    // Draw gene rugs using Canvas (supports binary/normalized/heatmap)
    const assemblies = data.map(d => d.assembly);
    const baseY = MARGINS.top + (selectedLevels.length + 1) * LEVEL_HEIGHT + BASE_GAP;

    // Precompute maxima per active gene (used for normalization and core heatmap)
    const geneMaxCounts: Map<string, number> = new Map();
    activeGenes.forEach((gene) => {
      let maxCount = 0;
      assemblies.forEach((assembly) => {
        const cm = countMap.get(assembly);
        const cnt = cm ? (cm[gene] || 0) : 0;
        if (cnt > maxCount) maxCount = cnt;
      });
      geneMaxCounts.set(gene, maxCount);
    });

    // draw rugs per gene
    activeGenes.forEach((gene, geneIdx) => {
      const y = baseY + geneIdx * (RUG_HEIGHT + RUG_PAD);
      const maxCount = rugMode === 'normalized' ? (geneMaxCounts.get(gene) || 0) : 0;

      assemblies.forEach((assembly) => {
        const cm = countMap.get(assembly);
        const count = cm ? (cm[gene] || 0) : 0;

        // Determine color based on rugMode
        let color: string;
        if (rugMode === 'binary') {
          color = count > 0 ? 'rgb(0,0,0)' : 'rgb(255,255,255)';
        } else if (rugMode === 'heatmap') {
          if (gene === CORE_LABEL) {
            // Core: start at 44 with three discrete colors: wheat, red, black
            if (count < 44) {
              color = 'rgb(255,255,255)';
            } else if (count === 44) {
              color = d3.rgb(HEAT_MID_WHEAT).formatRgb();
            } else if (count === 45) {
              color = d3.rgb(HEAT_HIGH_RED).formatRgb();
            } else { // 46 and above
              color = d3.rgb(HEAT_BLACK).formatRgb();
            }
          } else {
            if (count <= 0) {
              color = 'rgb(255,255,255)';
            } else if (count <= 5) {
              const t = (count - 1) / (5 - 1);
              const c1 = d3.rgb(HEAT_MID_WHEAT);
              const c2 = d3.rgb(HEAT_HIGH_RED);
              const r = Math.round(c1.r + (c2.r - c1.r) * t);
              const g = Math.round(c1.g + (c2.g - c1.g) * t);
              const b = Math.round(c1.b + (c2.b - c1.b) * t);
              color = `rgb(${r}, ${g}, ${b})`;
            } else {
              const t = (Math.min(count, 20) - 5) / (20 - 5);
              const c1 = d3.rgb(HEAT_HIGH_RED);
              const c2 = d3.rgb(HEAT_BLACK);
              const r = Math.round(c1.r + (c2.r - c1.r) * t);
              const g = Math.round(c1.g + (c2.g - c1.g) * t);
              const b = Math.round(c1.b + (c2.b - c1.b) * t);
              color = `rgb(${r}, ${g}, ${b})`;
            }
          }
        } else {
          // normalized grayscale
          let norm: number;
          if (gene === CORE_LABEL) {
            const denom = Math.max(1, maxCount - 40);
            norm = Math.min(1, Math.max(0, (count - 40) / denom));
          } else {
            norm = maxCount > 0 ? (count / maxCount) : 0;
          }
          const intensity = Math.round(255 * (1 - norm));
          color = `rgb(${intensity}, ${intensity}, ${intensity})`;
        }

        // Draw
        const x = (coordMap.get(assembly) || 0) + MARGINS.left;
        const width = widthMap.get(assembly) || 0;
        context.fillStyle = color;
        context.globalAlpha = 1.0;
        context.fillRect(x, y, width, RUG_HEIGHT);
      });
    });
    

  }, [data, selectedLevels, activeGenes, matrix, coordMap, widthMap, asmIndex, geneIndex, containerWidth, countMap, rugMode]);

  // Expose a method to download current visualization as an SVG (embedding canvas as an image)
  useImperativeHandle(ref, () => ({
    downloadSVG,
  }), [downloadSVG]);

  // Container interaction handling for gene rug tooltips
  useEffect(() => {
    if (!containerRef.current || activeGenes.length === 0) return;

    const container = containerRef.current;
    const MARGINS = { top: 20, right: 16, bottom: 24, left: 100 };
    // Match canvas rendering constants exactly to avoid row mismatches
    const LEVEL_HEIGHT = 21; // must match canvas effect
    const RUG_HEIGHT = 10;   // must match canvas effect
    const RUG_PAD = 3;       // must match canvas effect
    const BASE_GAP = 15;     // must match canvas effect

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Only handle mouse events in the gene rug area
      const baseY = MARGINS.top + (selectedLevels.length + 1) * LEVEL_HEIGHT + BASE_GAP;
      const lineageAreaMaxY = MARGINS.top + (selectedLevels.length + 1) * LEVEL_HEIGHT;
      
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
              
              // Use count strictly to determine presence for tooltip and bucket
              if (geneIndexValue !== undefined && asmIndexValue !== undefined) {
                const cm = countMap.get(assembly);
                const present = (cm ? (cm[gene] || 0) : 0) > 0;
                if (!present) continue;
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
        // Get actual count from countMap and compute bucket label for heatmap
        const assemblyData = countMap.get(hoveredAssembly);
        const actualCount = assemblyData?.[hoveredGene] || 0;
        const label: string | undefined = undefined; // continuous scale - no bucket label
        setTooltip({
          isVisible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          level: 'Gene',
          category: hoveredGene.replace(/_count$/, ''),
          count: actualCount,
          label,
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
  }, [activeGenes, matrix, data, selectedLevels, coordMap, widthMap, asmIndex, geneIndex, countMap, rugMode]);

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
          // Intentionally unused here; TSV handling is done upstream
          void (e.target?.result as string);
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
          <Button size="sm" onClick={downloadSVG}>
            Download SVG
          </Button>
          {onDownloadTSV && (
            <Button size="sm" variant="outline" onClick={onDownloadTSV}>
              <Download className="w-3 h-3 mr-1.5" />
              Download TSV
            </Button>
          )}
          {activeGenes.length > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {activeGenes.length} genes visualized
            </Badge>
          )}
        </div>
      </div>

      {/* Visualization */}
      <Card className="w-full">
        <CardContent className="p-0 w-full">
          <div 
            ref={containerRef}
            className="relative bg-white rounded-lg overflow-hidden w-full min-h-[200px] flex-1"
            style={{ maxWidth: '100%' }}
          >
            <svg 
              ref={svgRef} 
              className="w-full h-auto block min-h-[200px] max-w-full"
              style={{ background: 'transparent', width: '100%', height: 'auto' }}
            />
            <canvas 
              ref={canvasRef} 
              className="absolute top-0 left-0 max-w-full"
              style={{ width: '100%', height: 'auto', pointerEvents: 'none', maxWidth: '100%' }}
            />
            <Tooltip 
              isVisible={tooltip.isVisible}
              x={tooltip.x}
              y={tooltip.y}
              category={tooltip.category}
              count={tooltip.count}
              containerWidth={0}
              containerHeight={0}
              label={tooltip.label}
            />
          </div>
        </CardContent>
      </Card>


    </div>
  );
});