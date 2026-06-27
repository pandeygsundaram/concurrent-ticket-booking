# Cinema Booking — React Native Guide V2

V2 adds real authentication to the app built in V1. By the end of this guide you'll have login, signup, Google OAuth, JWT stored securely, protected routes, and the user's identity flowing through every API call.

Read V1 first. This guide only covers what's new or changed.

---

## What V2 Adds

```
V1 had:
  - Hardcoded user_id in every request
  - No login, no auth

V2 adds:
  - Login screen
  - Signup screen
  - JWT stored in expo-secure-store (encrypted on-device)
  - Zustand auth store (global auth state)
  - Protected routes — redirect to login if no token
  - Google OAuth login
  - Real user_id from the JWT flows into all API calls
  - "My bookings" — confirmed seats belong to the current user
```

---

## New Dependencies

```bash
npx expo install expo-secure-store
npx expo install expo-web-browser expo-auth-session
npm install zustand
```

Why each one:
- `expo-secure-store` — encrypted key-value storage backed by Android Keystore / iOS Keychain. The only safe place for a JWT on mobile.
- `expo-web-browser` — opens a browser tab for Google OAuth
- `expo-auth-session` — handles the OAuth2 redirect flow in Expo
- `zustand` — lightweight global state for auth (token, user)

---

## Understanding Secure Storage

In V1 you had a hardcoded string as user_id. In V2 the user logs in, the backend returns a JWT, and you store that JWT. On the next app launch, you read the JWT back from storage and skip the login screen.

There are two storage options in Expo:

| Storage | Encrypted | Use for |
|---------|-----------|---------|
| `AsyncStorage` | No | Non-sensitive prefs: selected theme, last viewed movie |
| `expo-secure-store` | Yes | JWT, refresh tokens, anything sensitive |

```tsx
import * as SecureStore from 'expo-secure-store'

// Save token after login
await SecureStore.setItemAsync('jwt', token)

// Read token on app launch
const token = await SecureStore.getItemAsync('jwt')   // null if not set

// Delete on logout
await SecureStore.deleteItemAsync('jwt')
```

**Why not AsyncStorage for tokens?** AsyncStorage is unencrypted. On a rooted Android device, any app can read it. SecureStore is backed by hardware security on both platforms.

---

## Understanding Zustand

In V1 you had no global state — just local `useState` inside each screen. That's fine when screens don't need to share data. But in V2, every screen needs to know: is the user logged in? What's their ID?

Passing this down as props through every component is a nightmare. Zustand solves this with a global store — any component can read from it directly.

**Zustand is simpler than Redux.** No actions, no reducers, no dispatch. Just a plain object with setters:

```tsx
import { create } from 'zustand'

// Define the store shape
interface AuthStore {
  token:    string | null
  userId:   string | null
  email:    string | null
  setAuth:  (token: string, userId: string, email: string) => void
  logout:   () => void
}

// Create the store
export const useAuthStore = create<AuthStore>((set) => ({
  token:   null,
  userId:  null,
  email:   null,

  setAuth: (token, userId, email) => set({ token, userId, email }),

  logout: () => set({ token: null, userId: null, email: null }),
}))
```

**Reading from any component:**

```tsx
// In any screen or component — no props needed
const token  = useAuthStore(s => s.token)
const userId = useAuthStore(s => s.userId)
const logout = useAuthStore(s => s.logout)
```

**Writing to the store:**

```tsx
const setAuth = useAuthStore(s => s.setAuth)

// After a successful login
setAuth(token, userId, email)
```

When you call `setAuth`, every component using `useAuthStore` automatically re-renders with the new values. That's Zustand's reactivity.

---

## Updated Folder Structure

```
app/
  _layout.tsx         ← updated: auth check + redirect
  index.tsx           ← unchanged: redirects
  onboarding.tsx      ← unchanged
  login.tsx           ← NEW
  signup.tsx          ← NEW
  (app)/
    _layout.tsx       ← NEW: protected tab layout
    booking.tsx       ← moved here from app root
src/
  lib/
    api.ts            ← updated: reads token from store
    auth.ts           ← NEW: auth API calls
  stores/
    auth.ts           ← NEW: Zustand auth store
  hooks/
    useBootstrap.ts   ← NEW: reads token from SecureStore on launch
```

