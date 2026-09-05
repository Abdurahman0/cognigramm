import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { toUser } from '@/api/adapters'
import { authApi, usersApi } from '@/api/endpoints'
import { setAuthToken } from '@/api/client'
import type { ApiError } from '@/api/client'
import {
  Button,
  Input,
  Label,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@/components/ui'
import { APP_NAME } from '@/lib/config'
import { useAuthStore } from '@/stores/auth'

const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
})

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(32, 'At most 32 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

function PasswordField({
  id,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; error?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 transition"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? <p className="text-destructive text-[13px]">{error}</p> : null}
    </div>
  )
}

export function AuthScreen() {
  const signIn = useAuthStore((state) => state.signIn)
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  })

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '' },
  })

  const login = useMutation({
    mutationFn: async (values: LoginValues) => {
      const { access_token } = await authApi.login(values)
      // The token has to be live before /users/me is called, and the store is
      // only updated once the profile confirms it.
      setAuthToken(access_token)
      const profile = await usersApi.me()
      return { token: access_token, user: toUser(profile) }
    },
    onSuccess: ({ token, user }) => signIn(token, user),
    onError: (error: ApiError) => {
      setAuthToken(null)
      toast.error(
        'Sign-in failed',
        error.status === 401 ? 'Wrong username or password.' : error.message,
      )
    },
  })

  const register = useMutation({
    mutationFn: async (values: RegisterValues) => {
      await authApi.register(values)
      const { access_token } = await authApi.login({
        identifier: values.username,
        password: values.password,
      })
      setAuthToken(access_token)
      const profile = await usersApi.me()
      return { token: access_token, user: toUser(profile) }
    },
    onSuccess: ({ token, user }) => {
      toast.success('Account created', `Welcome, ${user.fullName}.`)
      signIn(token, user)
    },
    onError: (error: ApiError) => {
      setAuthToken(null)
      toast.error('Registration failed', error.message)
    },
  })

  return (
    <div className="app-wallpaper flex h-full items-center justify-center p-8">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-6">
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-muted-foreground text-[13px]">
            {tab === 'login' ? 'Sign in to continue' : 'Create your workspace account'}
          </p>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as 'login' | 'register')}>
          <TabsList className="mb-5 w-full">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form
              className="space-y-4"
              onSubmit={loginForm.handleSubmit((values) => login.mutate(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Username or email</Label>
                <Input
                  id="identifier"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={Boolean(loginForm.formState.errors.identifier)}
                  {...loginForm.register('identifier')}
                />
                {loginForm.formState.errors.identifier ? (
                  <p className="text-destructive text-[13px]">
                    {loginForm.formState.errors.identifier.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <PasswordField
                  id="password"
                  autoComplete="current-password"
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
                {login.isPending ? <Spinner /> : <LogIn className="size-4" />}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form
              className="space-y-4"
              onSubmit={registerForm.handleSubmit((values) => register.mutate(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  aria-invalid={Boolean(registerForm.formState.errors.username)}
                  {...registerForm.register('username')}
                />
                {registerForm.formState.errors.username ? (
                  <p className="text-destructive text-[13px]">
                    {registerForm.formState.errors.username.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(registerForm.formState.errors.email)}
                  {...registerForm.register('email')}
                />
                {registerForm.formState.errors.email ? (
                  <p className="text-destructive text-[13px]">
                    {registerForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password">Password</Label>
                <PasswordField
                  id="new-password"
                  autoComplete="new-password"
                  error={registerForm.formState.errors.password?.message}
                  {...registerForm.register('password')}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
                {register.isPending ? <Spinner /> : <UserPlus className="size-4" />}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
