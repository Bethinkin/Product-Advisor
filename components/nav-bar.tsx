"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/artifacts", label: "Artifacts" },
  { href: "/profile", label: "Profile" },
  { href: "/setup", label: "Setup" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-background sticky top-0 z-20">
      <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          Product-Advisor
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-1.5 rounded text-sm",
                pathname?.startsWith(l.href)
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
