import { useState, useEffect } from "react";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Building2, Shield, UserX, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface UserData {
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email: string;
  role: string;
  department_ids: string[];
}

interface Department {
  id: string;
  name: string;
}

const roleLabels: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-destructive/10 text-destructive" },
  manager: { label: "Supervisor", className: "bg-warning/10 text-warning" },
  agent: { label: "Agente", className: "bg-primary/10 text-primary" },
};

const UsersSettings = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit dialog
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDeptIds, setEditDeptIds] = useState<string[]>([]);
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("agent");
  const [newDeptIds, setNewDeptIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false);
  const [bulkReactivateOpen, setBulkReactivateOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);

    const [{ data: profiles }, { data: roles }, { data: agentDepts }, emailsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("agent_departments").select("*"),
      callManageUser({ action: "list-emails" }).catch(() => ({ emails: {} })),
    ]);

    const emailMap: Record<string, string> = emailsRes?.emails || {};

    const usersMap: UserData[] = (profiles || []).map((p) => {
      const userRole = (roles || []).find((r) => r.user_id === p.user_id);
      const userDepts = (agentDepts || []).filter((d) => d.agent_id === p.user_id).map((d) => d.department_id);

      return {
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        avatar_url: p.avatar_url,
        is_active: p.is_active,
        email: emailMap[p.user_id] || "",
        role: userRole?.role || "agent",
        department_ids: userDepts,
      };
    });

    setUsers(usersMap);
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("id, name").eq("is_active", true);
    setDepartments(data || []);
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const callManageUser = async (body: any) => {
    const res = await supabase.functions.invoke("manage-user", { body });
    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const openEdit = (user: UserData) => {
    setEditUser(user);
    setEditName(user.full_name);
    setEditPhone(user.phone || "");
    setEditRole(user.role);
    setEditDeptIds(user.department_ids);
    setEditPassword("");
    setEditPasswordConfirm("");
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const res = await callManageUser({
        action: "create",
        email: newEmail.trim(),
        password: "CBMaq2026++",
        fullName: newName.trim(),
      });
      const userId = res?.userId;
      if (userId) {
        // wait briefly so handle_new_user trigger creates profile/role
        await new Promise((r) => setTimeout(r, 400));
        await callManageUser({
          action: "update-profile",
          userId,
          fullName: newName.trim(),
          phone: newPhone || null,
        });
        if (newRole !== "agent") {
          await callManageUser({ action: "update-role", userId, role: newRole });
        }
        if (newDeptIds.length > 0) {
          await callManageUser({ action: "update-departments", userId, departmentIds: newDeptIds });
        }
      }
      toast.success("Usuário criado. Senha padrão: CBMaq2026++");
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPhone(""); setNewRole("agent"); setNewDeptIds([]);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (editPassword || editPasswordConfirm) {
      if (editPassword !== editPasswordConfirm) {
        toast.error("As senhas não coincidem");
        return;
      }
      if (editPassword.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres");
        return;
      }
    }
    setSaving(true);
    try {
      await callManageUser({ action: "update-profile", userId: editUser.user_id, fullName: editName, phone: editPhone || null });
      await callManageUser({ action: "update-role", userId: editUser.user_id, role: editRole });
      await callManageUser({ action: "update-departments", userId: editUser.user_id, departmentIds: editDeptIds });
      if (editPassword) {
        await callManageUser({ action: "reset-password", userId: editUser.user_id, password: editPassword });
      }
      toast.success("Usuário atualizado com sucesso");
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await callManageUser({ action: "delete", userId: deleteUser.user_id });
      toast.success("Usuário excluído com sucesso");
      setDeleteUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuário");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (user: UserData) => {
    try {
      await callManageUser({ action: "deactivate", userId: user.user_id, isActive: !user.is_active });
      toast.success(user.is_active ? "Usuário desativado" : "Usuário reativado");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status");
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const userId of ids) {
        await callManageUser({ action: "delete", userId });
      }
      toast.success(`${ids.length} usuário(s) excluído(s) com sucesso`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuários");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const userId of ids) {
        await callManageUser({ action: "deactivate", userId, isActive: false });
      }
      toast.success(`${ids.length} usuário(s) desativado(s) com sucesso`);
      setSelectedIds(new Set());
      setBulkDeactivateOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desativar usuários");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkReactivate = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const userId of ids) {
        await callManageUser({ action: "deactivate", userId, isActive: true });
      }
      toast.success(`${ids.length} usuário(s) reativado(s) com sucesso`);
      setSelectedIds(new Set());
      setBulkReactivateOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao reativar usuários");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.user_id)));
    }
  };

  const getDeptNames = (ids: string[]) =>
    ids.map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean);

  const filtered = users
    .filter(
      (u) =>
        (u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())) &&
        (statusFilter === "all" || (statusFilter === "active" && u.is_active) || (statusFilter === "inactive" && !u.is_active))
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os usuários e permissões do sistema</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Desativados</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success" />{users.filter(u => u.is_active).length} ativos</span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground" />{users.filter(u => !u.is_active).length} desativados</span>
        </div>
        {selectedIds.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="destructive" size="sm">
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Ações ({selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setBulkDeactivateOpen(true)}>
                <UserX className="w-4 h-4 mr-2" /> Desativar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkReactivateOpen(true)}>
                <UserCheck className="w-4 h-4 mr-2" /> Reativar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-3 w-10">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuário</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Função</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Departamentos</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground text-sm">Carregando...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum usuário encontrado</td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.user_id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${selectedIds.has(user.user_id) ? "bg-secondary/40" : ""}`}>
                  <td className="px-3 py-3.5">
                    <Checkbox
                      checked={selectedIds.has(user.user_id)}
                      onCheckedChange={() => toggleSelect(user.user_id)}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                        {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${roleLabels[user.role]?.className || "bg-muted text-muted-foreground"}`}>
                      {roleLabels[user.role]?.label || user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {getDeptNames(user.department_ids).length > 0 ? (
                        getDeptNames(user.department_ids).map((name) => (
                          <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${user.is_active ? "bg-success" : "bg-muted-foreground"}`} />
                      <span className="text-xs text-muted-foreground">{user.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(user)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                          {user.is_active ? (
                            <><UserX className="w-4 h-4 mr-2" /> Desativar</>
                          ) : (
                            <><UserCheck className="w-4 h-4 mr-2" /> Reativar</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteUser(user)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere os dados, função e departamentos do usuário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail (login de acesso)</Label>
              <Input value={editUser?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Supervisor</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamentos</Label>
              <div className="border border-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum departamento cadastrado</p>
                ) : (
                  departments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={editDeptIds.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          setEditDeptIds((prev) =>
                            checked ? [...prev, dept.id] : prev.filter((id) => id !== dept.id)
                          );
                        }}
                      />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Alterar senha (opcional)</Label>
              <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha atual.</p>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Nova senha (mín. 6 caracteres)"
              />
              <Input
                type="password"
                value={editPasswordConfirm}
                onChange={(e) => setEditPasswordConfirm(e.target.value)}
                placeholder="Confirmar nova senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteUser?.full_name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Usuários em Massa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> usuário{selectedIds.size > 1 ? "s" : ""}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : `Excluir ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Deactivate Dialog */}
      <Dialog open={bulkDeactivateOpen} onOpenChange={(open) => !open && setBulkDeactivateOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desativar Usuários em Massa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar <strong>{selectedIds.size}</strong> usuário{selectedIds.size > 1 ? "s" : ""}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeactivateOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDeactivate} disabled={deleting}>
              {deleting ? "Desativando..." : `Desativar ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reactivate Dialog */}
      <Dialog open={bulkReactivateOpen} onOpenChange={(open) => !open && setBulkReactivateOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reativar Usuários em Massa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reativar <strong>{selectedIds.size}</strong> usuário{selectedIds.size > 1 ? "s" : ""}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReactivateOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkReactivate} disabled={deleting}>
              {deleting ? "Reativando..." : `Reativar ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>O usuário será criado com a senha padrão <strong>CBMaq2026++</strong> e deverá alterá-la no primeiro acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-2">
              <Label>E-mail (login de acesso)</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Supervisor</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamentos</Label>
              <div className="border border-border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum departamento cadastrado</p>
                ) : (
                  departments.map((dept) => (
                    <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={newDeptIds.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          setNewDeptIds((prev) =>
                            checked ? [...prev, dept.id] : prev.filter((id) => id !== dept.id)
                          );
                        }}
                      />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersSettings;
