"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, statusTone } from "@/components/ui";
import OnboardModal from "./OnboardModal";

type Row = {
  id: string;
  companyName: string;
  contactEmail: string | null;
  approvalMode: string;
  status: string;
  users: number;
  mappings: number;
};

export default function ClientsView({ clients }: { clients: Row[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">{clients.length} client(s)</div>
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium"
        >
          + Onboard a client
        </button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left py-2 px-4">Company</th>
              <th className="text-left py-2 px-4">Contact</th>
              <th className="text-left py-2 px-4">Approval</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Users</th>
              <th className="text-left py-2 px-4">Mappings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="py-2 px-4 font-medium text-slate-900">{c.companyName}</td>
                <td className="py-2 px-4 text-slate-600">{c.contactEmail || "—"}</td>
                <td className="py-2 px-4">
                  <Badge tone={c.approvalMode === "AUTO_PUBLISH" ? "green" : "amber"}>{c.approvalMode}</Badge>
                </td>
                <td className="py-2 px-4">
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </td>
                <td className="py-2 px-4 text-slate-600">{c.users}</td>
                <td className="py-2 px-4 text-slate-600">{c.mappings}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-500">
                  No clients yet. Click <strong>Onboard a client</strong> to add your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <OnboardModal
        open={open}
        onClose={() => setOpen(false)}
        onCompleted={() => router.refresh()}
      />
    </div>
  );
}
