import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export async function selectOption(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(screen.getByRole("option", { name: option }));
}
