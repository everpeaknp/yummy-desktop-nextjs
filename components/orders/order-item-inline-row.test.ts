import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "app/(dashboard)/orders/[id]/page.tsx"), "utf8");

it("expands the quantity editor directly beneath the clicked item row", () => {
  expect(source).toContain("selectedItem?.id === item.id");
  expect(source).toContain("<OrderItemQuantityEditor");
  expect(source).toContain("colSpan={5}");
  expect(source).toContain("onClick={() => canEdit && onEditItem(item)}");
});
