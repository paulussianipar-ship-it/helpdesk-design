import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SiteMobileNav } from "@/components/site-mobile-nav";
import { Palette } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">DesignDesk</span>
        </a>
        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="/#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Fitur Unggulan
          </a>
          <a
            href="/#how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Cara Kerja
          </a>
          <a
            href="/artikel"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Artikel
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Button variant="ghost" size="sm" asChild>
            <a href="/auth/login">Masuk</a>
          </Button>
          <SiteMobileNav
            links={[
              { label: "Fitur Unggulan", href: "/#features" },
              { label: "Cara Kerja", href: "/#how-it-works" },
              { label: "Artikel", href: "/artikel" },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
