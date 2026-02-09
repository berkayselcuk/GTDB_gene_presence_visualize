import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import LineageAutocomplete from '@/components/LineageAutocomplete';
import type { 
  GTDBRecord, 
  GeneCountData, 
  VisualizationState, 
  TaxonomicLevel, 
  DifferenceOptions
} from '@/types/gene-visualization';

// List of available lineage JSON datasets shipped in the public/ folder.
// NOTE: *Do not* prefix the file names with a leading slash so that the fetch
// request is always resolved relative to the current deployment base path.
// This prevents issues when the application is hosted under a sub-path (e.g.
// GitHub Pages) where an absolute URL like "/file.json" would incorrectly
// point to the domain root.
const DATASETS = [
  'GTDB214_lineage_ordered_custom_order_36genes_alpha0.8_0.8cov.json',
  'GTDB214_lineage_ordered.json',
] as const;

// Default dataset to load on first render
const DEFAULT_DATASET = DATASETS[0];

// Optional default TSV to auto-load on first initialization (from public/)
const DEFAULT_TSV_FILENAME = 'flagellar_genes_phyletic_distribution_withIDs_Feb8_2026.tsv';

// Custom labels to show in the UI for each dataset
const DATASET_LABELS: Record<typeof DATASETS[number], string> = {
  'GTDB214_lineage_ordered_custom_order_36genes_alpha0.8_0.8cov.json': 'Flagella Phylogeny',
  'GTDB214_lineage_ordered.json': "GTDB v214",
};

// Derive available GTDB taxonomy versions from dataset filenames (e.g., GTDB214)
const TAXONOMY_VERSIONS = Array.from(
  new Set(
    DATASETS.map((f) => {
      const match = f.match(/^GTDB(\d+)/);
      return match ? match[1] : null;
    }).filter(Boolean) as string[]
  )
).sort((a, b) => Number(b) - Number(a));
const ALL_LEVELS: TaxonomicLevel[] = ['phylum', 'class', 'order', 'family', 'genus', 'species'];
const GOLDEN = 0.618033988749895;

