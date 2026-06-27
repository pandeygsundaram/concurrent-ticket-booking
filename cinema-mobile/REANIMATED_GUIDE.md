# React Native Reanimated — Deep Dive Guide
> Written from building the SnapCarousel + MovieBelt in this project.

---

## The Core Idea

React Native has two threads:
- **JS thread** — your React code, useState, useEffect, business logic
- **UI thread** — what actually renders on screen, handles gestures

Normal `Animated` from React Native runs on the JS thread — it sends updates over a bridge which causes jank. **Reanimated runs animations entirely on the UI thread** using a technology called JSI (JavaScript Interface). No bridge, no jank, 60/120fps guaranteed.

The tradeoff: UI thread code can't directly call JS functions or update React state. You need special bridges to cross between them.

---

## Core APIs

### `useSharedValue<T>(initialValue)`
The fundamental primitive. A value that lives on the UI thread but is readable from JS.

```ts
const scrollX = useSharedValue(0)

// Read/write from JS:
scrollX.value = 100

// Read/write from UI thread (inside worklets):
scrollX.value += delta
```

**Key rule:** In worklets (UI thread functions), just use `.value`. Outside worklets, same thing. The difference is WHO is reading it — JS or UI thread. Reanimated figures it out.

**Why not useState?** `useState` causes a re-render every update. `useSharedValue` updates silently on the UI thread — React never re-renders, the animation just runs.

---

### `useAnimatedStyle(() => StyleObject)`
Turns a shared value into a live style. Runs on UI thread every frame.

```ts
const animStyle = useAnimatedStyle(() => ({
    transform: [
        { translateY: scrollX.value * 0.5 },
        { scale: 1 + scrollX.value * 0.001 },
    ]
}))

// Apply to an Animated.View:
<Animated.View style={[staticStyle, animStyle]} />
```

**The function inside is a "worklet"** — it runs on the UI thread. You cannot call JS functions, use React state, or do async operations inside it. Only use shared values and pure math.

---

### `interpolate(value, inputRange, outputRange, extrapolation)`
Maps a value from one range to another. The bread and butter of scroll-driven animations.

```ts
import { interpolate, Extrapolation } from 'react-native-reanimated'

// When scrollX is at card's position (index * ITEM_SIZE):
// - card is at scale 1.0, translateY 0, rotate 0
// When scrollX is one card away:
// - card is at scale 0.88, translateY 40, rotate ±3deg

const scale = interpolate(
    scrollX.value,           // input value
    [prev, current, next],   // input range
    [0.88, 1, 0.88],         // output range
    Extrapolation.CLAMP      // don't go outside the range
)
```

**Extrapolation options:**
- `CLAMP` — stays at min/max beyond the range (use this almost always)
- `EXTEND` — keeps going linearly beyond range
- `IDENTITY` — returns the input value beyond range

---

### `useAnimatedScrollHandler`
Intercepts scroll events on the UI thread — no bridge overhead.

```ts
const scrollX = useSharedValue(0)

const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
        // This runs on UI thread, every scroll frame
        scrollX.value = event.contentOffset.x
    },
    onBeginDrag: (event) => { /* finger touched */ },
    onEndDrag: (event) => { /* finger lifted */ },
    onMomentumEnd: (event) => { /* scroll stopped */ },
})

<Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} />
```

`scrollEventThrottle={16}` means fire every ~16ms (60fps). Set to 1 for maximum precision.

---

### `useFrameCallback((frameInfo) => void)`
Runs a function every single frame on the UI thread. Think of it as `requestAnimationFrame` but on the UI thread.

```ts
useFrameCallback((frame) => {
    // frame.timeSincePreviousFrame — ms since last frame (usually ~16ms at 60fps)
    // frame.timeSinceFirstFrame — ms since component mounted
    
    if (!frame.timeSincePreviousFrame) return  // skip first frame
    
    const delta = Math.min(frame.timeSincePreviousFrame, 32) / 1000  // seconds, capped at 32ms
    
    offset.value += speed * delta  // frame-rate independent movement
})
```

**Why cap at 32ms?** If the app freezes for 500ms then resumes, delta would be 500ms and your animation would jump 500ms worth of movement in one frame. Capping prevents huge jumps after hiccups.

**Used in MovieBelt** — drives the infinite scroll belt, frame by frame, perfectly linear.

---

### `useAnimatedReaction(prepare, react, dependencies?)`
Watches a derived value and reacts when it changes. The only way to run logic when a shared value changes without causing re-renders.

```ts
useAnimatedReaction(
    () => Math.round(scrollX.value / ITEM_SIZE),  // "prepare" — compute a derived value
    (currentIndex, previousIndex) => {             // "react" — runs when derived value changes
        if (currentIndex !== previousIndex) {
            runOnJS(updateIndex)(currentIndex)     // cross to JS thread
        }
    }
)
```

**"prepare" runs on UI thread** — pure computation only.
**"react" runs on UI thread** — but you can call `runOnJS` to cross back to JS.

