"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

type OptionSelectProps = {
  value: string | number;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** Shared Select for option-based fields; keeps numeric and empty option values intact. */
export function OptionSelect({ value, onValueChange, children, disabled, className, id, name, required, ...aria }: OptionSelectProps) {
  const options = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>[];
  // Radix reserves "" for clearing. Encode every value so an explicit empty choice
  // remains selectable without colliding with real IDs or application sentinels.
  const encode = (value: unknown) => `option:${String(value ?? "")}`;
  return <Select value={encode(value)} onValueChange={value => onValueChange(value.slice(7))} disabled={disabled} name={name} required={required}>
    <SelectTrigger id={id} className={className} {...aria}><SelectValue placeholder="Select an option" /></SelectTrigger>
    <SelectContent>
      {options.map(option => <SelectItem key={encode(option.props.value)} value={encode(option.props.value)} disabled={option.props.disabled}>
        {option.props.children}
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
