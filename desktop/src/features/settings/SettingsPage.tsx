import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { toUser } from '@/api/adapters'
import { usersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import type { ApiUserStatus } from '@/api/types'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
  Separator,
  Spinner,
  initialsOf,
  toast,
} from '@/components/ui'
import { DeviceSessions } from '@/features/settings/DeviceSessions'
import { API_BASE_URL, WS_BASE_URL } from '@/lib/config'
import { isDesktopRuntime } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useSocketStatus } from '@/realtime/use-socket-status'
import { useAuthStore } from '@/stores/auth'
import { useUiStore, type ThemeMode } from '@/stores/ui'

const profileSchema = z.object({
  full_name: z.string().max(120).nullable(),
  title: z.string().max(120).nullable(),
  about: z.string().max(500).nullable(),
  phone: z.string().max(40).nullable(),
  timezone: z.string().max(64).nullable(),
})

type ProfileValues = z.infer<typeof profileSchema>

const STATUSES: { value: ApiUserStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_meeting', label: 'In a meeting' },
  { value: 'busy', label: 'Busy' },
  { value: 'on_break', label: 'On a break' },
  { value: 'remote', label: 'Remote' },
  { value: 'offline', label: 'Appear offline' },
]

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-faint-foreground text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const signOut = useAuthStore((state) => state.signOut)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const socketStatus = useSocketStatus()

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: user?.fullName ?? '',
      title: user?.title ?? '',
      about: user?.about ?? '',
      phone: user?.phone ?? '',
      timezone: user?.timezone ?? 'UTC',
    },
  })

  const saveProfile = useMutation({
    mutationFn: (values: ProfileValues) => usersApi.updateMe(values),
    onSuccess: (updated) => {
      setUser(toUser(updated))
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      toast.success('Profile saved')
    },
    onError: (error: Error) => toast.error('Could not save profile', error.message),
  })

  const saveStatus = useMutation({
    mutationFn: (status: ApiUserStatus) => usersApi.updateStatus(status),
    onSuccess: (updated) => setUser(toUser(updated)),
    onError: (error: Error) => toast.error('Could not update status', error.message),
  })

  if (!user) return null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-border/60 flex h-14 shrink-0 items-center border-b px-4">
        <h1 className="text-[15px] font-semibold">Settings</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-7 p-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-lg">{initialsOf(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold">{user.fullName}</p>
              <p className="text-muted-foreground truncate text-[13px]">
                @{user.username} · {user.email}
              </p>
            </div>
          </div>

          <Separator />

          <Section title="Profile">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={form.handleSubmit((values) => saveProfile.mutate(values))}
            >
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" {...form.register('full_name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Job title</Label>
                <Input id="title" {...form.register('title')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...form.register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" {...form.register('timezone')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="about">About</Label>
                <Input id="about" {...form.register('about')} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saveProfile.isPending || !form.formState.isDirty}>
                  {saveProfile.isPending ? <Spinner /> : <Check className="size-4" />}
                  Save changes
                </Button>
              </div>
            </form>
          </Section>

          <Section title="Status">
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={user.presence === value ? 'default' : 'secondary'}
                  size="sm"
                  disabled={saveStatus.isPending}
                  onClick={() => saveStatus.mutate(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="Appearance">
            <div className="flex gap-1.5">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme(value)}
                >
                  <Icon className="size-4" /> {label}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="Connection">
            <dl className="bg-input/60 space-y-1.5 rounded-xl p-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Runtime</dt>
                <dd>{isDesktopRuntime ? 'Tauri desktop' : 'Browser'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">API</dt>
                <dd className="truncate">{API_BASE_URL}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">WebSocket</dt>
                <dd className="truncate">{WS_BASE_URL}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Socket status</dt>
                <dd
                  className={cn(
                    socketStatus === 'connected' ? 'text-success' : 'text-warning',
                    'font-medium',
                  )}
                >
                  {socketStatus}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Devices">
            <DeviceSessions />
          </Section>

          <Separator />

          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/15"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