---

## Step 1 — Auth Store

Create `src/stores/auth.ts`:

```tsx
import { create } from 'zustand'

interface AuthStore {
  token:       string | null
  userId:      string | null
  email:       string | null
  isReady:     boolean        // false until we've checked SecureStore on launch
  setAuth:     (token: string, userId: string, email: string) => void
  setReady:    () => void
  logout:      () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  token:    null,
  userId:   null,
  email:    null,
  isReady:  false,

  setAuth:  (token, userId, email) => set({ token, userId, email }),
  setReady: ()                     => set({ isReady: true }),
  logout:   ()                     => set({ token: null, userId: null, email: null }),
}))
```

**`isReady`** — on app launch you need to check SecureStore before deciding where to route the user. While that check is running, `isReady` is false and you show a loading spinner. Once done (token found or not), set `isReady: true` and let the router decide.

---

## Step 2 — JWT Parsing

After login the backend returns a JWT. You need the user's ID and email from it without making another API call. JWTs store this in the **payload** — the middle section.

```tsx
// src/lib/jwt.ts
interface JwtPayload {
  sub:   string    // user ID
  email: string
  role:  string
  exp:   number
}

export function parseJwt(token: string): JwtPayload {
  const base64 = token.split('.')[1]
  const decoded = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decoded)
}
```

This does NOT verify the signature — only your server does that. You're just reading the claims to get the user's ID. This is safe because the server already verified the token when it issued it. If someone tampers with the payload, the next API call will be rejected.

---

## Step 3 — Bootstrap Hook

On every app launch, check SecureStore for a saved token:

`src/hooks/useBootstrap.ts`:

```tsx
import { useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../stores/auth'
import { parseJwt } from '../lib/jwt'

export function useBootstrap() {
  const { setAuth, setReady } = useAuthStore()

  useEffect(() => {
    async function check() {
      try {
        const token = await SecureStore.getItemAsync('jwt')
        if (token) {
          const { sub, email } = parseJwt(token)
          setAuth(token, sub, email)
        }
      } catch {
        // Token missing or malformed — stay logged out
      } finally {
        setReady()   // always mark ready so routing can proceed
      }
    }
    check()
  }, [])
}
```

---

## Step 4 — Updated Root Layout

`app/_layout.tsx` now:
1. Calls `useBootstrap` to load the token from SecureStore
2. Shows a spinner while loading
3. Redirects based on auth state

```tsx
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../src/stores/auth'
import { useBootstrap } from '../src/hooks/useBootstrap'

const queryClient = new QueryClient()

export default function RootLayout() {
  useBootstrap()
  const { isReady, token } = useAuthStore()

  useEffect(() => {
    if (!isReady) return

    if (token) {
      router.replace('/(app)/booking')
    } else {
      router.replace('/onboarding')
    }
  }, [isReady, token])

  if (!isReady) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
```

**Why `useEffect` for routing?** Expo Router's `router` can't be called during render — only in effects or event handlers.

---

## Step 5 — Protected Layout

Create `app/(app)/_layout.tsx`. The `(app)` group wraps all authenticated screens. Any screen inside this group gets the auth check automatically.

```tsx
import { useEffect } from 'react'
import { Tabs, router } from 'expo-router'
import { useAuthStore } from '../../src/stores/auth'

export default function AppLayout() {
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    if (!token) {
      router.replace('/login')
    }
  }, [token])

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#111' } }}>
      <Tabs.Screen name="booking" options={{ title: 'Book Seats' }} />
    </Tabs>
  )
}
```

When the user logs out (`logout()` clears the token), this `useEffect` fires, sees `token` is null, and redirects to `/login`. Every screen inside `(app)/` is automatically protected.

---

## Step 6 — Auth API

`src/lib/auth.ts` — the API calls for login/signup:

