import * as d3 from 'd3';
import { Assembly, GeneData, ProcessedData, CoordinateMap, LineageLevel } from '@/types/gene-visualization';

export const VISUALIZATION_CONFIG = {
  fixedWidth: 1500,
  margins: { top: 32, right: 16, bottom: 32, left: 120 },
  levelHeight: 24,
  innerPad: 1,
  rugHeight: 12,
  rugPad: 6,
  baseGap: 10,
  golden: 0.618033988749895,
};

export class DataProcessor {
  private originalData: Assembly[] = [];
  private processedData: ProcessedData = {
    assemblies: [],
    geneNames: [],
    matrix: [],
    countMap: new Map(),
    asmIndex: new Map(),
    geneIndex: new Map(),
  };

  async loadJsonData(jsonUrl: string): Promise<Assembly[]> {
    try {
      const response = await fetch(jsonUrl);
      const data = await response.json();
      this.originalData = data;
      return data;
    } catch (error) {
      console.error('Error loading JSON data:', error);
      throw new Error('Failed to load JSON data');
    }
  }

  processTsvData(tsvContent: string): ProcessedData {
    const lines = tsvContent.trim().split('\n');
    const headers = lines[0].split('\t');
    
    // Extract gene names (skip first column which is assembly)
    const geneNames = headers.slice(1);
    
    const countMap = new Map<string, GeneData>();
    const asmIndex = new Map<string, number>();
    const geneIndex = new Map<string, number>();
    
    // Build gene index
    geneNames.forEach((gene, index) => {
      geneIndex.set(gene, index);
    });
    
    // Process data rows
    let validAssemblies = 0;
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      const assembly = parts[0];
      
      if (assembly) {
        const geneData: GeneData = {};
        for (let j = 1; j < parts.length; j++) {
          const geneName = headers[j];
          const count = parseInt(parts[j] || '0', 10);
          geneData[geneName] = count;
        }
        
        countMap.set(assembly, geneData);
        asmIndex.set(assembly, validAssemblies);
        validAssemblies++;
      }
    }
    
    // Filter assemblies that exist in both datasets
    const filteredAssemblies = this.originalData.filter(asm => 
      countMap.has(asm.assembly)
    );
    
    // Create matrix
    const matrix: number[][] = [];
    for (let i = 0; i < geneNames.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < filteredAssemblies.length; j++) {
        const assembly = filteredAssemblies[j].assembly;
        const geneData = countMap.get(assembly);
        const count = geneData?.[geneNames[i]] || 0;
        row.push(count > 0 ? 1 : 0);
      }
      matrix.push(row);
    }
    
    this.processedData = {
      assemblies: filteredAssemblies,
      geneNames,
      matrix,
      countMap,
      asmIndex,
      geneIndex,
    };
    
    return this.processedData;
  }

  getProcessedData(): ProcessedData {
    return this.processedData;
  }

  filterByLineageSearch(data: Assembly[], level: LineageLevel, searchTerm: string): Assembly[] {
    if (!searchTerm) return data;
    
    return data.filter(assembly => {
      const value = assembly[level];
      return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  }

  filterByLineageSize(data: Assembly[], level: LineageLevel, threshold: number): Assembly[] {
    if (threshold <= 0) return data;
    
    const counts = d3.rollup(data, v => v.length, d => d[level]);
    return data.filter(assembly => {
      const count = counts.get(assembly[level]);
      return count && count >= threshold;
    });
  }

  filterAssembliesWithZeroCounts(data: Assembly[], countMap: Map<string, GeneData>): Assembly[] {
    return data.filter(assembly => {
      const geneData = countMap.get(assembly.assembly);
      return geneData && Object.values(geneData).some(count => count > 0);
    });
  }

  buildLayout(assemblies: Assembly[], normalizeLevel: string | null): CoordinateMap {
    const coordMap = new Map<string, number>();
    const widthMap = new Map<string, number>();
    const totalWidth = VISUALIZATION_CONFIG.fixedWidth - 
      VISUALIZATION_CONFIG.margins.left - VISUALIZATION_CONFIG.margins.right;

    if (!normalizeLevel) {
      const xBand = d3.scaleBand()
        .domain(assemblies.map(a => a.assembly))
        .range([0, totalWidth])
        .paddingInner(0);

      assemblies.forEach(assembly => {
        coordMap.set(assembly.assembly, xBand(assembly.assembly) || 0);
        widthMap.set(assembly.assembly, xBand.bandwidth());
      });
    } else if (normalizeLevel === '__ALL__') {
      const width = totalWidth / assemblies.length;
      assemblies.forEach((assembly, index) => {
        coordMap.set(assembly.assembly, index * width);
        widthMap.set(assembly.assembly, width);
      });
    } else {
      // Normalize by lineage level
      const runs: Array<{ cat: string; start: number; end: number }> = [];
      let start = 0;
      let currentCat = assemblies[0][normalizeLevel as keyof Assembly] as string;
      
      for (let i = 1; i < assemblies.length; i++) {
        const cat = assemblies[i][normalizeLevel as keyof Assembly] as string;
        if (cat !== currentCat) {
          runs.push({ cat: currentCat, start, end: i - 1 });
          currentCat = cat;
          start = i;
        }
      }
      runs.push({ cat: currentCat, start, end: assemblies.length - 1 });
      
      const segmentWidth = totalWidth / runs.length;
      runs.forEach((run, index) => {
        const segmentAssemblies = assemblies.slice(run.start, run.end + 1);
        const width = segmentWidth / segmentAssemblies.length;
        
        segmentAssemblies.forEach((assembly, subIndex) => {
          coordMap.set(assembly.assembly, index * segmentWidth + subIndex * width);
          widthMap.set(assembly.assembly, width);
        });
      });
    }

    return { coordMap, widthMap };
  }

  createDifferenceMatrix(
    gene1: string, 
    gene2: string, 
    useCounts: boolean, 
    assemblies: Assembly[], 
    countMap: Map<string, GeneData>
  ): number[] {
    const row: number[] = [];
    
    for (const assembly of assemblies) {
      const geneData = countMap.get(assembly.assembly);
      if (!geneData) {
        row.push(0);
        continue;
      }
      
      const count1 = geneData[gene1] || 0;
      const count2 = geneData[gene2] || 0;
      
      if (useCounts) {
        row.push(count1 - count2);
      } else {
        const present1 = count1 > 0 ? 1 : 0;
        const present2 = count2 > 0 ? 1 : 0;
        row.push(present1 - present2);
      }
    }
    
    return row;
  }

  getColorScale(level: LineageLevel, categories: string[]): d3.ScaleOrdinal<string, string> {
    return d3.scaleOrdinal<string, string>()
      .domain(categories)
      .range(categories.map((_, i) => d3.interpolateRainbow((i * VISUALIZATION_CONFIG.golden) % 1)));
  }

  getLineageCategories(data: Assembly[], level: LineageLevel): string[] {
    const categories = new Set<string>();
    data.forEach(assembly => {
      const value = assembly[level];
      if (value) categories.add(value.toString());
    });
    return Array.from(categories).sort();
  }

  togglePresenceMatrix(matrix: number[][]): number[][] {
    return matrix.map(row => row.map(val => val ? 0 : 1));
  }
} 