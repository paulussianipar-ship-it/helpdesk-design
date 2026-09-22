"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="size-8 sm:size-9 rounded-lg border border-border/70 bg-background/80 opacity-60 pointer-events-none"
        aria-label="Memuat tema..."
      >
        <Sun className="size-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8 sm:size-9 rounded-lg border border-border/70 bg-background/80 hover:bg-muted/80 shadow-xs transition-colors cursor-pointer"
          title={`Tema saat ini: ${theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem"}. Klik untuk mengubah.`}
          aria-label="Ubah tema tampilan (Terang / Gelap)"
        >
          {theme === "light" ? (
            <Sun className="size-4 text-amber-500 transition-transform rotate-0 scale-100" />
          ) : theme === "dark" ? (
            <Moon className="size-4 text-sky-400 transition-transform rotate-0 scale-100" />
          ) : (
            <Laptop className="size-4 text-muted-foreground transition-transform rotate-0 scale-100" />
          )}
          <span className="sr-only">Ubah Tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px] p-1 text-xs">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(val) => setTheme(val)}
        >
          <DropdownMenuRadioItem
            value="light"
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 text-xs"
          >
            <Sun className="size-4 text-amber-500" />
            <span className="font-medium">Terang (Light)</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 text-xs"
          >
            <Moon className="size-4 text-sky-400" />
            <span className="font-medium">Gelap (Dark)</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 text-xs"
          >
            <Laptop className="size-4 text-muted-foreground" />
            <span className="font-medium">Sistem (Auto)</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Direct 1-click toggle button between light & dark mode.
 */
export function ThemeToggleSimple({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`size-8 sm:size-9 rounded-lg border border-border/70 bg-background/80 hover:bg-muted/80 shadow-xs transition-colors cursor-pointer ${className || ""}`}
      title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
      aria-label="Toggle Dark / Light mode"
    >
      {isDark ? (
        <Moon className="size-4 text-sky-400" />
      ) : (
        <Sun className="size-4 text-amber-500" />
      )}
      <span className="sr-only">Toggle Dark/Light</span>
    </Button>
  );
}

export default ThemeSwitcher;