```tsx
const BASE_URL = 'http://10.0.2.2:8080'   // Android emulator

export interface AuthResponse {
  token: string
}

export async function signup(email: string, password: string, name: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, name }),
  })
  if (res.status === 409) throw new Error('Email already registered')
  if (!res.ok)            throw new Error('Signup failed')
  return res.json()
}

export async function signin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/signin`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  })
  if (res.status === 401) throw new Error('Invalid email or password')
  if (!res.ok)            throw new Error('Login failed')
  return res.json()
}

export async function getGoogleAuthUrl(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/google/url`)
  const data = await res.json()
  return data.url
}

export async function googleCallback(code: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/google/callback`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error('Google auth failed')
  return res.json()
}
```

---

## Step 7 — Updated API Client

`src/lib/api.ts` now reads the token from the Zustand store:

```tsx
import { useAuthStore } from '../stores/auth'

function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token   // .getState() reads outside a component
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
}

export async function listSeats(movieId: string): Promise<Seat[]> {
  const res = await fetch(`${BASE_URL}/movies/${movieId}/seats`, {
    headers: getAuthHeader(),
  })
  if (res.status === 401) {
    // Token expired or invalid — log out
    useAuthStore.getState().logout()
    throw new Error('Session expired')
  }
  if (!res.ok) throw new Error('Failed to fetch seats')
  return buildSeatGrid(movieId, await res.json())
}

export async function holdSeat(movieId: string, seatId: string): Promise<Booking> {
  // No longer sending user_id — the server reads it from the JWT
  const res = await fetch(`${BASE_URL}/movies/${movieId}/seats/${seatId}/hold`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body:    JSON.stringify({}),   // empty body — user_id comes from JWT now
  })
  if (res.status === 409) throw new Error('Seat already taken')
  if (!res.ok)            throw new Error('Failed to hold seat')
  return res.json()
}
// ... confirm and release stay the same but add getAuthHeader()
```

**`useAuthStore.getState()`** — this is how you read Zustand state outside of a React component. Inside a component you use the hook (`useAuthStore(s => s.token)`). In a plain function like `getAuthHeader`, use `.getState()`.

---

## Step 8 — Login Screen

`app/login.tsx`:

```tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useMutation } from '@tanstack/react-query'
import { signin } from '../src/lib/auth'
import { useAuthStore } from '../src/stores/auth'
import { parseJwt } from '../src/lib/jwt'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const setAuth = useAuthStore(s => s.setAuth)

  const loginMutation = useMutation({
    mutationFn: () => signin(email, password),
    onSuccess: async ({ token }) => {
      // 1. Save to SecureStore so it survives app restarts
      await SecureStore.setItemAsync('jwt', token)
      // 2. Put in Zustand so all components can read it immediately
      const { sub, email: userEmail } = parseJwt(token)
      setAuth(token, sub, userEmail)
      // 3. Navigate — the (app)/_layout.tsx will see token is set
      router.replace('/(app)/booking')
    },
    onError: (err: Error) => Alert.alert('Login failed', err.message),
  })

  return (
    <View className="flex-1 bg-black px-6 pt-16">
      <Text className="text-white text-3xl font-bold mb-2">Welcome back</Text>
      <Text className="text-gray-400 mb-10">Sign in to continue</Text>

      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-4 text-base"
        placeholder="Email"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-8 text-base"
        placeholder="Password"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        onPress={() => loginMutation.mutate()}
        disabled={loginMutation.isPending}
        className="bg-white rounded-xl py-4 items-center mb-4"
      >
        <Text className="text-black font-bold text-base">
          {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
        </Text>
      </Pressable>

      <GoogleSignInButton />

      <Pressable onPress={() => router.push('/signup')} className="mt-6 items-center">
        <Text className="text-gray-400">
          Don't have an account? <Text className="text-white font-bold">Sign up</Text>
        </Text>
      </Pressable>
    </View>
  )
}
```

---

## Step 9 — Signup Screen

`app/signup.tsx` — same pattern as login but calls `signup`:

```tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useMutation } from '@tanstack/react-query'
import { signup } from '../src/lib/auth'
import { useAuthStore } from '../src/stores/auth'
import { parseJwt } from '../src/lib/jwt'

