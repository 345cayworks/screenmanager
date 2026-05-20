import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen flex">
      <Sidebar user={session} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
