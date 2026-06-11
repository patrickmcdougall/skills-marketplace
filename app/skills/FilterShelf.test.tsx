// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterShelf } from "./BrowseClient";
import { SHELVES, SHELF_SUB_SHELVES } from "@/lib/data";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const shelfWithSubs = SHELVES.find(
  (sh) => (SHELF_SUB_SHELVES[sh.id] || []).length > 0
)!;
const SUBS = SHELF_SUB_SHELVES[shelfWithSubs.id];
const otherShelf = SHELVES.find((sh) => sh.id !== shelfWithSubs.id)!;

const counts = Object.fromEntries(SHELVES.map((sh) => [sh.id, 1]));
const subCounts = Object.fromEntries(SUBS.map((s) => [s, 1]));

function setup(props: Partial<Parameters<typeof FilterShelf>[0]> = {}) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  const onSubShelf = vi.fn();
  render(
    <FilterShelf
      value={[]}
      onToggle={onToggle}
      onClear={onClear}
      counts={counts}
      subShelf={null}
      onSubShelf={onSubShelf}
      subShelfCounts={subCounts}
      {...props}
    />
  );
  return { onToggle, onClear, onSubShelf };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FilterShelf nested sub-shelves", () => {
  it("renders no sub-shelf list when no shelf is selected", () => {
    setup();
    expect(document.querySelector(".bp-subshelf-nested")).toBeNull();
    expect(screen.queryByText(SUBS[0])).toBeNull();
  });

  it("nests the sub-shelf list inside the active shelf's list item", () => {
    setup({ value: [shelfWithSubs.id] });
    const nested = document.querySelector(".bp-subshelf-nested");
    expect(nested).not.toBeNull();
    // the nested list lives in the same <li> as the parent shelf button
    const li = nested!.closest("li")!;
    expect(li.textContent).toContain(shelfWithSubs.title);
    for (const s of SUBS) {
      expect(li.textContent).toContain(s);
    }
  });

  it("hides sub-shelves when more than one shelf is selected", () => {
    setup({ value: [shelfWithSubs.id, otherShelf.id] });
    expect(document.querySelector(".bp-subshelf-nested")).toBeNull();
  });

  it("clicking a sub-shelf selects it; clicking the active one clears it", async () => {
    const user = userEvent.setup();
    const { onSubShelf } = setup({ value: [shelfWithSubs.id] });

    await user.click(screen.getByRole("button", { name: new RegExp(SUBS[0]) }));
    expect(onSubShelf).toHaveBeenCalledWith(SUBS[0]);

    cleanup();
    const second = setup({ value: [shelfWithSubs.id], subShelf: SUBS[0] });
    const activeBtn = screen.getByRole("button", { name: new RegExp(SUBS[0]) });
    expect(activeBtn.className).toContain("is-active");
    await user.click(activeBtn);
    expect(second.onSubShelf).toHaveBeenCalledWith(null);
  });
});
