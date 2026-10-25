import type { ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { Button } from './button';
import { cn } from './cn';

export interface SortableListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onReorder: (from: number, to: number) => void;
  moveButtons?: boolean;
}

interface SortableRowProps {
  id: string;
  index: number;
  count: number;
  label: string;
  moveButtons: boolean;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}

function SortableRow({ id, index, count, label, moveButtons, onMove, children }: SortableRowProps) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2 rounded-control bg-card py-1', isDragging && 'relative z-10 shadow-lg ring-2 ring-focus')}
    >
      <button type="button" className="flex size-11 cursor-grab items-center justify-center text-muted active:cursor-grabbing" aria-label={t('common.moveItem', { item: label })} {...attributes} {...listeners}>
        <GripVertical className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      {moveButtons ? (
        <>
          <Button variant="ghost" size="icon" icon={ChevronUp} aria-label={`${t('common.moveUp')}: ${label}`} disabled={index === 0} onClick={() => onMove(index, index - 1)} />
          <Button variant="ghost" size="icon" icon={ChevronDown} aria-label={`${t('common.moveDown')}: ${label}`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} />
        </>
      ) : null}
    </li>
  );
}

export function SortableList<T>({ items, keyOf, labelOf, renderItem, onReorder, moveButtons = true }: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map(keyOf);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onReorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    }
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col">
          {items.map((item, index) => (
            <SortableRow key={keyOf(item)} id={keyOf(item)} index={index} count={items.length} label={labelOf(item)} moveButtons={moveButtons} onMove={onReorder}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
