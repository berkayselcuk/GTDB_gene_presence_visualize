import type { Metadata } from 'next'
import { GeneVisualization } from '@/components/gene-visualization/GeneVisualization'

export const metadata: Metadata = {
  title: 'Gene Presence Lineage Tool',
  description: 'Visualize gene presence and absence across GTDB taxonomic lineages',
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <GeneVisualization />
    </div>
  )
}