---

### `runOnJS(fn)(args)` — Crossing back to JS thread

The only way to call a JS function from a worklet (UI thread code).

```ts
const updateState = (index: number) => {
    setCurrentIndex(index)  // normal JS/React code
}

// Inside a worklet:
runOnJS(updateState)(currentIndex)
```

**Why is it needed?** UI thread can't directly touch React state. `runOnJS` schedules the call to happen on the JS thread on the next frame.

**Note:** Marked as deprecated in newer Reanimated — replacement is coming but `runOnJS` still works.

---

### `runOnUI(fn)(args)` — Going to UI thread from JS

The reverse — call a worklet from JS thread.

```ts
const doSomethingOnUI = () => {
    'worklet'
    sharedValue.value = 100
}

// From JS:
runOnUI(doSomethingOnUI)()
```

---

## The Arc Effect — How It Works

In `SnapCarousel`, each card computes its own animation based on scroll position:

```
Cards:    [0]    [1]    [2]    [3]    [4]
Position:  0    ITEM   2*ITEM 3*ITEM 4*ITEM
```

When `scrollX = 2 * ITEM_SIZE`, card 2 is centered.

For card at index `i`:
```ts
const inputRange = [
    (i - 1) * ITEM_SIZE,   // one card to the left
    i * ITEM_SIZE,          // centered
    (i + 1) * ITEM_SIZE,   // one card to the right
]
```

`translateY` output `[40, 0, 40]` — centered card sits 40px higher than sides.
`scale` output `[0.88, 1, 0.88]` — centered card is bigger.
`rotate` output `[-3, 0, 3]` — sides tilt slightly.

The result: cards follow an arc path, like they're sitting on the rim of a giant wheel whose center is far below the screen.

---

## Infinite Loop Pattern

The seamless infinite loop trick — used in both MovieBelt and SnapCarousel:

1. **Duplicate the data** — `[...items, ...items]` gives you 2x the items
2. **Scroll through the first copy** — from 0 to `totalWidth`
3. **When you hit the end of the first copy, silently reset to 0**
4. Because the second copy is identical to the first, the reset is invisible

```ts
// In useFrameCallback:
autoScrollX.value += speed * delta

if (autoScrollX.value >= ITEM_SIZE * ORIGINAL_LENGTH) {
    autoScrollX.value -= ITEM_SIZE * ORIGINAL_LENGTH  // silent reset
}
```

For gestures (MovieBelt belt rows), same pattern but bidirectional:
```ts
if (offset.value <= -totalWidth * 2) offset.value += totalWidth
if (offset.value >= 0) offset.value -= totalWidth
```

---

## Driving a ScrollView Programmatically

`useFrameCallback` can't call `.scrollTo()` directly — that's a JS method. You need `useAnimatedReaction` + `runOnJS`:

```ts
const scrollRef = useRef<Animated.ScrollView>(null)
const autoScrollX = useSharedValue(0)

useAnimatedReaction(
    () => autoScrollX.value,
    (x) => {
        runOnJS(scrollTo)(scrollRef, x, 0, false)
    }
)

// OR use Reanimated's built-in scrollTo:
import { scrollTo } from 'react-native-reanimated'

useAnimatedReaction(
    () => autoScrollX.value,
    (x) => {
        scrollTo(scrollRef, x, 0, false)  // runs on UI thread directly!
    }
)
```

`scrollTo` from Reanimated is a worklet — it runs directly on the UI thread without needing `runOnJS`. This is the cleanest approach.

---

## Dynamic Blurred Background Pattern

Used in the login screen — background changes to match the centered carousel card:

```
[Blurred poster image — fullscreen, absolute]
[Dark overlay — absolute, rgba(0,0,0,0.7)]
[Carousel cards — middle]
[Login UI — bottom]
```

```tsx
const [currentIndex, setCurrentIndex] = useState(0)

// Background:
<Image
    source={POSTERS[currentIndex]}
    style={StyleSheet.absoluteFill}
    blurRadius={20}  // built-in Gaussian blur on Image
    resizeMode="cover"
/>
<View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />

// Carousel drives the index:
<SnapCarousel onIndexChange={setCurrentIndex} />
```

The `blurRadius` prop on `Image` is a built-in React Native Gaussian blur — no extra libraries needed. It blurs the image itself, not the content around it.

---

## Summary — Which API Does What

| Goal | API |
|------|-----|
| Store animated value | `useSharedValue` |
| Animate a component's style | `useAnimatedStyle` |
| Map scroll position to animation | `interpolate` |
| Listen to scroll events on UI thread | `useAnimatedScrollHandler` |
| Run code every frame | `useFrameCallback` |
| React when a derived value changes | `useAnimatedReaction` |
| Call JS function from UI thread | `runOnJS` |
| Scroll a ScrollView from UI thread | `scrollTo` (from reanimated) |
| Gesture handling | `Gesture.Pan()` + `GestureDetector` |
