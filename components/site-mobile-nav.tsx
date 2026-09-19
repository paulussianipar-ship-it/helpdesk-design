"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

interface SiteMobileNavLink {
  label: string;
  href: string;
}

interface SiteMobileNavProps {
  links: SiteMobileNavLink[];
}

export function SiteMobileNav({ links }: SiteMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Buka menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b border-border bg-background shadow-lg md:hidden">
          <nav className="flex flex-col gap-1 p-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}