export function useGeneVisualization() {
  const [state, setState] = useState<VisualizationState>({
    originalRaw: [],
    raw: [],
    assemblies: [],
    selectedLevels: ['phylum'],
    totalInput: 0,
    geneNames: [],
    matrix: null,
    asmCount: 0,
    countMap: new Map(),
    asmIndex: new Map(),
    geneIndex: new Map(),
    coordMap: new Map(),
    widthMap: new Map(),
    normalizeLevel: null,
    showPresence: true,
    activeGenes: [],
    isLoading: false,
    loadingMessage: '',
  });

  const [containerWidth, setContainerWidth] = useState(1200);
  // for our new autocomplete component
  const [lineageOptions, setLineageOptions] = useState<string[]>([]);
  // Keep the last imported TSV text so we can recompute rugs when taxonomy changes
  const lastTSVTextRef = useRef<string | null>(null);
  // Track the first dataset load to avoid showing a taxonomy switching overlay on initial page load
  const isFirstDatasetLoadRef = useRef<boolean>(true);

  // Visualization modes for rug rendering
  const [rugMode, setRugMode] = useState<'normalized' | 'binary' | 'heatmap'>('binary');
  const lastRugMinRef = useRef<number>(0);
  const sizeFilterStateRef = useRef<{ level: TaxonomicLevel | null; threshold: number; baseline: GTDBRecord[] | null }>({
    level: null,
    threshold: 0,
    baseline: null,
  });

  // Currently selected dataset JSON file name
  const [dataset, setDataset] = useState<typeof DATASETS[number]>(DEFAULT_DATASET);

  const colorCacheRef = useRef<{ [key: string]: d3.ScaleOrdinal<string, string> }>({});
  
  // Global color mapping to ensure consistent colors across all data changes
  const globalColorMapRef = useRef<{ [key: string]: string }>({});
  
  // Soft but visible color generator using HSL color space
  const generatePastelColor = useCallback((index: number): string => {
    const hue = (index * GOLDEN * 360) % 360; // Use golden ratio for good distribution
    const saturation = 60 + (index % 4) * 8; // Vary saturation between 60-92% for good contrast
    const lightness = 40 + (index % 3) * 8; // Vary lightness between 40-66% for visibility against white
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }, []);
  
  // Get or assign color for a specific lineage
  const getLineageColor = useCallback((lineageName: string): string => {
    if (!globalColorMapRef.current[lineageName]) {
      const existingColors = Object.keys(globalColorMapRef.current).length;
      globalColorMapRef.current[lineageName] = generatePastelColor(existingColors);
    }
    return globalColorMapRef.current[lineageName];
  }, [generatePastelColor]);

  // Load GTDB data whenever the selected dataset changes
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Show a taxonomy switching overlay only if this is not the first dataset load
        if (!isFirstDatasetLoadRef.current) {
          setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'Switching taxonomy...' }));
          // small delay so the spinner can show before we block the thread with JSON parse
          await new Promise(r => setTimeout(r, 10));
        }

        await loadGTDBData(dataset);

        // Auto-load default TSV only on the first initialization
        if (isFirstDatasetLoadRef.current && !lastTSVTextRef.current) {
          try {
            const resp = await fetch(DEFAULT_TSV_FILENAME);
            if (resp.ok) {
              const text = await resp.text();
              loadTSVData(text);
            }
          } catch (e) {
            // ignore if the TSV is missing or fails to load; manual Load TSV remains available
            console.warn('Default TSV auto-load failed:', e);
          }
        }

        // If a TSV was already loaded before, re-apply it so the user keeps their analysis context
        if (lastTSVTextRef.current) {
          loadTSVData(lastTSVTextRef.current);
        }
      } finally {
        if (!cancelled) {
          setState(prev => ({ ...prev, isLoading: false, loadingMessage: '' }));
        }
      }

      // After the first run, subsequent dataset changes are user-initiated
      isFirstDatasetLoadRef.current = false;
    };

    run();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  // Derived current taxonomy version from selected dataset
  const taxonomy = React.useMemo(() => {
    const m = dataset.match(/^GTDB(\d+)/);
    return m ? m[1] : TAXONOMY_VERSIONS[0] || '214';
  }, [dataset]);

  const onWidthChange = useCallback((width: number) => {
    console.log('Width change callback:', width);
    setContainerWidth(width);
  }, []);

  const loadGTDBData = useCallback(async (fileName: string) => {
    console.log('Loading GTDB data from', fileName);
    try {
      const response = await fetch(fileName);
      const jsonData: GTDBRecord[] = await response.json();
      console.log('GTDB data loaded:', jsonData.length, 'records');
      
      sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
      setState(prev => ({
        ...prev,
        originalRaw: jsonData,
        raw: jsonData.slice(),
        assemblies: jsonData.map(d => d.assembly),
        asmCount: jsonData.length,
        asmIndex: new Map(jsonData.map((d, i) => [d.assembly, i])),
      }));
      // derive unique lineage strings across all taxonomic levels
      const options = Array.from(
        new Set(jsonData.flatMap(d => ALL_LEVELS.map(l => d[l])))
      ).sort();
      setLineageOptions(options);
    } catch (error) {
      console.error('Error loading GTDB data:', error);
      alert('Error loading GTDB data: ' + error);
    }
  }, []);

  const loadTSVData = useCallback((tsvText: string) => {
    // Remember the latest TSV so we can re-apply it after taxonomy/dataset changes
    lastTSVTextRef.current = tsvText;
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: 'Processing TSV data...',
    }));

    // Use setTimeout to allow the loading state to update before heavy computation
    setTimeout(() => {
      setState(prev => {
        const lines = tsvText.trim().split(/\r?\n/);
        const header = lines.shift()?.split('\t') || [];
        const rows = lines.filter(Boolean);
        
        const totalInput = rows.length;
        // Identify columns by header name rather than assuming fixed positions.
        // - Assembly column is preferred by name ('assembly'); fallback to column 0.
        // - Gene columns are any header ending with '_count', regardless of where they are.
        const assemblyColIdx = Math.max(0, header.indexOf('assembly'));
        const countCols = header
          .map((name, idx) => ({ name, idx }))
          .filter(({ name, idx }) => idx !== assemblyColIdx && name.endsWith('_count'));

        const geneNames = countCols.map(c => c.name);
        const geneColIdxs = countCols.map(c => c.idx);
        const geneIndex = new Map(geneNames.map((g, i) => [g, i]));
        let matrix = new Uint8Array(geneNames.length * prev.asmCount);
        const newCountMap = new Map<string, GeneCountData>();
        
        for (let r = 0; r < rows.length; r++) {
          const cols = rows[r].split('\t');
          const asm = cols[assemblyColIdx] ?? cols[0];
          const asmIdx = prev.asmIndex.get(asm);
          if (asmIdx === undefined) continue;
          
          const cm: GeneCountData = {};
          for (let g = 0; g < geneNames.length; g++) {
            const colIdx = geneColIdxs[g];
            const raw = colIdx < cols.length ? cols[colIdx] : undefined;
            const val = Number(raw) || 0;
            cm[geneNames[g]] = val;
            if (val > 0) {
              matrix[g * prev.asmCount + asmIdx] = 1;
            }
          }
          newCountMap.set(asm, cm);
        }

        // Derive a synthetic "Core genes present" count that EXCLUDES specific auxiliary genes
        // Exclude: FlhE, FlhC, FlhD, FlgQ, FlaF, FlbT, FlgO, FlgP
        const normalizeName = (s: string) => s.replace(/_count$/, '').toLowerCase();
        const EXCLUDE_SET = new Set(['flhe','flhc','flhd','flgq','flaf','flbt','flgo','flgp']);
        const CORE_LABEL = 'Core genes present';
        let appendedCore = false;
        {
          // Compute counts per assembly across all genes NOT in EXCLUDE_SET
          const keysToCount = geneNames.filter(g => !EXCLUDE_SET.has(normalizeName(g)));
          if (keysToCount.length > 0) {
            for (const [asm, cm] of newCountMap.entries()) {
              let c = 0;
              for (const k of keysToCount) {
                if ((cm[k] || 0) > 0) c++;
              }
              cm[CORE_LABEL] = c;
            }

            // Expand matrix by one row (binary presence for core count > 0)
            const expanded = new Uint8Array((geneNames.length + 1) * prev.asmCount);
            expanded.set(matrix);
            // fill last row
            let aIndex = 0;
            for (const asm of prev.assemblies) {
              const cm = newCountMap.get(asm);
              const present = cm ? (cm[CORE_LABEL] || 0) > 0 : false;
              expanded[geneNames.length * prev.asmCount + aIndex] = present ? 1 : 0;
              aIndex++;
            }
            matrix = expanded;

            // Append to geneNames and geneIndex
            geneIndex.set(CORE_LABEL, geneNames.length);
            geneNames.push(CORE_LABEL);
            appendedCore = true;
          }
        }

        return {
          ...prev,
          totalInput,
          geneNames,
          geneIndex,
          matrix,
          countMap: newCountMap,
          isLoading: false,
          loadingMessage: '',
        };
      });
    }, 10);
  }, []);

  // Removed separate reapply effect; handled inside dataset change effect above to avoid flashes

  const getColorScale = useCallback((level: TaxonomicLevel, categories: string[]) => {
    // Stable website palette (no green), cycling per category
    const WEBSITE_CATEGORY_COLORS = ['#FCB315','#7CAEC4','#DD6030','#231F20','#7D2985','#B4B4B4'];
    const cacheKey = `${level}_${categories.slice().sort().join('_')}`;
    if (!colorCacheRef.current[cacheKey]) {
      const colors = categories.map((_, idx) => WEBSITE_CATEGORY_COLORS[idx % WEBSITE_CATEGORY_COLORS.length]);
      colorCacheRef.current[cacheKey] = d3.scaleOrdinal(categories, colors);
    }
    return colorCacheRef.current[cacheKey];
  }, []);

  // Update layout when container width changes or assemblies change
  useEffect(() => {
    if (state.assemblies.length > 0 && containerWidth > 0) {
      console.log('Layout update triggered by assemblies or width change', {
        containerWidth,
        assembliesLength: state.assemblies.length,
        coordMapSize: state.coordMap.size,
        widthMapSize: state.widthMap.size
      });
      
      setState(prev => {
        console.log('buildLayout state:', {
          assembliesLength: prev.assemblies.length,
          normalizeLevel: prev.normalizeLevel
        });
        
        if (prev.assemblies.length === 0) {
          console.log('No assemblies, skipping layout');
          return prev;
        }
        
        const coordMap = new Map<string, number>();
        const widthMap = new Map<string, number>();
        // Use consistent margins with VisualizationCanvas (smaller left margin)
        const MARGINS = { left: 100, right: 16 };
        const totalW = containerWidth - MARGINS.left - MARGINS.right;
        
        console.log('Total width calculated:', totalW, 'from containerWidth:', containerWidth);
        
        if (!prev.normalizeLevel) {
          const xBand = d3.scaleBand()
            .domain(prev.assemblies)
            .range([0, totalW])
            .paddingInner(0); // No padding for maximum width usage
          
          prev.assemblies.forEach(a => {
            coordMap.set(a, xBand(a)!);
            widthMap.set(a, xBand.bandwidth());
          });
        } else if (prev.normalizeLevel === '__ALL__') {
          const w = totalW / prev.assemblies.length;
          prev.assemblies.forEach((a, i) => {
            coordMap.set(a, i * w);
            widthMap.set(a, w);
          });
        } else {
          // Normalize by level
          const runs: Array<{ cat: string; start: number; end: number }> = [];
          const level = prev.normalizeLevel;
          let start = 0;
          let cat = prev.raw[0]?.[level] || '';
          
          for (let k = 1; k < prev.assemblies.length; k++) {
            if (prev.raw[k]?.[level] !== cat) {
              runs.push({ cat, start, end: k - 1 });
              cat = prev.raw[k]?.[level] || '';
              start = k;
            }
          }
          runs.push({ cat, start, end: prev.assemblies.length - 1 });
          
          const segW = totalW / runs.length;
          runs.forEach((run, ri) => {
            const arr = prev.assemblies.slice(run.start, run.end + 1);
            const w = segW / arr.length;
            arr.forEach((a, idx) => {
              coordMap.set(a, ri * segW + idx * w);
              widthMap.set(a, w);
            });
          });
        }
        
        console.log('Layout maps created:', {
          coordMapSize: coordMap.size,
          widthMapSize: widthMap.size,
          maxCoord: Math.max(...Array.from(coordMap.values())),
          maxWidth: Math.max(...Array.from(widthMap.values())),
          totalCalculatedWidth: totalW,
          containerWidth,
          marginsLeftRight: MARGINS.left + MARGINS.right,
          actualUsableWidth: totalW
        });
        
        console.log('buildLayout completed:', {
          coordMapSize: coordMap.size,
          widthMapSize: widthMap.size,
          totalW,
          containerWidth
        });
        
        return {
          ...prev,
          coordMap,
          widthMap,
        };
      });
    }
  }, [containerWidth, state.assemblies.length, state.normalizeLevel]);

  const setSelectedLevels = useCallback((levels: TaxonomicLevel[]) => {
    setState(prev => ({
      ...prev,
      selectedLevels: levels.length > 0 ? levels : ['phylum'],
    }));
  }, []);

  const setNormalizeLevel = useCallback((level: TaxonomicLevel | '__ALL__' | null) => {
    setState(prev => ({
      ...prev,
      normalizeLevel: level,
    }));
    // Remove immediate buildLayout call - let useEffect handle it
  }, []);

  const filterByLineage = useCallback((level: TaxonomicLevel, category: string, range?: { start: number; end: number }) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Filtering by ${level}: ${category}...`,
    }));

    setTimeout(() => {
      sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
      setState(prev => {
        // For parity with newer behavior, a run range may be provided, but since the dataset has no NAs,
        // we simply filter by category from the full dataset.
        const filtered = prev.originalRaw.filter(d => d[level] === category);
        return {
          ...prev,
          raw: filtered,
          assemblies: filtered.map(d => d.assembly),
          isLoading: false,
          loadingMessage: '',
        };
      });
      // Remove immediate buildLayout call - let useEffect handle it
    }, 10);
  }, []);

  const filterBySize = useCallback((level: TaxonomicLevel, threshold: number) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Filtering by ${level} size (min: ${threshold})...`,
    }));

    setTimeout(() => {
      setState(prev => {
        const tracker = sizeFilterStateRef.current;
        const sameLevel = tracker.level === level;
        const baselineDefined = !!tracker.baseline;
        const isLoosening = sameLevel && threshold < tracker.threshold;

        if (!sameLevel || !baselineDefined) {
          tracker.baseline = prev.raw;
        }

        const baseline = (isLoosening && tracker.baseline) ? tracker.baseline : prev.raw;
        const counts = d3.rollup(baseline, v => v.length, d => d[level]);
        const filtered = baseline.filter(d => (counts.get(d[level]) || 0) >= threshold);

        if (threshold <= 0) {
          sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
        } else {
          sizeFilterStateRef.current = {
            level,
            threshold,
            baseline: (!sameLevel || !baselineDefined) ? baseline : tracker.baseline,
          };
        }

        return {
          ...prev,
          raw: filtered,
          assemblies: filtered.map(d => d.assembly),
          isLoading: false,
          loadingMessage: '',
        };
      });
      // Remove immediate buildLayout call - let useEffect handle it
    }, 10);
  }, []);

  // Filter assemblies by requiring that at least one rug (gene row) has count >= min
  // If the new min is lower than the last applied min, we start from the original dataset;
  // if it is higher, we filter the current dataset for efficiency, per user request.
  const filterByRugMin = useCallback((min: number, rugKey: string | 'ANY' = 'ANY') => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Filtering assemblies by ${rugKey === 'ANY' ? 'any rug' : rugKey} ≥ ${min}...`,
    }));

    setTimeout(() => {
      sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
      setState(prev => {
        const baseline = min < lastRugMinRef.current ? prev.originalRaw : prev.raw;
        const keys = rugKey === 'ANY'
          ? (prev.activeGenes.length > 0 ? prev.activeGenes : prev.geneNames)
          : [rugKey];
        const filtered = baseline.filter(d => {
          const cm = prev.countMap.get(d.assembly);
          if (!cm) return false;
          for (const k of keys) {
            if ((cm[k] || 0) >= min) return true;
          }
          return false;
        });
        lastRugMinRef.current = min;
        return {
          ...prev,
          raw: filtered,
          assemblies: filtered.map(d => d.assembly),
          isLoading: false,
          loadingMessage: '',
        };
      });
    }, 10);
  }, []);

  const resetFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: 'Resetting filters...',
    }));

    setTimeout(() => {
      sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
      setState(prev => ({
        ...prev,
        raw: prev.originalRaw.slice(),
        assemblies: prev.originalRaw.map(d => d.assembly),
        isLoading: false,
        loadingMessage: '',
      }));
      // Remove immediate buildLayout call - let useEffect handle it
    }, 10);
  }, []);

  const toggleGeneSelection = useCallback((gene: string) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Processing gene selection...`,
    }));

    // Use setTimeout to allow the loading state to update before heavy computation
    setTimeout(() => {
      setState(prev => {
        const isActive = prev.activeGenes.includes(gene);
        const activeGenes = isActive 
          ? prev.activeGenes.filter(g => g !== gene)
          : [...prev.activeGenes, gene];
        
        return {
          ...prev,
          activeGenes,
          isLoading: false,
          loadingMessage: '',
        };
      });
    }, 10);
  }, []);

  const toggleAllGenes = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Processing ${prev.activeGenes.length > 0 ? 'deselection' : 'selection'} of all genes...`,
    }));

    // Use setTimeout to allow the loading state to update before heavy computation
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        activeGenes: prev.activeGenes.length > 0 ? [] : prev.geneNames.slice(),
        isLoading: false,
        loadingMessage: '',
      }));
    }, 10);
  }, []);

  const togglePresence = useCallback(() => {
    setState(prev => {
      if (!prev.matrix) return prev;
      
      const newMatrix = new Uint8Array(prev.matrix.length);
      for (let i = 0; i < prev.matrix.length; i++) {
        newMatrix[i] = prev.matrix[i] ? 0 : 1;
      }
      
      return {
        ...prev,
        matrix: newMatrix,
        showPresence: !prev.showPresence,
      };
    });
  }, []);

  const addDifferenceVisualization = useCallback((options: DifferenceOptions) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Creating gene comparison visualization...`,
    }));

    // Use setTimeout to allow the loading state to update before heavy computation
    setTimeout(() => {
      setState(prev => {
        const { gene1, gene2, useCounts } = options;
        if (!gene1 || !gene2 || gene1 === gene2) {
          return {
            ...prev,
            isLoading: false,
            loadingMessage: '',
          };
        }
        
        const oldN = prev.geneNames.length;
        const label = (a: string, b: string) => 
          `${a.replace(/_count$/, '')}${useCounts ? '>' : '-'}${b.replace(/_count$/, '')}`;
        
        const name1 = label(gene1, gene2);
        const name2 = label(gene2, gene1);
        
        const newGeneNames = [...prev.geneNames, name1, name2];
        const newGeneIndex = new Map(prev.geneIndex);
        newGeneIndex.set(name1, oldN);
        newGeneIndex.set(name2, oldN + 1);
        
        const newMatrix = new Uint8Array(newGeneNames.length * prev.asmCount);
        newMatrix.set(prev.matrix || new Uint8Array(0));
        
        const newCountMap = new Map(prev.countMap);
        
        prev.assemblies.forEach(a => {
          const ai = prev.asmIndex.get(a);
          if (ai === undefined) return;
          
          const cm = newCountMap.get(a) || {};
          const c1 = cm[gene1] || 0;
          const c2 = cm[gene2] || 0;
          
          const p1 = useCounts ? (c1 > c2) : (c1 > 0 && c2 === 0);
          const p2 = useCounts ? (c2 > c1) : (c2 > 0 && c1 === 0);
          
          newMatrix[oldN * prev.asmCount + ai] = p1 ? 1 : 0;
          newMatrix[(oldN + 1) * prev.asmCount + ai] = p2 ? 1 : 0;
          
          cm[name1] = p1 ? 1 : 0;
          cm[name2] = p2 ? 1 : 0;
          newCountMap.set(a, cm);
        });
        
        return {
          ...prev,
          geneNames: newGeneNames,
          geneIndex: newGeneIndex,
          matrix: newMatrix,
          countMap: newCountMap,
          activeGenes: [...prev.activeGenes, name1, name2],
          isLoading: false,
          loadingMessage: '',
        };
      });
    }, 10);
  }, []);

  const filterAllZeroAssemblies = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: 'Filtering zero assemblies...',
    }));

    setTimeout(() => {
      sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
      setState(prev => {
        const filtered = prev.raw.filter(d => {
          const cm = prev.countMap.get(d.assembly);
          return cm && Object.values(cm).some(c => c > 0);
        });
        
        return {
          ...prev,
          raw: filtered,
          assemblies: filtered.map(d => d.assembly),
          isLoading: false,
          loadingMessage: '',
        };
      });
      // Remove immediate buildLayout call - let useEffect handle it
    }, 10);
  }, []);

  const searchLineage = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;
    
    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingMessage: `Searching for lineage: ${searchTerm}...`,
    }));

    setTimeout(() => {
      sizeFilterStateRef.current = { level: null, threshold: 0, baseline: null };
      setState(prev => {
        const level = ALL_LEVELS.find(l => 
          prev.originalRaw.some(d => d[l] === searchTerm)
        );
        
        if (!level) {
          alert('No lineage: ' + searchTerm);
          return {
            ...prev,
            isLoading: false,
            loadingMessage: '',
          };
        }
        
        // Search should also filter from the full dataset to provide complete context
        const filtered = prev.originalRaw.filter(d => d[level] === searchTerm);
        return {
          ...prev,
          raw: filtered,
          assemblies: filtered.map(d => d.assembly),
          isLoading: false,
          loadingMessage: '',
        };
      });
      // Remove immediate buildLayout call - let useEffect handle it
    }, 10);
  }, []);

  return {
    state,
    lineageOptions,            // expose for consumption
    loadTSVData,
    setSelectedLevels,
    setNormalizeLevel,
    filterByLineage,
    filterBySize,
    filterByRugMin,
    resetFilters,
    toggleGeneSelection,
    toggleAllGenes,
    togglePresence,
    addDifferenceVisualization,
    filterAllZeroAssemblies,
    searchLineage,
    /** A ready‑made React input you can drop into your JSX */
    SearchLineageInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => 
      React.createElement(LineageAutocomplete, {
        suggestions: lineageOptions,
        onSelect: (value: string) => searchLineage(value),
        placeholder: props.placeholder
      }),
    onWidthChange,
    getColorScale,
    dataset,
    // Expose all datasets; UI can filter/group by taxonomy
    datasets: [...DATASETS] as Array<typeof DATASETS[number]>,
    datasetLabels: DATASET_LABELS,
    setDataset,
    taxonomy,
    rugMode,
    setRugMode,
  };
} 