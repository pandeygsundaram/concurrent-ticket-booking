use std::sync::Arc;

use crate::booking::domain::{Booking, BookingError, BookingStore};

pub struct Service<S: BookingStore> {
    store: Arc<S>,
}

impl<S: BookingStore> Service<S> {
    pub fn new(store: Arc<S>) -> Self {
        Service { store }
    }

    pub async fn book(&self, b: Booking) -> Result<Booking, BookingError> {
        self.store.book(b).await
    }

    pub async fn list_booking(&self, movie_id: &str) -> Result<Vec<Booking>, BookingError> {
        self.store.list_bookings(movie_id).await
    }

    pub async fn confirm(&self, session_id: &str) -> Result<(), BookingError> {
        self.store.confirm(session_id).await
    }
    pub async fn release(&self, session_id: &str) -> Result<(), BookingError> {
        self.store.release(session_id).await
    }
}
