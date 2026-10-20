import { useState } from "react";
import { UserPlus, KeyRound } from "lucide-react";
import { api } from "../api/client";
import { useApiMutation, useApiQuery, useMeta } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Card, Button, Modal, Input, Select, Avatar, Badge, Loading, Toggle } from "../components/ui";
import { fmtDateTime } from "../lib/format";

const ROLE_TONE = { Admin: "bg-rose-50 text-rose-700 ring-rose-600/15", "Front Desk": "bg-sky-50 text-sky-700 ring-sky-600/15", Housekeeping: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", Restaurant: "bg-amber-50 text-amber-700 ring-amber-600/20" };

function UserDialog({ user, onClose }) {
  const { data: meta } = useMeta();
  const isNew = !user;
  const [f, setF] = useState({ name: user?.name || "", email: user?.email || "", role: user?.role || "Front Desk", password: "" });
  const m = useApiMutation((b) => (isNew ? api.post("/users", b) : api.patch(`/users/${user._id}`, b)), { success: isNew ? "User created" : "User updated", invalidate: ["users"], onSuccess: onClose });
  const submit = () => {
    const body = isNew ? f : { name: f.name, role: f.role, ...(f.password ? { password: f.password } : {}) };
    m.mutate(body);
  };
  return (
    <Modal open onClose={onClose} title={isNew ? "Add user" : `Edit ${user.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={submit}>{isNew ? "Create user" : "Save"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Email" type="email" required disabled={!isNew} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={meta.roles} />
        <Input label={isNew ? "Password" : "Reset password"} type="password" required={isNew} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint={isNew ? "At least 6 characters" : "Leave blank to keep current"} />
        <p className="text-xs text-slate-500 sm:col-span-2">Access: {meta.roleAccess[f.role]?.join(", ")}</p>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [dialog, setDialog] = useState(null);
  const { data, isLoading } = useApiQuery("users", "/users");
  const toggle = useApiMutation(({ id, active }) => api.patch(`/users/${id}`, { active }), { success: (u) => `${u.name} ${u.active ? "activated" : "deactivated"}`, invalidate: ["users"] });

  return (
    <>
      <PageHeader title="Users" subtitle="Staff accounts and their access" actions={<Button icon={UserPlus} onClick={() => setDialog("new")}>Add user</Button>} />
      <Card className="overflow-hidden">
        {isLoading ? <Loading /> : (
          <div className="table-scroll"><table className="table-base">
            <thead><tr><th>User</th><th className="hidden sm:table-cell">Role</th><th className="hidden lg:table-cell">Last sign-in</th><th>Active</th><th /></tr></thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u._id}>
                  <td><div className="flex min-w-0 items-center gap-3"><Avatar name={u.name} size="sm" className="hidden min-[420px]:inline-flex" /><div className="min-w-0"><p className="font-medium">{u.name}{u._id === me._id && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</p><p className="break-all text-xs text-slate-500">{u.email}</p><div className="mt-1 sm:hidden"><Badge className={ROLE_TONE[u.role]}>{u.role}</Badge></div></div></div></td>
                  <td className="hidden sm:table-cell"><Badge className={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                  <td className="hidden text-[13px] text-slate-500 lg:table-cell">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
                  <td><Toggle checked={u.active} onChange={(v) => u._id !== me._id && toggle.mutate({ id: u._id, active: v })} /></td>
                  <td className="text-right"><Button size="xs" variant="ghost" icon={KeyRound} onClick={() => setDialog(u)}><span className="hidden sm:inline">Edit</span></Button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>
      {dialog && <UserDialog user={dialog === "new" ? null : dialog} onClose={() => setDialog(null)} />}
    </>
  );
}
