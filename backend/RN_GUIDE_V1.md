# Cinema Booking — React Native Guide V1

This is the frontend guide for the cinema seat booking app. V1 covers everything you need to build the core booking flow without auth. You'll use a hardcoded user ID for now — V2 adds real login.

---

## What V1 Builds

Two screens, one complete flow:

```
Screen 1: Onboarding (2-page carousel)
  Page 1 → Welcome / app intro
  Page 2 → Features / how it works
  → "Get Started" button → goes to Screen 2

Screen 2: Seat Booking
  → Grid of seats (colors show available / held / confirmed)
  → Tap an available seat → holds it (POST /hold)
  → Bottom sheet slides up → "Confirm" or "Cancel"
  → Confirm → seat turns confirmed color
  → Tap a confirmed seat (yours) → bottom sheet with "Release"
  → Release → seat returns to available
```

No login. No JWT. The backend gets a hardcoded `user_id` string for now.

---

## Tech Stack for V1

| What | Why |
|------|-----|
| Expo + React Native | The foundation |
| TypeScript | Catch bugs at compile time |
| Expo Router | File-based navigation — screens are files |
| NativeWind | Tailwind utility classes in React Native |
| TanStack Query | Fetches and caches seat data, handles loading/error |
| Zustand | Global app state — onboarding flag, selected movie |
| AsyncStorage | Persists state across app restarts (non-sensitive) |
| @gorhom/bottom-sheet | The sliding confirmation sheet |
| react-native-gesture-handler | Required by bottom-sheet |
| react-native-reanimated | Required by bottom-sheet and animations |

---

## Project Setup

### Create the app

```bash
npx create-expo-app cinema-mobile --template blank-typescript
cd cinema-mobile
```

### Install dependencies

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install react-native-gesture-handler react-native-reanimated
npx expo install @tanstack/react-query
npx expo install nativewind tailwindcss@3.4.17
npx expo install @react-native-async-storage/async-storage
npm install @gorhom/bottom-sheet zustand
```

### Set up Expo Router

Update `package.json` main field:

```json
"main": "expo-router/entry"
```

Update `app.json`:

```json
{
  "expo": {
    "name": "Cinema",
    "slug": "cinema",
    "scheme": "cinema",
    "web": { "bundler": "metro" }
  }
}
```

### Set up NativeWind

Create `tailwind.config.js`:

```js
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Create `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

Create `global.css` (empty, just needed by NativeWind):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Folder structure

```
cinema-mobile/
  app/
    _layout.tsx          ← root layout + bootstrap logic
    index.tsx            ← redirects based on onboarding state
    onboarding.tsx       ← Screen 1: 2-page carousel
    movies.tsx           ← Screen 2: movie picker
    seats.tsx            ← Screen 3: seat grid for selected movie
  src/
    stores/
      appStore.ts        ← Zustand store (onboarding, selectedMovie)
    lib/
      api.ts             ← all API calls
    components/
      SeatGrid.tsx       ← the seat grid component
      SeatCell.tsx       ← individual seat tile
      BookingSheet.tsx   ← bottom sheet component
    types/
      index.ts           ← shared TypeScript types
    data/
      movies.ts          ← static movie list from movies.json
  tailwind.config.js
  babel.config.js
  global.css
  nativewind-env.d.ts    ← fixes className TypeScript errors
```

---

## Understanding Expo Router

Before writing screens, understand how Expo Router works.

Every file inside `app/` becomes a route:

```
app/index.tsx       →  "/"
app/onboarding.tsx  →  "/onboarding"
app/booking.tsx     →  "/booking"
```

A `_layout.tsx` file wraps all sibling routes. The root `_layout.tsx` wraps the entire app — this is where you put global providers.

**Navigation works like this:**

```tsx
import { router } from 'expo-router'

// Go to a screen
router.push('/booking')

// Replace current screen (no back button)
router.replace('/booking')

// Go back
router.back()
```

Or with a link component:

```tsx
import { Link } from 'expo-router'
<Link href="/booking">Go to Booking</Link>
```

---

## Understanding Zustand

Every screen in your app needs to know two things at minimum:
- Has the user completed onboarding?
- Which movie did they pick?

Without Zustand you'd pass these as props through every component, or use React Context. Both get messy. Zustand gives you a global store — any component reads from it directly, no prop drilling.

Zustand is just a plain object with setters:

```tsx
// You define what the store holds and how to change it
const useAppStore = create((set) => ({
  onboardingComplete: false,
  setOnboardingComplete: () => set({ onboardingComplete: true }),
}))

