"use client"

import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      formatters={{
        formatWeekdayName: (date) => {
          const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
          return days[date.getDay()];
        },
        formatCaption: (date) => {
          return (
            <span className="flex items-center gap-3">
              <span className="text-foreground font-black text-xl">{format(date, "MMMM")}</span>
              <span className="text-foreground/25 font-medium text-xl">{format(date, "yyyy")}</span>
            </span>
          ) as any;
        }
      }}
      classNames={{
        // v9 class names
        root: "w-full",
        months: "flex flex-col gap-10",
        month: "w-full space-y-2",
        month_caption: "flex justify-between items-center mb-4",
        caption_label: "text-base font-black",
        nav: "flex items-center gap-1",
        button_previous: cn(
          "h-8 w-8 border border-border/60 bg-background flex items-center justify-center rounded-xl hover:bg-accent transition-colors shadow-sm text-foreground/40"
        ),
        button_next: cn(
          "h-8 w-8 border border-border/60 bg-background flex items-center justify-center rounded-xl hover:bg-accent transition-colors shadow-sm text-foreground/40"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex w-full mb-3",
        weekday: "flex-1 text-center text-muted-foreground/30 font-semibold text-xs",
        weeks: "w-full",
        week: "flex w-full",
        day: cn(
          "relative flex-1 h-10 flex items-center justify-center p-0",
          "[&:has([aria-selected].range_middle)]:bg-orange-500/10",
        ),
        day_button: cn(
          "h-9 w-9 rounded-xl font-semibold text-sm transition-all duration-200",
          "hover:bg-orange-500/10 hover:text-orange-600",
          "inline-flex items-center justify-center"
        ),
        // v9 state classes
        selected: cn(
          "!bg-orange-500 !text-white !rounded-2xl shadow-xl shadow-orange-500/30 font-black"
        ),
        today: "text-orange-600 font-extrabold ring-2 ring-orange-500/30 rounded-2xl bg-transparent",
        outside: "text-foreground/15",
        disabled: "text-foreground/10 cursor-not-allowed",
        range_start: cn(
          "after:absolute after:inset-y-1 after:right-0 after:left-1/2 after:bg-orange-500/10 after:z-0"
        ),
        range_end: cn(
          "after:absolute after:inset-y-1 after:left-0 after:right-1/2 after:bg-orange-500/10 after:z-0"
        ),
        range_middle: cn(
          "bg-orange-500/10 rounded-none"
        ),
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronUp : ChevronDown
          return <Icon className="h-5 w-5 stroke-2" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
