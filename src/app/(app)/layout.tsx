import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { isLocalOnly } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  const localOnly = await isLocalOnly();
  return (
    <div className="min-h-screen flex">
      <Sidebar user={session} localOnly={localOnly} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
