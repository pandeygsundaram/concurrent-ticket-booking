use serde::{Deserialize, Serialize};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Booking {
    pub id: String,
    pub movie_id: String,
    pub seat_id: String,
    pub user_id: String,
    pub status: BookingStatus,
    pub expires_at: Option<SystemTime>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BookingStatus {
    Held,
    Confirmed,
}
#[derive(Debug, thiserror::Error )]
pub enum BookingError {
    #[error("seat already booked")]
    SeatAlreadyBooked,

    #[error("session not found")]
    SessionNotFound,

    #[error("reddis error:{0}")]
    Redis(#[from] redis::RedisError),
}

pub trait BookingStore: Send + Sync {
    async fn book(&self, booking: Booking) -> Result<Booking, BookingError>;
    async fn list_bookings(&self, movie_id: &str) -> Result<Vec<Booking>, BookingError>;
    async fn confirm(&self, session_id: &str) -> Result<(), BookingError>;
    async fn release(&self, session_id: &str) -> Result<(), BookingError>;
}