export default function Signup() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const setAuth = useAuthStore(s => s.setAuth)

  const signupMutation = useMutation({
    mutationFn: () => signup(email, password, name),
    onSuccess: async ({ token }) => {
      await SecureStore.setItemAsync('jwt', token)
      const { sub, email: userEmail } = parseJwt(token)
      setAuth(token, sub, userEmail)
      router.replace('/(app)/booking')
    },
    onError: (err: Error) => Alert.alert('Signup failed', err.message),
  })

  return (
    <View className="flex-1 bg-black px-6 pt-16">
      <Text className="text-white text-3xl font-bold mb-2">Create account</Text>
      <Text className="text-gray-400 mb-10">Join to start booking</Text>

      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-4 text-base"
        placeholder="Your name"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-4 text-base"
        placeholder="Email"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="bg-gray-900 text-white rounded-xl px-4 py-4 mb-8 text-base"
        placeholder="Password (min 8 characters)"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        onPress={() => signupMutation.mutate()}
        disabled={signupMutation.isPending}
        className="bg-white rounded-xl py-4 items-center mb-4"
      >
        <Text className="text-black font-bold text-base">
          {signupMutation.isPending ? 'Creating account...' : 'Create Account'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()} className="mt-6 items-center">
        <Text className="text-gray-400">
          Already have an account? <Text className="text-white font-bold">Sign in</Text>
        </Text>
      </Pressable>
    </View>
  )
}
```

---

## Step 10 — Google OAuth

Google OAuth on mobile is different from web. The flow is:

```
1. Your backend generates the Google auth URL
2. App opens that URL in an in-app browser tab
3. User signs in with Google
4. Google redirects to your backend's callback URL
5. Backend exchanges the code, creates/finds the user, returns JWT
6. App receives the JWT and stores it
```

The tricky part is step 4→6. On mobile, after Google redirects, you need to catch that redirect. `expo-auth-session` handles this.

### `src/components/GoogleSignInButton.tsx`

```tsx
import { Pressable, Text, Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../stores/auth'
import { getGoogleAuthUrl, googleCallback } from '../lib/auth'
import { parseJwt } from '../lib/jwt'
import { router } from 'expo-router'

WebBrowser.maybeCompleteAuthSession()   // required for expo-web-browser

export function GoogleSignInButton() {
  const setAuth = useAuthStore(s => s.setAuth)

  async function handleGoogleLogin() {
    try {
      // 1. Get the auth URL from your backend
      const authUrl = await getGoogleAuthUrl()

      // 2. Open it in a browser, wait for the redirect
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'cinema://auth/google/callback'   // your app's deep link scheme
      )

      if (result.type !== 'success') return   // user cancelled

      // 3. Extract the code from the redirect URL
      const url   = new URL(result.url)
      const code  = url.searchParams.get('code')
      if (!code) throw new Error('No code in redirect')

      // 4. Send code to backend, get JWT
      const { token } = await googleCallback(code)

      // 5. Save and set auth state
      await SecureStore.setItemAsync('jwt', token)
      const { sub, email } = parseJwt(token)
      setAuth(token, sub, email)
      router.replace('/(app)/booking')

    } catch (err: any) {
      Alert.alert('Google sign in failed', err.message)
    }
  }

  return (
    <Pressable
      onPress={handleGoogleLogin}
      className="bg-gray-900 border border-gray-700 rounded-xl py-4 flex-row items-center justify-center gap-3"
    >
      <Text className="text-white text-2xl">G</Text>
      <Text className="text-white font-semibold text-base">Continue with Google</Text>
    </Pressable>
  )
}
```

**Deep link scheme** — you need to register `cinema://` as your app's URL scheme so the OS knows to open your app when Google redirects to `cinema://auth/google/callback`. Add this to `app.json`:

```json
{
  "expo": {
    "scheme": "cinema"
  }
}
```

