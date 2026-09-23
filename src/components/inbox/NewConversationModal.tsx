import { useState, useEffect } from "react";
import { Search, MessageSquarePlus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { maskPhone, maskEmail } from "@/lib/maskPhone";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  whatsapp_id: string | null;
}

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

const NewConversationModal = ({ open, onClose, onConversationCreated }: NewConversationModalProps) => {
  const { user, isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchContacts();
      setSearch("");
    }
  }, [open]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, phone, email, avatar_url, whatsapp_id")
      .eq("is_active", true)
      .order("name");
    if (error) {
      console.error("Error fetching contacts:", error);
    }
    setContacts((data as Contact[]) || []);
    setLoading(false);
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  const handleSelect = async (contact: Contact) => {
    if (!user) return;
    setCreating(true);

    try {
      // Check if there's already an open/pending conversation with this contact
      const { data: existing } = await supabase
        .from("conversations")
        .select("id, status")
        .eq("contact_id", contact.id)
        .in("status", ["open", "pending"])
        .limit(1);

      if (existing && existing.length > 0) {
        toast.info("Já existe uma conversa aberta com este contato");
        onConversationCreated(existing[0].id);
        onClose();
        setCreating(false);
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          contact_id: contact.id,
          assigned_agent_id: user.id,
          channel: "whatsapp" as const,
          status: "open" as const,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.success(`Conversa iniciada com ${contact.name}`);
      onConversationCreated(newConv.id);
      onClose();
    } catch (err: any) {
      console.error("Error creating conversation:", err);
      toast.error("Erro ao iniciar conversa");
    } finally {
      setCreating(false);
    }
  };

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash % 360)}, 55%, 45%)`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-primary" />
            Nova conversa
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar contato por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-primary/20 transition-shadow text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 max-h-[50vh] -mx-1">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando contatos...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {search ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}
            </div>
          ) : (
            filtered.map((contact) => {
              const initials = contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
              return (
                <button
                  key={contact.id}
                  onClick={() => handleSelect(contact)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-secondary/70 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={contact.avatar_url || undefined} alt={contact.name} />
                    <AvatarFallback
                      className="text-sm font-semibold text-white"
                      style={{ backgroundColor: getAvatarColor(contact.name) }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{maskPhone(contact.phone, !isManager && !isAdmin)}</p>
                  </div>
                  {contact.email && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{maskEmail(contact.email, !isManager && !isAdmin)}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationModal;
