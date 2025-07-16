# Gene Presence Lineage Tool

A modern React-based visualization tool for analyzing gene presence across GTDB taxonomic lineages. This application provides an interactive interface for exploring gene distribution patterns across different bacterial and archaeal lineages.

## Features

- **Interactive Visualization**: D3.js-powered charts for exploring gene presence/absence patterns
- **Taxonomic Filtering**: Filter by different lineage levels (phylum, class, order, family, genus)
- **Gene Selection**: Select and compare multiple genes simultaneously
- **Difference Analysis**: Create difference rugs to compare gene presence between two genes
- **Dynamic Normalization**: Normalize visualization widths by lineage levels
- **Size Filtering**: Filter lineages by minimum assembly count
- **Search Functionality**: Search for specific taxonomic lineages
- **TSV File Upload**: Upload gene count data in TSV format
- **Modern UI**: Built with Next.js, Tailwind CSS, and shadcn/ui components

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui with Radix UI primitives
- **Data Visualization**: D3.js v7
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gene-visualization-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Loading Data

1. **JSON Data**: The application automatically loads GTDB taxonomic data from the public directory
2. **TSV Upload**: Click "Load TSV" to upload your gene count data in tab-separated format

### Visualization Controls

- **Lineage Levels**: Select which taxonomic levels to display
- **Gene Selection**: Choose genes to visualize from the sidebar
- **Search**: Use the search box to find specific taxonomic lineages
- **Filters**: Apply size filters and assembly filters
- **Normalization**: Normalize widths by taxonomic level for better comparison

### Difference Analysis

1. Select two genes from the dropdown menus
2. Choose whether to use raw counts or presence/absence
3. Click "Add" to create a difference rug
4. View the difference visualization showing positive (green) and negative (red) differences

## Data Format

### TSV File Format
```
Assembly	Gene1	Gene2	Gene3	...
Assembly1	0	1	2	...
Assembly2	1	0	0	...
...
```

- First column: Assembly identifiers (must match GTDB assembly names)
- Subsequent columns: Gene names with count values
- Values: Integer counts (0 = absent, >0 = present)

## Project Structure

```
gene-visualization-app/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   └── gene-visualization/ # Main visualization components
│   ├── lib/                # Utility functions
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Data processing utilities
├── public/                 # Static assets and JSON data
└── ...
```

## Key Components

- `GeneVisualization.tsx`: Main visualization component
- `DataProcessor`: Handles data loading and processing
- `types/gene-visualization.ts`: TypeScript interfaces
- `utils/data-processing.ts`: Data manipulation utilities

## Development

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

### Adding New Features

1. Define types in `src/types/gene-visualization.ts`
2. Add data processing logic in `src/utils/data-processing.ts`
3. Create UI components in `src/components/`
4. Update the main visualization component as needed

## Migration from Original

This modern version maintains all functionality from the original JavaScript implementation while providing:

- Better code organization and maintainability
- Type safety with TypeScript
- Modern React patterns and hooks
- Responsive design with Tailwind CSS
- Accessible UI components with shadcn/ui
- Better performance with Next.js optimizations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Original implementation preserved in `backup_original/`
- Built on the GTDB (Genome Taxonomy Database) taxonomic framework
- Uses D3.js for data visualization
- UI components from shadcn/ui
