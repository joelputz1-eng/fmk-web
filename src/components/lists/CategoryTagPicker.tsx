'use client';

import { useState } from 'react';
import { CATEGORY_COLORS, createCategory } from '@/lib/db/categories';
import type { CategoryRecord } from '@/lib/db/schema';
import { Button } from '@/components/ui/Button';

/** Farbcodierte Kategorien als Toggle-Chips, inkl. Inline-Anlegen (3.2). */
export function CategoryTagPicker({
  categories,
  selectedIds,
  onChange,
  onCategoryCreated,
}: {
  categories: CategoryRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCategoryCreated?: (category: CategoryRecord) => void;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
      const created = await createCategory(name, color);
      onCategoryCreated?.(created);
      onChange([...selectedIds, created.id]);
      setNewName('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const selected = selectedIds.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggle(category.id)}
              aria-pressed={selected}
              className={`chip border transition-colors ${
                selected
                  ? 'border-transparent text-white'
                  : 'border-line text-dim hover:bg-surface-2 hover:text-ink'
              }`}
              style={selected ? { backgroundColor: category.color } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selected ? 'rgba(255,255,255,0.85)' : category.color }}
              />
              {category.name}
            </button>
          );
        })}
        {categories.length === 0 ? <p className="muted">Noch keine Kategorien.</p> : null}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Neue Kategorie …"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void addCategory();
            }
          }}
        />
        <Button variant="secondary" disabled={!newName.trim() || adding} onClick={() => void addCategory()}>
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}
