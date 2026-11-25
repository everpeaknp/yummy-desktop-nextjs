import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingWizard } from "./onboarding-wizard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (selector: (state: object) => unknown) => selector({ user: null }) }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (selector: (state: object) => unknown) => selector({}) }));
vi.mock("@/hooks/use-fiscal-profile", () => ({ useFiscalProfile: () => ({ isActiveVat: false, loading: false }) }));
vi.mock("@/hooks/use-onboarding", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/hooks/use-onboarding")>(),
  useOnboardingHydrated: () => true,
}));
vi.mock("@/lib/geocode", () => ({
  forwardGeocode: vi.fn(),
  reverseGeocode: vi.fn().mockResolvedValue("Selected address, Kathmandu, Nepal"),
}));
vi.mock("@/components/manage/profile/location-picker", () => ({
  default: ({ onChange }: { onChange: (lat: string, lng: string) => void }) => (
    <button onClick={() => onChange("27.717200", "85.324000")}>Select map point</button>
  ),
}));

beforeEach(() => {
  useOnboarding.getState().reset();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

it("opens the signup map, saves the selected location, and allows reopening and dismissal", async () => {
  const user = userEvent.setup();
  render(<OnboardingWizard />);
  await user.click(screen.getByRole("button", { name: "Open map to set location" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Set location")).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Select map point" }));
  await waitFor(() => expect(useOnboarding.getState().draft.address).toBe("Selected address, Kathmandu, Nepal"));
  expect(useOnboarding.getState().draft).toMatchObject({ latitude: "27.717200", longitude: "85.324000" });
  await user.click(within(dialog).getByRole("button", { name: "Maximize map" }));
  await user.click(within(dialog).getByRole("button", { name: "Minimize map" }));
  await user.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Street, area, city, state, country")).toHaveValue("Selected address, Kathmandu, Nepal");
  await user.click(screen.getByRole("button", { name: "Open map to set location" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("27.717200, 85.324000");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
