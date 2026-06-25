use std::time::{Duration, SystemTime};

use redis::AsyncCommands;
use crate::booking::domain::{Booking, BookingError, BookingStatus, BookingStore};

fn seat_key(movie_id: &str, seat_id: &str) -> String {
    format!("seat:{}:{}", movie_id, seat_id)
}

fn session_key(session_id: &str) -> String {
    format!("session:{}", session_id)
}

pub struct RedisStore {
    client: redis::Client,
    default_ttl: Duration,
}

impl RedisStore {
    pub fn new(client: redis::Client) -> Self {
        RedisStore {
            client,
            default_ttl: Duration::from_secs(120),
        }
    }

    pub async fn list_bookings_internal(&self, movie_id: &str) -> Result<Vec<Booking>, BookingError> {
        let mut con = self.client.get_multiplexed_async_connection().await?;
        let mut cursor: u64 = 0;
        let pattern = format!("seat:{}:*", movie_id);
        let mut ans = Vec::new();
        loop {
            let (next, keys): (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(100)
                .query_async(&mut con)
                .await?;
            cursor = next;
            for key in keys {
                let booking_id: Option<String> = con.get(&key).await?;
                if let Some(booking_id) = booking_id {
                    ans.push(Booking {
                        expires_at: None,
                        id: booking_id,
                        movie_id: movie_id.to_string(),
                        seat_id: key.split(':').nth(2).unwrap_or("").to_string(),
                        status: BookingStatus::Held,
                        user_id: String::new(),
                    });
                }
            }
            if cursor == 0 { break; }
        }
        Ok(ans)
    }

    pub async fn hold_seat(&self, mut booking: Booking) -> Result<Booking, BookingError> {
        let mut con = self.client.get_multiplexed_async_connection().await?;

        let key = seat_key(&booking.movie_id, &booking.seat_id);

        let ok: bool = redis::cmd("SET")
            .arg(&key)
            .arg(&booking.id)
            .arg("NX")
            .arg("EX")
            .arg(120u64)
            .query_async(&mut con)
            .await?;

        if !ok {
            return Err(BookingError::SeatAlreadyBooked);
        }

        let sess_key = session_key(&booking.id);
        let _: () = con.set_ex(&sess_key, &key, 120u64).await?;

        booking.expires_at = Some(SystemTime::now() + self.default_ttl);
        Ok(booking)
    }

    pub async fn confirm_seat(&self, session_id: &str) -> Result<(), BookingError> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let sess_key = session_key(session_id);
        let seat_k: Option<String> = conn.get(&sess_key).await?;

        let Some(seat_k) = seat_k else {
            return Err(BookingError::SessionNotFound);
        };

        if !conn.persist::<_, bool>(&seat_k).await? {
            return Err(BookingError::SeatAlreadyBooked);
        }

        let _: () = conn.del(&sess_key).await?;
        Ok(())
    }

    pub async fn release_seat(&self, session_id: &str) -> Result<(), BookingError> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;

        let sess_key = session_key(session_id);
        let seat_k: Option<String> = conn.get(&sess_key).await?;

        let Some(seat_k) = seat_k else {
            return Err(BookingError::SessionNotFound);
        };

        let _: () = conn.del(&seat_k).await?;
        let _: () = conn.del(&sess_key).await?;
        Ok(())
    }
}

impl BookingStore for RedisStore {
    async fn book(&self, booking: Booking) -> Result<Booking, BookingError> {
        self.hold_seat(booking).await
    }

    async fn list_bookings(&self, movie_id: &str) -> Result<Vec<Booking>, BookingError> {
        self.list_bookings_internal(movie_id).await
    }

    async fn confirm(&self, session_id: &str) -> Result<(), BookingError> {
        self.confirm_seat(session_id).await
    }

    async fn release(&self, session_id: &str) -> Result<(), BookingError> {
        self.release_seat(session_id).await
    }
}
