"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ClaudinhoLogo } from "./ClaudinhoLogo";

interface NavProps {
  stats: {
    skills: number;
    creators: number;
    installs: string;
  };
}

export function Nav({ stats }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Body scroll-lock
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const linkProps = (href: string) => ({
    href,
    "aria-current": isActive(href) ? ("page" as const) : undefined,
    style: isActive(href) ? { color: "var(--ink)", fontWeight: 500 } : undefined,
  });

  return (
    <>
      <nav className="lp-nav">
        <div className="logo-row">
          <div className="brand-stack">
            <Link className="logo" href="/">
              <ClaudinhoLogo height={44} />
            </Link>
            <span className="brand-tag">ready-made skills</span>
          </div>
        </div>
        <div className="right">
          <div className="links nav-desktop-links">
            <Link {...linkProps("/skills")}>Browse</Link>
            <Link {...linkProps("/creators")}>Creators</Link>
            <a href="/#how">About</a>
          </div>
          <button
            ref={hamburgerRef}
            className="nav-hamburger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="nav-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`nav-hamburger-icon${open ? " is-open" : ""}`} />
          </button>
        </div>
      </nav>

      {/* Backdrop */}
      {open && (
        <div
          className="nav-backdrop"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        id="nav-drawer"
        className={`nav-drawer${open ? " is-open" : ""}`}
        aria-hidden={!open}
        // Focus trap: block interaction with main content when drawer open
        {...(!open ? {} : {})}
      >
        <nav className="nav-drawer-links">
          <Link {...linkProps("/skills")} onClick={() => setOpen(false)}>Browse</Link>
          <Link {...linkProps("/creators")} onClick={() => setOpen(false)}>Creators</Link>
          <a href="/#how" onClick={() => setOpen(false)}>About</a>
        </nav>
        <div className="nav-drawer-status">
          <span className="nav-status-chip">
            {stats.skills.toLocaleString()} skills · {stats.installs} installs
          </span>
        </div>
      </div>

      {/* Trap focus: when drawer open, make main content inert */}
      {open && (
        <style>{`main, footer { pointer-events: none; user-select: none; }`}</style>
      )}
    </>
  );
}
