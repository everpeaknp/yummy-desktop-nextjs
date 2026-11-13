import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import apiClient from "@/lib/api-client";
import { DayCloseNameEditor } from "./day-close-name-editor";

vi.mock("@/lib/api-client", () => ({ default: { patch: vi.fn() } }));

describe("dayclose naming", () => {
  it("keeps a failed rename available for retry and uses the saved server name", async () => {
    const saved = vi.fn();
    vi.mocked(apiClient.patch).mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ data: { data: { name: "Friday dinner" } } });
    render(<DayCloseNameEditor id={52} name="2026-11-13" onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename dayclose" }));
    const input = screen.getByRole("textbox", { name: "Dayclose name" });
    expect(input).toHaveValue("2026-11-13");
    fireEvent.change(input, { target: { value: " Friday dinner " } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await screen.findByRole("alert");
    expect(input).toHaveValue(" Friday dinner ");
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith("Friday dinner"));
    expect(apiClient.patch).toHaveBeenLastCalledWith("/day-closes/52/name", { name: "Friday dinner" });
  });
});
