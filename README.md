# Concurrent Ticket Booking

A full-stack cinema seat booking system that solves the **double-booking problem** — two users trying to grab the same seat at the same time.

## Repo Structure

```
concurrent-booking/
├── backend/          # Rust/Axum API server
└── cinema-mobile/    # React Native (Expo) mobile app
```

---

## The Problem

```
User A ──┐
          ├── POST /movies/1/seats/A1/hold ──▶ who gets it?
User B ──┘
```

Without proper concurrency handling, both users get a confirmation. One person shows up to find someone already in their seat.

## The Solution

Redis `SET NX` (Set if Not Exists) — an atomic operation that guarantees only one request wins, no matter how many arrive simultaneously.

```
1000 requests hit seat A1 at the same time
         ↓
    Redis queues them
         ↓
First SET NX wins → 200 OK
All others fail  → 409 Conflict
```

---

## Backend (Rust)

### Stack

- **Rust** — systems language, memory safe, blazing fast
- **Axum** — async HTTP framework
- **Redis** — atomic `SET NX` for distributed locking
- **Tokio** — async runtime

### Architecture

```
HTTP Request
    ↓
Handler (handler.rs)       ← extracts path params + JSON body
    ↓
Service (service.rs)       ← thin delegation layer
    ↓
RedisStore (booking.rs)    ← actual Redis operations
    ↓
Redis
```

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/movies/{movie_id}/seats` | List all held/confirmed seats |
| `POST` | `/movies/{movie_id}/seats/{seat_id}/hold` | Hold a seat for 120 seconds |
| `PUT` | `/movies/{movie_id}/seats/{seat_id}/confirm` | Confirm a held seat |
| `DELETE` | `/movies/{movie_id}/seats/{seat_id}/release` | Release a held seat |

### How It Works

#### Hold a seat
```bash
curl -X POST http://localhost:8080/movies/movie1/seats/A1/hold \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123"}'
```
```json
{
  "id": "fde294c3-d94c-47c8-bf78-66380eb28321",
  "movie_id": "movie1",
  "seat_id": "A1",
  "user_id": "user123",
  "status": "Held",
  "expires_at": "..."
}
```

The `id` returned is your `session_id` — use it to confirm or release.

#### Confirm
```bash
curl -X PUT http://localhost:8080/movies/movie1/seats/A1/confirm \
  -H "Content-Type: application/json" \
  -d '{"session_id": "fde294c3-d94c-47c8-bf78-66380eb28321"}'
```

#### Release
```bash
curl -X DELETE http://localhost:8080/movies/movie1/seats/A1/release \
  -H "Content-Type: application/json" \
  -d '{"session_id": "fde294c3-d94c-47c8-bf78-66380eb28321"}'
```

#### Test concurrent booking
```bash
curl -X POST http://localhost:8080/movies/movie1/seats/B1/hold \
  -d '{"user_id": "user1"}' -H "Content-Type: application/json" & \
curl -X POST http://localhost:8080/movies/movie1/seats/B1/hold \
  -d '{"user_id": "user2"}' -H "Content-Type: application/json" &
```
One gets `200`, the other gets `409 seat already booked`.

### Redis Key Design

```
seat:{movie_id}:{seat_id}   → booking_id   (TTL: 120s, removed on confirm)
session:{session_id}        → seat_key     (TTL: 120s, deleted on confirm/release)
```

### Running Locally

```bash
# start Redis
docker run -p 6379:6379 redis:7-alpine

# run the server
cd backend && cargo run
```

Server starts on `http://localhost:8080`.

---

## Mobile App (React Native)

### Stack

- **Expo** + **Expo Router** — file-based navigation
- **NativeWind** — Tailwind utility classes in React Native
- **Zustand** — lightweight global state
- **React Native Reanimated** — smooth animations

### Screens

- Onboarding — animated intro with video background
- Login — phone/email auth entry
- Movies — poster carousel for film selection
- Seats — interactive seat map with real-time hold/confirm via the backend API

### Running Locally

```bash
cd cinema-mobile
npm install
npx expo start
```
