import Link from "next/link";
import { House, Image, ExternalLink, Shield } from "lucide-react";

const navLinks = [
  { label: "Beranda", href: "/", icon: House },
  { label: "Gallery", href: "/gallery", icon: Image },
] as const;

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-horizon-forest/10 bg-horizon-offwhite/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-heading text-xl font-bold text-horizon-forest">
          Horizon
        </Link>

        <ul className="flex items-center gap-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-horizon-forest"
              >
                <link.icon size={16} aria-hidden="true" />
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href="https://tools.horizon.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-horizon-forest"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Tools
            </a>
          </li>
          <li>
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-horizon-forest"
            >
              <Shield size={16} aria-hidden="true" />
              Admin
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
