"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="flex items-center p-1 bg-background/50 backdrop-blur-md rounded-full border shadow-sm">
        <button
            onClick={() => setTheme("light")}
            className={`p-2 rounded-full transition-all duration-300 ${
                theme === 'light' 
                ? 'bg-white text-orange-500 shadow-md scale-110' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Light Mode"
        >
            <Sun className="w-4 h-4" />
        </button>
        <button
            onClick={() => setTheme("dark")}
            className={`p-2 rounded-full transition-all duration-300 ${
                theme === 'dark' 
                ? 'bg-slate-800 text-blue-400 shadow-md scale-110' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
             aria-label="Dark Mode"
        >
            <Moon className="w-4 h-4" />
        </button>
    </div>
  )
}