// Any component reads it like this — no props needed
const done = useAppStore(s => s.onboardingComplete)
```

When `setOnboardingComplete()` is called, every component using the store re-renders with the new value automatically.

### Persist middleware

Zustand's `persist` middleware automatically saves state to AsyncStorage and reloads it on the next app launch. You don't manually call `AsyncStorage.setItem` — Zustand does it for you whenever state changes.

```tsx
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

const useAppStore = create(
  persist(
    (set) => ({
      onboardingComplete: false,
      setOnboardingComplete: () => set({ onboardingComplete: true }),
    }),
    {
      name: 'app-storage',                          // AsyncStorage key
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
```

On first launch: `onboardingComplete` is `false` (default).
After user finishes onboarding: `setOnboardingComplete()` sets it `true` and Zustand writes to AsyncStorage.
On next launch: Zustand reads AsyncStorage, hydrates the store with `true` — onboarding is skipped.

### isReady — wait for hydration

AsyncStorage is async. When the app starts, Zustand needs a moment to read from AsyncStorage before you know the real state. If you route immediately, you'd briefly flash the wrong screen.

The pattern: keep an `isReady` flag (not persisted) that starts as `false`. Zustand sets it to `true` after hydration via `onRehydrateStorage`. While `isReady` is false, show a loading spinner. Then route based on the actual state.

---

## App Store

`src/stores/appStore.ts` — write this yourself:

```tsx
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Define the Movie type (matches your movies.json shape)
export interface Movie {
  title:     string
  id:        number
  poster:    string   // local filename e.g. "interstellar.jpg"
  posterUrl: string   // full TMDB URL
  year:      string
}

interface AppStore {
  // Persisted — survives app restarts
  onboardingComplete: boolean
  selectedMovie:      Movie | null

  // Not persisted — recomputed on each launch
  isReady: boolean

  // Setters
  setOnboardingComplete: () => void
  setSelectedMovie:      (movie: Movie) => void
  setReady:              () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      selectedMovie:      null,
      isReady:            false,

      setOnboardingComplete: () => set({ onboardingComplete: true }),
      setSelectedMovie:      (movie) => set({ selectedMovie: movie }),
      setReady:              () => set({ isReady: true }),
    }),
    {
      name:    'cinema-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        selectedMovie:      state.selectedMovie,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setReady()    // called after AsyncStorage is read
      },
    }
  )
)
```

**`partialize`** — tells Zustand which keys to persist. `isReady` is excluded because it's always `false` on launch and gets set after hydration.

**`onRehydrateStorage`** — a callback that fires once AsyncStorage has been read. You call `setReady()` here so the layout knows hydration is done.

---

## Root Layout

`app/_layout.tsx` wraps everything. It now does three jobs:
1. Provides TanStack Query to the whole app
2. Waits for Zustand to hydrate from AsyncStorage
3. Routes to onboarding or movies based on `onboardingComplete`

```tsx
import '../global.css'
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '../src/stores/appStore'

const queryClient = new QueryClient()

