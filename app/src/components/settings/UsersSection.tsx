import { Check, Minus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  useAdminStore,
  type UserRole,
} from '@/stores/admin';
import { SectionCard } from './shared';
import { validateEmail, validateText } from './validation';

function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, tx } = useT('settings');
  const users = useAdminStore((s) => s.users);
  const add = useAdminStore((s) => s.addUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = validateText(name, { required: true, max: 60 });
    const m = validateEmail(email);
    const next: typeof errors = {};
    if (!n.ok) next.name = tx(n.key, n.params);
    if (!m.ok) next.email = tx(m.key);
    else if (users.some((u) => u.email === m.value)) next.email = t('validation.emailTaken');
    setErrors(next);
    if (next.name || next.email || !n.ok || !m.ok) return;
    add({ name: String(n.value), email: m.value, role, active: true });
    onOpenChange(false);
    setName('');
    setEmail('');
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <DialogHeader>
          <DialogTitle>{t('users.addTitle')}</DialogTitle>
          <DialogDescription>{t('users.addDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="u-name" className="text-13 font-medium text-ink">
              {t('users.name')}
            </label>
            <Input
              id="u-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby="u-name-e"
              className={cn(errors.name && 'border-danger')}
            />
            <p id="u-name-e" className="text-xs text-danger-text" aria-live="polite">
              {errors.name}
            </p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="u-email" className="text-13 font-medium text-ink">
              {t('users.email')}
            </label>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby="u-email-e"
              className={cn(errors.email && 'border-danger')}
            />
            <p id="u-email-e" className="text-xs text-danger-text" aria-live="polite">
              {errors.email}
            </p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="u-role" className="text-13 font-medium text-ink">
              {t('users.role')}
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="u-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tx(`users.roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" variant="default">
              {t('users.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersSection() {
  const { t, tx } = useT('settings');
  const users = useAdminStore((s) => s.users);
  const update = useAdminStore((s) => s.updateUser);
  const remove = useAdminStore((s) => s.removeUser);
  const [open, setOpen] = useState(false);
  const admins = users.filter((u) => u.role === 'admin' && u.active).length;
  return (
    <div className="space-y-6">
      <SectionCard
        title={t('users.title')}
        description={t('users.desc')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <UserPlus aria-hidden="true" />
            {t('users.add')}
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-13">
            <caption className="sr-only">{t('users.title')}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-ink-2">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('users.name')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('users.role')}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t('users.status')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">{t('users.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-xs text-ink-3">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Select
                      value={u.role}
                      onValueChange={(v) => update(u.id, { role: v as UserRole })}
                    >
                      <SelectTrigger
                        className="h-8 w-[190px]"
                        aria-label={t('users.roleAria', { name: u.name })}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {tx(`users.roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <label className="inline-flex items-center gap-2">
                      <Switch
                        checked={u.active}
                        onCheckedChange={(v) => update(u.id, { active: v })}
                        aria-label={t('users.activeAria', { name: u.name })}
                      />
                      <span className={u.active ? 'text-ink' : 'text-ink-3'} aria-hidden="true">
                        {u.active ? t('users.active') : t('users.inactive')}
                      </span>
                    </label>
                  </td>
                  <td className="py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={u.role === 'admin' && u.active && admins <= 1}
                      onClick={() => remove(u.id)}
                      aria-label={t('users.removeAria', { name: u.name })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-3">{t('users.simulation')}</p>
      </SectionCard>

      <SectionCard title={t('users.matrixTitle')} description={t('users.matrixDesc')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-13">
            <caption className="sr-only">{t('users.matrixTitle')}</caption>
            <thead>
              <tr className="border-b border-border text-xs text-ink-2">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  {t('users.role')}
                </th>
                {PERMISSIONS.map((p) => (
                  <th key={p} scope="col" className="px-2 py-2 text-center font-medium">
                    {tx(`users.perm.${p}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {USER_ROLES.map((r) => (
                <tr key={r} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                    {tx(`users.roles.${r}`)}
                    {r === 'director' && (
                      <Badge variant="neutral" className="ml-2">
                        {t('users.topbarRole')}
                      </Badge>
                    )}
                  </th>
                  {PERMISSIONS.map((p) => {
                    const yes = ROLE_PERMISSIONS[r].includes(p);
                    return (
                      <td key={p} className="px-2 py-2 text-center">
                        {yes ? (
                          <Check
                            className="mx-auto size-4 text-success-text"
                            strokeWidth={2}
                            aria-label={t('users.allowed')}
                          />
                        ) : (
                          <Minus
                            className="mx-auto size-4 text-ink-3"
                            strokeWidth={1.75}
                            aria-label={t('users.denied')}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <AddUserDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
