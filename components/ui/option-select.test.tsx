import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { OptionSelect } from "./option-select";
import { selectOption } from "@/test/select-option";

afterEach(cleanup);
function Field() {
  const [value, setValue] = useState<string | number>("");
  return <><OptionSelect aria-label="Customer" value={value} onValueChange={setValue}>
    <option value="">No customer</option>
    {[{ id: 7, name: "Niraj" }, { id: 8, name: "Everacy" }].map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    <option value="locked" disabled>Unavailable customer</option>
  </OptionSelect><output aria-label="Selected value">{String(value)}</output></>;
}
it("selects numeric IDs and allows clearing through an explicit empty choice", async () => {
  render(<Field />);
  await selectOption("Customer", "Niraj");
  expect(screen.getByLabelText("Selected value")).toHaveTextContent("7");
  await userEvent.click(screen.getByRole("combobox", { name: "Customer" }));
  expect(screen.getByRole("option", { name: "Unavailable customer" })).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(screen.getByRole("option", { name: "No customer" }));
  expect(screen.getByLabelText("Selected value")).toBeEmptyDOMElement();
  expect(screen.getByRole("combobox")).toHaveTextContent("No customer");
});
it("supports keyboard selection and Escape returns focus to the trigger", async () => {
  render(<Field />);
  const trigger = screen.getByRole("combobox", { name: "Customer" });
  trigger.focus();
  await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
  expect(screen.getByLabelText("Selected value")).toHaveTextContent("7");
  await userEvent.click(trigger);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it("does not open or change disabled fields", async () => {
  const changed = vi.fn();
  render(<OptionSelect aria-label="Bill" value={1} onValueChange={changed} disabled><option value={1}>Bill one</option></OptionSelect>);
  const trigger = screen.getByRole("combobox", { name: "Bill" });
  expect(trigger).toBeDisabled();
  await userEvent.click(trigger);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
});
