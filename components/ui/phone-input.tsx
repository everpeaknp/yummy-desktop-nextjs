"use client";

import { useMemo, useState } from "react";
import PhoneInputWithCountry, {
  isValidPhoneNumber,
  type Country,
  type Value,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type AppPhoneInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: "NP" | "IN" | "US" | "AU" | "GB";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  international?: boolean;
};

type CountryOption = {
  value?: Country;
  label: string;
  divider?: boolean;
};

type ThemedCountrySelectProps = {
  value?: Country;
  onChange: (value?: Country) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
  iconComponent: React.ElementType;
};

function ThemedCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  iconComponent: Icon,
}: ThemedCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectable = useMemo(
    () => options.filter((o) => !o.divider && o.value),
    [options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.value && String(o.value).toLowerCase().includes(q))
    );
  }, [query, selectable]);

  const selected = selectable.find((o) => o.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled || readOnly) return;
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || readOnly}
          className={cn(
            "PhoneInputCountry flex h-8 items-center gap-1 rounded-md px-1.5 transition-colors",
            "hover:bg-muted"
          )}
          aria-label={selected?.label || "Select country"}
        >
          <span className="PhoneInputCountryIcon flex items-center">
            <Icon country={value} label={selected?.label} />
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[80] w-72 overflow-hidden border-border p-0 shadow-lg"
        align="start"
        sideOffset={8}
      >
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No country found.</p>
          ) : (
            filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    "hover:bg-primary/10 hover:text-primary",
                    isSelected && "bg-primary/15 font-medium text-primary"
                  )}
                >
                  <span className="flex h-4 w-[1.35rem] shrink-0 items-center overflow-hidden rounded-[2px] border border-border">
                    <Icon country={option.value} label={option.label} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0 text-primary",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppPhoneInput({
  id,
  value,
  onChange,
  defaultCountry = "NP",
  placeholder = "Enter phone number",
  disabled,
  className,
  international = true,
}: AppPhoneInputProps) {
  const phoneValue = useMemo(() => (value || undefined) as Value | undefined, [value]);

  return (
    <div className={cn("phone-input-field", className)}>
      <PhoneInputWithCountry
        id={id}
        flags={flags}
        international={international}
        defaultCountry={defaultCountry}
        countryCallingCodeEditable={false}
        value={phoneValue}
        onChange={(next) => onChange(next || "")}
        placeholder={placeholder}
        disabled={disabled}
        className="PhoneInput"
        countrySelectComponent={ThemedCountrySelect}
      />
    </div>
  );
}

export { isValidPhoneNumber };
