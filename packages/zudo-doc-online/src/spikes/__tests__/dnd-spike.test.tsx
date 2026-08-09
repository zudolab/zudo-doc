// @vitest-environment jsdom
// Compat spike (bootstrap sub-issue #3328): proves @dnd-kit works on
// preact/compat BEFORE the board sub-issue (#3337) builds real UI on it.
import { describe, expect, it } from "vitest";
import { render } from "preact";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ITEM_IDS = ["item-a", "item-b"];

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };
  // dnd-kit's `DraggableAttributes.role` is a plain `string`, narrower than
  // Preact's `Signalish<AriaRole>` prop type — cast the spread rather than
  // widen Preact's own JSX types.
  const dndProps = { ...attributes, ...listeners } as Record<string, unknown>;

  return (
    <li ref={setNodeRef} style={style} data-testid={id} {...dndProps}>
      {id}
    </li>
  );
}

function SpikeBoard() {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext sensors={sensors}>
      <SortableContext items={ITEM_IDS} strategy={verticalListSortingStrategy}>
        <ul>
          {ITEM_IDS.map((id) => (
            <SortableItem key={id} id={id} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

describe("dnd-kit on preact/compat spike", () => {
  it("mounts DndContext + SortableContext with 2 sortable items and keyboard-sensor wiring without throwing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    expect(() => render(<SpikeBoard />, container)).not.toThrow();

    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(container.querySelector('[data-testid="item-a"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="item-b"]')).not.toBeNull();

    expect(() => render(null, container)).not.toThrow();
    container.remove();
  });
});
