import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RewardsSignupPoster } from "./rewards-signup-poster";

describe("RewardsSignupPoster", () => {
  afterEach(() => cleanup());

  it("previews a clearly labeled restaurant rewards sign with print downloads", async () => {
    render(<RewardsSignupPoster restaurantName="Cafe De Sip" restaurantId={52} signupQr="data:image/png;base64,qr" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview signup sign" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Print your rewards sign" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cafe De Sip" })).toBeInTheDocument();
    expect(screen.getByText("Get rewarded at your favorite restaurant.")).toBeInTheDocument();
    expect(screen.getByText("Scan to join")).toBeInTheDocument();
    expect(screen.getByText("Offers are optional.")).toBeInTheDocument();
    expect(screen.queryByText("A little extra for coming back")).not.toBeInTheDocument();
    expect(screen.getByText("Scan to join").parentElement).not.toHaveClass("bg-[#f4511e]");
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
  });
});