---

## Step 11 — Logout

Add a logout button wherever makes sense (profile tab, or a button in the booking screen header):

```tsx
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../src/stores/auth'
import { useQueryClient } from '@tanstack/react-query'

function LogoutButton() {
  const logout      = useAuthStore(s => s.logout)
  const queryClient = useQueryClient()

  async function handleLogout() {
    await SecureStore.deleteItemAsync('jwt')   // delete from device storage
    queryClient.clear()                         // clear all cached query data
    logout()                                    // clear Zustand store → triggers redirect
  }

  return (
    <Pressable onPress={handleLogout} className="px-4 py-2">
      <Text className="text-red-400">Logout</Text>
    </Pressable>
  )
}
```

After `logout()` clears the token, the `useEffect` in `app/(app)/_layout.tsx` sees `token === null` and redirects to `/login`.

---

## Screen Flow Summary

```
App launch
  ↓
_layout.tsx → useBootstrap → reads SecureStore
  ↓
Token found?
  YES → setAuth() → router.replace('/(app)/booking')
  NO  → router.replace('/onboarding')

Onboarding → "Get Started" → /login

Login screen
  → email/password → POST /auth/signin → token → store → /(app)/booking
  → Google button  → browser → Google → redirect → POST /auth/google/callback → token → store → /(app)/booking
  → "Sign up" link → /signup

Signup → POST /auth/signup → token → store → /(app)/booking

(app)/booking
  → same as V1 but now uses real user_id from JWT
  → logout button → clear token → redirect to /login
```

---

## What Changed in the Booking Screen

Only one thing changes in `app/(app)/booking.tsx` — remove the hardcoded `TEMP_USER_ID`. The API now sends no `user_id` in the request body. The server reads it from the JWT.

Everything else (query, mutations, sheet, grid) stays exactly the same as V1.

---

## V2 Checklist

```
[ ] expo-secure-store, zustand, expo-web-browser installed
[ ] src/stores/auth.ts — Zustand store with token, userId, isReady
[ ] src/lib/jwt.ts — parseJwt helper
[ ] src/hooks/useBootstrap.ts — reads token from SecureStore on launch
[ ] app/_layout.tsx — calls useBootstrap, shows spinner until isReady
[ ] app/(app)/_layout.tsx — protected layout, redirects if no token
[ ] src/lib/auth.ts — signup, signin, getGoogleAuthUrl, googleCallback
[ ] src/lib/api.ts — reads token from Zustand, handles 401
[ ] app/login.tsx — email/password + Google button
[ ] app/signup.tsx — name/email/password form
[ ] Google Sign In Button — opens browser, exchanges code, saves token
[ ] app.json — scheme: "cinema" for deep links
[ ] Logout — clears SecureStore + Zustand + query cache
[ ] Hold/confirm/release all work with real JWT user_id
[ ] Token survives app restart (stored in SecureStore)
[ ] Expired/invalid token → automatic redirect to login
```

---

## Key Concepts You Used In V2

**Zustand** — global state outside React's component tree. Any component reads directly via `useAuthStore(s => s.token)`. Mutations update every subscriber automatically.

**`useAuthStore.getState()`** — read Zustand state outside a component (in a plain function). Inside a component, always use the hook.

**`expo-secure-store`** — hardware-backed encrypted storage. Think of it as a safe deposit box on the device. Survives app restarts, wiped on app uninstall.

**JWT payload parsing** — the middle section of a JWT is just base64-encoded JSON. You can read the user's ID and email from it without making an API call. You don't need to verify it client-side — that's the server's job.

**`isReady` pattern** — before showing any screen, wait for the async token check to complete. Without this, you'd briefly flash the login screen even if the user is already logged in.

**Deep linking** — mobile apps can register URL schemes (`cinema://`). When a browser navigates to `cinema://something`, the OS opens your app and passes the URL. This is how OAuth redirects work on mobile.

**`queryClient.clear()`** — clears all cached data on logout so the next user's login doesn't see stale data from the previous session.
