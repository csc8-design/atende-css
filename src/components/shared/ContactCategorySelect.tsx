import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown } from "lucide-react";

const CATEGORIES = [
  { value: "bronze", label: "Bronze", color: "bg-amber-700/15 text-amber-700 border-amber-700/30" },
  { value: "prata", label: "Prata", color: "bg-slate-400/15 text-slate-500 border-slate-400/30" },
  { value: "ouro", label: "Ouro", color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  { value: "diamante", label: "Diamante", color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30" },
  { value: "vip", label: "VIP", color: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
] as const;

interface ContactCategorySelectProps {
  contactId: string;
  currentCategory: string | null;
  onUpdate?: () => void;
  compact?: boolean;
}

const ContactCategorySelect = ({ contactId, currentCategory, onUpdate, compact }: ContactCategorySelectProps) => {
  const [saving, setSaving] = useState(false);

  const handleChange = async (value: string) => {
    const newValue = value === currentCategory ? null : value;
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({ category: newValue } as any)
      .eq("id", contactId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar categoria");
      console.error(error);
    } else {
      toast.success(newValue ? `Categoria: ${CATEGORIES.find(c => c.value === newValue)?.label}` : "Categoria removida");
      onUpdate?.();
    }
  };

  if (compact) {
    const cat = CATEGORIES.find(c => c.value === currentCategory);
    return cat ? (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cat.color}`}>
        <Crown className="w-2.5 h-2.5" />
        {cat.label}
      </span>
    ) : (
      <span className="text-[10px] text-muted-foreground">—</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          disabled={saving}
          onClick={() => handleChange(cat.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
            currentCategory === cat.value
              ? cat.color + " ring-1 ring-offset-1 ring-offset-background"
              : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
          } disabled:opacity-50`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};

export { CATEGORIES };
export default ContactCategorySelect;
