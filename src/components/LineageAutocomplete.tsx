import React, { useState, useMemo } from 'react';

interface LineageAutocompleteProps {
  /** full list of lineage strings to suggest */
  suggestions: string[];
  /** called when the user selects (or “blurs/Enters”) a value */
  onSelect: (value: string) => void;
  /** placeholder text for the input */
  placeholder?: string;
}

export default function LineageAutocomplete({
  suggestions,
  onSelect,
  placeholder = 'Search lineage…',
}: LineageAutocompleteProps) {
  const [value, setValue] = useState<string>('');

  // filter down the suggestions as the user types
  const filtered = useMemo(
    () =>
      suggestions.filter((opt) =>
        opt.toLowerCase().includes(value.toLowerCase())
      ),
    [value, suggestions]
  );

  return (
    <div className="lineage-autocomplete relative">
      <input
        type="text"
        list="lineage-options"
        className="border p-2 rounded w-full text-xs"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSelect(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelect(value);
        }}
      />
      <datalist id="lineage-options">
        {filtered.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}