export default function RootLayout() {
  const isReady            = useAppStore(s => s.isReady)
  const onboardingComplete = useAppStore(s => s.onboardingComplete)

  useEffect(() => {
    if (!isReady) return   // wait for AsyncStorage hydration

    if (onboardingComplete) {
      router.replace('/movies')
    } else {
      router.replace('/onboarding')
    }
  }, [isReady, onboardingComplete])

  // Show spinner while Zustand reads AsyncStorage
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

**`isReady` pattern** — without this guard, the app would briefly flash the wrong screen on every launch before Zustand finishes reading AsyncStorage. Always wait for hydration before routing.

---

## Types

`src/types/index.ts`:

```tsx
export type SeatStatus = 'available' | 'held' | 'confirmed'

export interface Seat {
  seat_id:    string
  status:     SeatStatus
  booking_id: string | null   // session_id from the hold response
}

export interface Booking {
  id:         string    // this is the session_id you'll need to confirm/release
  movie_id:   string
  seat_id:    string
  user_id:    string
  status:     'Held' | 'Confirmed'
  expires_at: string | null
}
```

---

## API Layer

`src/lib/api.ts` is where all HTTP calls live. No component should ever call `fetch` directly — they all go through here. This makes it easy to change the base URL or add auth headers later.

```tsx
const BASE_URL = 'http://localhost:8080'

// The hardcoded user ID — replaced with JWT claims in V2
const TEMP_USER_ID = 'user-123'

export async function listSeats(movieId: string): Promise<Seat[]> {
  const res = await fetch(`${BASE_URL}/movies/${movieId}/seats`)
  if (!res.ok) throw new Error('Failed to fetch seats')
  const bookings: Booking[] = await res.json()

  // The backend returns booked seats only. You need to generate
  // the full seat list and mark which ones are taken.
  return buildSeatGrid(movieId, bookings)
}

export async function holdSeat(movieId: string, seatId: string): Promise<Booking> {
  const res = await fetch(`${BASE_URL}/movies/${movieId}/seats/${seatId}/hold`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ user_id: TEMP_USER_ID }),
  })
  if (res.status === 409) throw new Error('Seat already taken')
  if (!res.ok)            throw new Error('Failed to hold seat')
  return res.json()
}

export async function confirmSeat(movieId: string, seatId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/movies/${movieId}/seats/${seatId}/confirm`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ session_id: sessionId }),
  })
  if (!res.ok) throw new Error('Failed to confirm seat')
}

export async function releaseSeat(movieId: string, seatId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/movies/${movieId}/seats/${seatId}/release`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ session_id: sessionId }),
  })
  if (!res.ok) throw new Error('Failed to release seat')
}

// Helper: generate a full 10x10 seat grid, mark booked ones
function buildSeatGrid(movieId: string, bookings: Booking[]): Seat[] {
  const rows = ['A','B','C','D','E','F','G','H','I','J']
  const bookedMap = new Map(bookings.map(b => [b.seat_id, b]))
  
  return rows.flatMap(row =>
    Array.from({ length: 10 }, (_, i) => {
      const seatId  = `${row}${i + 1}`
      const booking = bookedMap.get(seatId)
      return {
        seat_id:    seatId,
        status:     booking ? (booking.status === 'Confirmed' ? 'confirmed' : 'held') : 'available',
        booking_id: booking?.id ?? null,
      } as Seat
    })
  )
}
```

---

## Understanding TanStack Query

Before writing the seat screen, understand what TanStack Query does.

Fetching data manually with `useEffect` looks like this:

```tsx
// Manual approach — you write all this yourself
const [seats, setSeats]     = useState<Seat[]>([])
const [loading, setLoading] = useState(true)
const [error, setError]     = useState<Error | null>(null)

useEffect(() => {
  setLoading(true)
  listSeats('movie-1')
    .then(setSeats)
    .catch(setError)
    .finally(() => setLoading(false))
}, [])
```

TanStack Query collapses this to:

```tsx
const { data: seats, isLoading, error } = useQuery({
  queryKey: ['seats', 'movie-1'],    // cache key — same key = same cache
  queryFn:  () => listSeats('movie-1'),
})
```

That's it. Loading state, error state, caching, background refetch — all handled.

**`queryKey`** is how Query identifies cached data. `['seats', 'movie-1']` and `['seats', 'movie-2']` are two separate cache entries. When you invalidate `['seats', 'movie-1']`, only that one refetches.

**`useMutation`** is for POST/PUT/DELETE:

```tsx
const holdMutation = useMutation({
  mutationFn: ({ seatId }: { seatId: string }) => holdSeat('movie-1', seatId),
  onSuccess: () => {
    // Invalidate the seat list so it refetches
    queryClient.invalidateQueries({ queryKey: ['seats', 'movie-1'] })
  },
  onError: (err) => {
    alert(err.message)
  },
})

// Call it
holdMutation.mutate({ seatId: 'A1' })
```

`onSuccess` is where you tell Query "this mutation changed data — go refetch it." `invalidateQueries` marks the cached data as stale and triggers a refetch.

---

## Screen 1: Onboarding

`app/onboarding.tsx` — local `useState` for the page index is fine here since it's purely UI state within this screen. What changes is the "Get Started" action — instead of just navigating, it now writes to the Zustand store so the app remembers onboarding is done.

```tsx
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useAppStore } from '../src/stores/appStore'

const PAGES = [
  {
    title:    'Welcome to CinemaBook',
    subtitle: 'Book your favorite movie seats in seconds',
    emoji:    '🎬',
  },
  {
    title:    'Real-time availability',
    subtitle: 'See live seat status. Hold a seat, confirm when ready.',
    emoji:    '🎫',
  },
]

export default function Onboarding() {
  const [page, setPage]        = useState(0)
  const setOnboardingComplete  = useAppStore(s => s.setOnboardingComplete)
  const isLast                 = page === PAGES.length - 1

  function handleNext() {
    if (isLast) {
      setOnboardingComplete()          // writes to AsyncStorage via Zustand persist
      router.replace('/movies')
    } else {
      setPage(p => p + 1)
    }
  }

  return (
    <View className="flex-1 bg-black items-center justify-center px-8">
      <Text className="text-6xl mb-8">{PAGES[page].emoji}</Text>
      <Text className="text-white text-3xl font-bold text-center mb-4">
        {PAGES[page].title}
      </Text>
      <Text className="text-gray-400 text-lg text-center mb-16">
        {PAGES[page].subtitle}
      </Text>

      <View className="flex-row gap-2 mb-12">
        {PAGES.map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${i === page ? 'w-6 bg-white' : 'w-2 bg-gray-600'}`}
          />
        ))}
      </View>

      <Pressable
        className="bg-white rounded-2xl px-12 py-4 w-full items-center"
        onPress={handleNext}
      >
        <Text className="text-black font-bold text-lg">
          {isLast ? 'Get Started' : 'Next'}
        </Text>
      </Pressable>
    </View>
  )
}
```

**What changed from the old version:**
- `setOnboardingComplete()` is called before navigating — Zustand writes `true` to AsyncStorage automatically
- Next time the app opens, `_layout.tsx` reads `onboardingComplete: true` and skips onboarding entirely
- `useState` for `page` is still fine — that's local UI state, not global app state

---

## Screen 2: Movie Picker

`app/movies.tsx` — shows the movie list. When the user taps a movie, set it in the store and navigate to the seats screen.

```tsx
import { FlatList, View, Text, Pressable, Image } from 'react-native'
import { router } from 'expo-router'
import { useAppStore } from '../src/stores/appStore'
import { MOVIES } from '../src/data/movies'

