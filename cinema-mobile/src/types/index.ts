export type SeatStatus = 'available' | 'held' | 'confirmed'

export interface Seat{
    seat_id:string,
    status: SeatStatus,
    booking_id : string | null // session id from the hold req's responce
}

export interface Booking{
    id: string ,
    movie_id : string,
    seat_id: string ,
    user_id : string,
    status: 'Held' | 'Confirmed',
    expires_at: string | null
}