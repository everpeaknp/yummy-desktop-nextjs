import { describe, expect, it } from "vitest";
import { getMenuQrUrl } from "./menu-qr-url";

describe("getMenuQrUrl", () => {
  it("uses the configured Menu QR base and appends the token", () => {
    expect(getMenuQrUrl("table-token", "https://menu.yummyever.com/qr/"))
      .toBe("https://menu.yummyever.com/qr/table-token");
  });

  it("defaults to the production Menu QR URL when no base is configured", () => {
    expect(getMenuQrUrl("table-token", " "))
      .toBe("https://menu.yummyever.com/qr/table-token");
  });
});
