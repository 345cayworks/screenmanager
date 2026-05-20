"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import clsx from "clsx";
import type { Role } from "@/lib/enums";

type NavLink = { href: string; label: string; icon: string };

const CLIENT_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/playlists", label: "My Playlists", icon: "♬" },
  { href: "/assets", label: "Asset Library", icon: "▢" },
  { href: "/activity", label: "Activity", icon: "≡" },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin", label: "Admin Dashboard", icon: "✦" },
  { href: "/admin/clients", label: "Clients", icon: "◉" },
  { href: "/admin/approvals", label: "Playlist Approvals", icon: "✓" },
  { href: "/admin/mappings", label: "OptiSigns Mappings", icon: "⇄" },
  { href: "/admin/assets", label: "Assets", icon: "▢" },
  { href: "/admin/audit", label: "Audit Logs", icon: "≡" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({
  user,
}: {
  user: { name: string; email: string; role: Role; clientId: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isAdmin = user.role === "SUPERADMIN" || user.role === "ADMIN";
  const links = isAdmin ? ADMIN_LINKS : CLIENT_LINKS;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">C</div>
          <div>
            <div className="text-sm font-semibold text-slate-900 leading-tight">Cayworks</div>
            <div className="text-xs text-slate-500 leading-tight">Display Manager</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span className="w-5 text-center text-slate-400">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="text-xs text-slate-500">Signed in as</div>
        <div className="text-sm font-medium text-slate-900 truncate">{user.name}</div>
        <div className="text-xs text-slate-500 truncate">{user.email}</div>
        <div className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
          {user.role.replace("_", " ")}
        </div>
        <button
          onClick={logout}
          disabled={pending}
          className="mt-3 w-full text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