export default function Movies() {
  const setSelectedMovie = useAppStore(s => s.setSelectedMovie)

  function handleMoviePress(movie) {
    setSelectedMovie(movie)       // into Zustand — seats screen reads it from there
    router.push('/seats')
  }

  return (
    <View className="flex-1 bg-black">
      <View className="px-4 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Now Showing</Text>
      </View>
      <FlatList
        data={MOVIES}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerClassName="px-2 pb-8"
        renderItem={({ item }) => (
          <Pressable
            className="flex-1 m-2 rounded-xl overflow-hidden"
            onPress={() => handleMoviePress(item)}
          >
            <Image
              source={{ uri: item.posterUrl }}
              className="w-full h-64"
              resizeMode="cover"
            />
            <View className="p-2 bg-gray-900">
              <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-gray-400 text-xs">{item.year}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}
```

**`src/data/movies.ts`** — import your `movies.json` and export it typed:

```tsx
import rawMovies from '../../movies.json'
import { Movie } from '../stores/appStore'

export const MOVIES: Movie[] = rawMovies
```

---

## Screen 3: Seat Booking

This screen has two parts: the seat grid and the bottom sheet. Build them as separate components.

### `src/components/SeatCell.tsx`

Each seat is a pressable tile. Color depends on status.

```tsx
import { Pressable, Text } from 'react-native'
import { Seat } from '../types'

interface Props {
  seat:    Seat
  onPress: (seat: Seat) => void
}

const STATUS_COLORS = {
  available: 'bg-gray-700 border-gray-600',
  held:      'bg-yellow-600 border-yellow-500',
  confirmed: 'bg-green-700 border-green-600',
}

export function SeatCell({ seat, onPress }: Props) {
  const colorClass = STATUS_COLORS[seat.status]
  const isDisabled = seat.status === 'held'   // held by someone else — can't tap

  return (
    <Pressable
      disabled={isDisabled}
      onPress={() => onPress(seat)}
      className={`m-1 w-8 h-8 rounded items-center justify-center border ${colorClass} ${isDisabled ? 'opacity-40' : ''}`}
    >
      <Text className="text-white text-xs">{seat.seat_id}</Text>
    </Pressable>
  )
}
```

### `src/components/SeatGrid.tsx`

Renders all seats in a scrollable grid grouped by row.

```tsx
import { ScrollView, View, Text } from 'react-native'
import { Seat } from '../types'
import { SeatCell } from './SeatCell'

interface Props {
  seats:   Seat[]
  onPress: (seat: Seat) => void
}

export function SeatGrid({ seats, onPress }: Props) {
  // Group seats by row letter
  const rows = seats.reduce<Record<string, Seat[]>>((acc, seat) => {
    const row = seat.seat_id[0]
    if (!acc[row]) acc[row] = []
    acc[row].push(seat)
    return acc
  }, {})

  return (
    <ScrollView className="flex-1">
      {/* Screen indicator */}
      <View className="mx-8 mb-8 py-2 bg-gray-700 rounded items-center">
        <Text className="text-gray-300 text-sm">SCREEN</Text>
      </View>

      {Object.entries(rows).map(([rowLetter, rowSeats]) => (
        <View key={rowLetter} className="flex-row items-center mb-2 px-4">
          <Text className="text-gray-500 w-6 text-sm">{rowLetter}</Text>
          <View className="flex-row flex-wrap">
            {rowSeats.map(seat => (
              <SeatCell key={seat.seat_id} seat={seat} onPress={onPress} />
            ))}
          </View>
        </View>
      ))}

      {/* Legend */}
      <View className="flex-row justify-center gap-6 mt-8 mb-4">
        {[
          { color: 'bg-gray-700',  label: 'Available' },
          { color: 'bg-yellow-600', label: 'Held' },
          { color: 'bg-green-700', label: 'Confirmed' },
        ].map(({ color, label }) => (
          <View key={label} className="flex-row items-center gap-2">
            <View className={`w-4 h-4 rounded ${color}`} />
            <Text className="text-gray-400 text-xs">{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
```

### `src/components/BookingSheet.tsx`

The bottom sheet that slides up when you tap a seat.

```tsx
import { forwardRef, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { Seat } from '../types'

interface Props {
  seat:      Seat | null
  onConfirm: () => void
  onRelease: () => void
  onCancel:  () => void
  isLoading: boolean
}

// forwardRef lets the parent control open/close via a ref
export const BookingSheet = forwardRef<BottomSheet, Props>(
  ({ seat, onConfirm, onRelease, onCancel, isLoading }, ref) => {
    const snapPoints = ['35%']   // sheet takes up 35% of screen height

    if (!seat) return null

    const isConfirmed = seat.status === 'confirmed'

    return (
      <BottomSheet
        ref={ref}
        index={-1}               // -1 = closed by default
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onCancel}
        backgroundStyle={{ backgroundColor: '#1a1a1a' }}
        handleIndicatorStyle={{ backgroundColor: '#555' }}
      >
        <BottomSheetView className="flex-1 px-6 pt-4">
          <Text className="text-white text-xl font-bold mb-2">
            Seat {seat.seat_id}
          </Text>
          <Text className="text-gray-400 mb-8">
            {isConfirmed ? 'You have confirmed this seat.' : 'This seat is being held for you.'}
          </Text>

          {isConfirmed ? (
            <Pressable
              onPress={onRelease}
              disabled={isLoading}
              className="bg-red-700 rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold text-base">
                {isLoading ? 'Releasing...' : 'Release Seat'}
              </Text>
            </Pressable>
          ) : (
            <View className="gap-3">
              <Pressable
                onPress={onConfirm}
                disabled={isLoading}
                className="bg-green-700 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-bold text-base">
                  {isLoading ? 'Confirming...' : 'Confirm Seat'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onCancel}
                className="bg-gray-700 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-bold text-base">Cancel Hold</Text>
              </Pressable>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    )
  }
)
```

**`forwardRef`** — the parent screen needs to call `sheetRef.current?.expand()` to open the sheet and `sheetRef.current?.close()` to close it. `forwardRef` passes the ref from parent to the BottomSheet component inside.

### `app/seats.tsx` — the main screen

`selectedMovie` comes from Zustand — no props, no route params needed.

```tsx
import { useRef, useCallback } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import BottomSheet from '@gorhom/bottom-sheet'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSeats, holdSeat, confirmSeat, releaseSeat } from '../src/lib/api'
import { SeatGrid } from '../src/components/SeatGrid'
import { BookingSheet } from '../src/components/BookingSheet'
import { useAppStore } from '../src/stores/appStore'
import { Seat } from '../src/types'

// No hardcoded MOVIE_ID — reads from Zustand

export default function Seats() {
  const queryClient  = useQueryClient()
  const sheetRef     = useRef<BottomSheet>(null)
  const selectedMovie = useAppStore(s => s.selectedMovie)   // from Zustand

  // selectedSeat is purely local UI state — which seat has the sheet open
  // It doesn't need to be global, only this screen cares about it
  const [selectedSeat, setSelectedSeat] = useRef<Seat | null>(null)

  const MOVIE_ID = selectedMovie?.id ? String(selectedMovie.id) : 'unknown'

  // Fetch all seats
  const { data: seats = [], isLoading, error } = useQuery({
    queryKey: ['seats', MOVIE_ID],
    queryFn:  () => listSeats(MOVIE_ID),
    refetchInterval: 5000,
    enabled: !!selectedMovie,   // don't fetch if no movie selected
  })

  const refreshSeats = () =>
    queryClient.invalidateQueries({ queryKey: ['seats', MOVIE_ID] })

  // Hold mutation
  const holdMutation = useMutation({
    mutationFn: (seatId: string) => holdSeat(MOVIE_ID, seatId),
    onSuccess: (booking) => {
      // Update the selected seat to reflect the hold (so sheet shows correct state)
      setSelectedSeat(prev => prev ? { ...prev, status: 'held', booking_id: booking.id } : null)
      refreshSeats()
    },
    onError: (err: Error) => {
      alert(err.message)
      sheetRef.current?.close()
    },
  })

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedSeat?.booking_id) throw new Error('No session ID')
      return confirmSeat(MOVIE_ID, selectedSeat.seat_id, selectedSeat.booking_id)
    },
    onSuccess: () => {
      refreshSeats()
      sheetRef.current?.close()
    },
  })

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: () => {
      if (!selectedSeat?.booking_id) throw new Error('No session ID')
      return releaseSeat(MOVIE_ID, selectedSeat.seat_id, selectedSeat.booking_id)
    },
    onSuccess: () => {
      refreshSeats()
      sheetRef.current?.close()
      setSelectedSeat(null)
    },
  })

  // When user taps a seat
  const handleSeatPress = useCallback((seat: Seat) => {
    setSelectedSeat(seat)
    sheetRef.current?.expand()

    // If it's available, immediately hold it
    if (seat.status === 'available') {
      holdMutation.mutate(seat.seat_id)
    }
    // If it's confirmed (theirs), just open the sheet to show release option
  }, [holdMutation])

  const isActionLoading =
    holdMutation.isPending || confirmMutation.isPending || releaseMutation.isPending

  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="white" size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <Text className="text-red-400 text-center text-base">
          Failed to load seats. Check your connection.
        </Text>
      </View>
    )
  }

  return (
    // GestureHandlerRootView is required for bottom-sheet to work
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-black">
        <View className="px-4 py-4">
          <Text className="text-white text-2xl font-bold">{selectedMovie?.title}</Text>
          <Text className="text-gray-400 text-sm mt-1">Tap a seat to hold it</Text>
        </View>

        <SeatGrid seats={seats} onPress={handleSeatPress} />

        <BookingSheet
          ref={sheetRef}
          seat={selectedSeat}
          onConfirm={() => confirmMutation.mutate()}
          onRelease={() => releaseMutation.mutate()}
          onCancel={() => {
            sheetRef.current?.close()
            setSelectedSeat(null)
          }}
          isLoading={isActionLoading}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}
```

---

## How It All Fits Together

```
User taps seat A1 (available)
  → handleSeatPress called
  → sheetRef.current.expand() → sheet slides up
  → holdMutation.mutate('A1') → POST /movies/movie-1/seats/A1/hold
  → onSuccess: setSelectedSeat with status='held'
  → invalidateQueries → seat grid refetches → A1 turns yellow

User taps "Confirm" in sheet
  → confirmMutation.mutate()
  → PUT /movies/movie-1/seats/A1/confirm { session_id: booking.id }
  → onSuccess: invalidateQueries → A1 turns green
  → sheetRef.current.close() → sheet slides down

User taps A1 again (confirmed, theirs)
  → handleSeatPress called
  → sheet opens (no hold — already confirmed)
  → shows "Release Seat" button

User taps "Release Seat"
  → releaseMutation.mutate()
  → DELETE /movies/movie-1/seats/A1/release { session_id: booking.id }
  → onSuccess: A1 turns gray again
```

---

## Running the App

```bash
# Make sure your backend is running
cargo run   # in the concurrent-booking directory

# Start the emulator (if Android)
ANDROID_AVD_HOME=/home/sundaram/data/android/avd \
ANDROID_SDK_ROOT=/home/sundaram/Android/Sdk \
ANDROID_HOME=/home/sundaram/Android/Sdk \
emulator -avd Medium_Phone_API_36_0

# Run the app
npx expo start --android

# If emulator can't find the URL
adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:8081
```

**API URL in dev:** When running on an Android emulator, `localhost` means the emulator's own loopback — not your computer. Use `10.0.2.2` instead:

```tsx
// src/lib/api.ts
const BASE_URL = 'http://10.0.2.2:8080'   // Android emulator → your machine's localhost
```

---

## V1 Checklist

```
[ ] Expo project created, dependencies installed (including zustand + AsyncStorage)
[ ] babel.config.js and tailwind.config.js set up
[ ] nativewind-env.d.ts created (fixes className TS errors)
[ ] src/stores/appStore.ts — Zustand store with persist middleware
[ ] src/data/movies.ts — typed movie list from movies.json
[ ] app/_layout.tsx — QueryClientProvider + isReady routing
[ ] app/onboarding.tsx — 2-page carousel, calls setOnboardingComplete on finish
[ ] app/movies.tsx — movie grid, sets selectedMovie in store on tap
[ ] src/lib/api.ts — listSeats, holdSeat, confirmSeat, releaseSeat
[ ] src/types/index.ts — Seat, Booking types
[ ] src/components/SeatCell.tsx — colored by status
[ ] src/components/SeatGrid.tsx — grouped by row
[ ] src/components/BookingSheet.tsx — confirm/release actions
[ ] app/seats.tsx — reads selectedMovie from Zustand, wires everything
[ ] Hold → sheet opens with hold state
[ ] Confirm → seat turns green, sheet closes
[ ] Release → seat turns gray, sheet closes
[ ] Held seat by someone else → not tappable (disabled)
[ ] 5-second polling keeps grid fresh
[ ] Loading and error states handled
[ ] Onboarding only shows once — skipped on subsequent launches
[ ] Selected movie persists across app restarts
```

---

## Key Concepts You Used In V1

**`useQuery`** — fetches and caches server data. You give it a key and a function; it handles loading/error/caching.

**`useMutation`** — runs a POST/PUT/DELETE. `onSuccess` lets you invalidate the cache so fresh data loads.

**`queryClient.invalidateQueries`** — marks cached data as stale, triggers a refetch. This is how mutations cause the UI to update.

**`forwardRef`** — lets a parent component call methods on a child component's internal element (like `sheetRef.current.expand()`).

**`useCallback`** — wraps a function so it doesn't get recreated on every render. Important for functions passed to child components.

**`refetchInterval`** — TanStack Query polls automatically every N milliseconds. Simple alternative to WebSockets for V1.

**Zustand** — global state store. Any component reads with `useAppStore(s => s.something)`. Mutations update every subscriber automatically. No prop drilling.

**Zustand `persist`** — middleware that connects the store to AsyncStorage. State is saved on every change and reloaded on next launch. You only define `partialize` to control which keys are persisted.

**`isReady` pattern** — always wait for Zustand hydration before routing. Without it you'd briefly show the wrong screen on launch because AsyncStorage reads are async.

**`enabled` in `useQuery`** — pass `enabled: false` (or a condition) to prevent a query from running until its dependencies are ready. Used here to stop the seats query from firing before a movie is selected.

---

## What V2 Will Add

- Login and signup screens
- JWT stored securely in expo-secure-store
- Zustand auth store
- Protected routes (redirect to login if no token)
- Replace hardcoded `user_id` with the authenticated user from the token
- Google OAuth login
- Track which confirmed seats belong to the current user
