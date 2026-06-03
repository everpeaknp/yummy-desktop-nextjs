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
  disabled?: boolean
}

export function DateRangeDropdown({
  activeRange,
  setActiveRange,
  date,
  setDate,
  disabled = false,
}: DateRangeDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [fromTime, setFromTime] = React.useState("00:00")
  const [toTime, setToTime] = React.useState("23:59")

  const handleTimeChange = (time: string, isEnd = false) => {
    if (isEnd) {
      setToTime(time)
      if (date?.to) {
        const [h, m] = time.split(":").map(Number)
        const newTo = new Date(date.to)
        newTo.setHours(h, m, 59, 999)
        setDate({ ...date, to: newTo })
      }
    } else {
      setFromTime(time)
      if (date?.from) {
        const [h, m] = time.split(":").map(Number)
        const newFrom = new Date(date.from)
        newFrom.setHours(h, m, 0, 0)
        setDate({ ...date, from: newFrom })
      }
    }
  }

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
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[auto] min-w-[160px] justify-between text-left font-normal bg-background/50 backdrop-blur-sm rounded-xl border-border/50",
            !date && "text-muted-foreground",
            disabled && "opacity-60 cursor-not-allowed"
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
            <div className="p-2 relative flex flex-col gap-2">
              <div className="transition-opacity duration-200 opacity-100">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={(selected) => {
                    if (selected?.from) {
                      const [h, m] = fromTime.split(":").map(Number);
                      selected.from.setHours(h, m, 0, 0);
                    }
                    if (selected?.to) {
                      const [h, m] = toTime.split(":").map(Number);
                      selected.to.setHours(h, m, 59, 999);
                    }
                    setDate(selected);
                  }}
                  numberOfMonths={1}
                />
              </div>

              {/* Start and End Time selectors */}
              <div className="flex gap-2 px-2 pb-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Start Time</label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => handleTimeChange(e.target.value, false)}
                    className="w-full text-xs font-bold bg-muted px-2.5 py-2 rounded-lg border border-border/30 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-zinc-800"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">End Time</label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => handleTimeChange(e.target.value, true)}
                    className="w-full text-xs font-bold bg-muted px-2.5 py-2 rounded-lg border border-border/30 focus:outline-none focus:ring-1 focus:ring-primary dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="px-2 pb-1">
                <Button
                  size="sm"
                  className="w-full font-bold uppercase tracking-widest text-[10px] h-9 shadow-md"
                  disabled={!date?.from}
                  onClick={() => setOpen(false)}
                >
                  Apply Range
                </Button>
              </div>
            </div>
          )}        </div>
      </PopoverContent>
    </Popover>
  )
}
