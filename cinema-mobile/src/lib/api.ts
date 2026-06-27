import { Booking, Seat } from "../types"

const BASE_URL = 'http://10.0.2.2:8080'

const TEMP_USER_ID = 'user-123'

// write the api files
// then close in on the what?? basically on this thing right
// what is it exactly i think it is ummmm 

// write the ui sceens and then lock in !!




export async function listSeats(movieId: string): Promise<Seat[]> {
    const res = await fetch(`${BASE_URL}/movies/${movieId}/seats`)
    if (!res.ok) throw new Error('Failed to fetch seats')
    const bookings: Booking[] = await res.json()


    // The backend returns booked seats only. You need to generate
    // the full seat list and mark which ones are taken.
    return buildSeatGrid(movieId, bookings)

}


export async function holdSeat(movie_id: string, seat_id: string): Promise<Booking> {
    const res = await fetch(`${BASE_URL}/movies/${movie_id}/seats/${seat_id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: TEMP_USER_ID })

    })

    if (res.status === 409) throw new Error('Seat already taken')
    if (!res.ok) throw new Error('Failed to hold seat')
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

function buildSeatGrid(movieId: string, bookings: Booking[]): Seat[] {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    const bookedMap = new Map(bookings.map(b => [b.seat_id, b]))

    return rows.flatMap(row =>
        Array.from({ length: 10 }, (_, i) => {
            const seatId = `${row}${i + 1}`
            const booking = bookedMap.get(seatId)
            return {
                seat_id: seatId,
                status: booking ? (booking.status === 'Confirmed' ? 'confirmed' : 'held') : 'available',
                booking_id: booking?.id ?? null,
            } as Seat
        })
    )
}