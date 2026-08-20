"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BenefitMembershipForm } from "@/components/benefit-membership-form";
import type { BenefitMembership } from "@/types/database";

export function BenefitMembershipsPanel({
  petloveMembership,
  otherMemberships,
  saveAction,
  deleteAction,
  editable,
}: {
  petloveMembership: BenefitMembership | null;
  otherMemberships: BenefitMembership[];
  saveAction: (formData: FormData) => void;
  deleteAction?: (membershipId: string, formData: FormData) => void;
  editable: boolean;
}) {
  const [showAddOther, setShowAddOther] = useState(false);

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <BenefitMembershipForm kind="petlove_club" membership={petloveMembership} action={saveAction} editable={editable} />

      {otherMemberships.map((membership) => (
        <div key={membership.id} className="relative">
          <BenefitMembershipForm
            kind="other"
            membership={membership}
            action={saveAction}
            editable={editable}
            title={membership.custom_name ?? "Outro clube"}
          />
          {editable && deleteAction && (
            <form action={deleteAction.bind(null, membership.id)} className="mt-2 text-right">
              <button type="submit" className="text-[10px] font-bold text-[var(--danger)] underline">
                Remover clube
              </button>
            </form>
          )}
        </div>
      ))}

      {editable && (
        <div className="flex flex-col justify-start">
          {!showAddOther ? (
            <button
              type="button"
              onClick={() => setShowAddOther(true)}
              className="focus-ring flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--border)] bg-white p-5 text-sm font-bold text-[var(--muted)] transition hover:border-[var(--lavender)] hover:text-[var(--lavender-strong)]"
            >
              <Plus size={22} />
              Adicionar outro clube
            </button>
          ) : (
            <div>
              <BenefitMembershipForm
                kind="other"
                membership={null}
                action={saveAction}
                editable
                title="Novo clube"
                isNew
              />
              <button
                type="button"
                onClick={() => setShowAddOther(false)}
                className="mt-2 text-xs font-bold text-[var(--muted)] underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
