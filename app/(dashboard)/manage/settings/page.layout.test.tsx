import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/(dashboard)/manage/settings/page.tsx"),
  "utf8",
);

describe("restaurant operations settings layout", () => {
  it("includes the shared settings rail with Restaurant operations selected", () => {
    expect(source).toContain(
      'import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";',
    );
    expect(source).toContain(
      '<SettingsDesktopRail activeItemId="restaurant_operations" />',
    );
  });
});
