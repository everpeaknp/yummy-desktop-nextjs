"use client"

import * as React from "react"
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'month' | 'custom'

interface DateRangeDropdownProps {
  activeRange: DateRangePreset
  setActiveRange: (range: DateRangePreset) => void
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}

export function DateRangeDropdown({
  activeRange,
  setActiveRange,
  date,
  setDate,
}: DateRangeDropdownProps) {
  const [open, setOpen] = React.useState(false)

  const presets = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "month" },
  ]

  const getActiveLabel = () => {
    if (activeRange === 'custom') {
      if (date?.from) {
        if (!date.to) {
          return format(date.from, "LLL dd, y")
        } else if (date.to) {
          return `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
        }
      }
      return "Custom Range"
    }
    const preset = presets.find((p) => p.value === activeRange)
    return preset?.label || "Select Date"
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[auto] min-w-[160px] justify-between text-left font-normal bg-background/50 backdrop-blur-sm rounded-xl border-border/50",
            !date && "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="truncate">{getActiveLabel()}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="p-2 w-full sm:w-[160px] flex flex-col gap-1">
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  setActiveRange(preset.value as DateRangePreset)
                  setOpen(false)
                }}
                className={cn(
                  "text-sm px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between",
                  activeRange === preset.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {preset.label}
                {activeRange === preset.value && <Check className="h-4 w-4" />}
              </button>
            ))}
            <div className="h-px bg-border/50 my-1" />
            <button
              onClick={() => setActiveRange('custom')}
              className={cn(
                "text-sm px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between",
                activeRange === 'custom'
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Custom Range
              {activeRange === 'custom' && <Check className="h-4 w-4" />}
            </button>
          </div>
          {activeRange === 'custom' && (
            <div className="p-2 relative">
              <div className="transition-opacity duration-200 opacity-100">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={(selected) => {
                    setDate(selected)
                    if (selected?.from && selected?.to) {
                      setOpen(false)
                    }
                  }}
                  numberOfMonths={1}
                />
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
