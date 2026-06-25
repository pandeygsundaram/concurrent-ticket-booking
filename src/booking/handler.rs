use std::{
    sync::Arc,
    time::{Duration, SystemTime},
};

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;

use crate::booking::{
    booking::RedisStore,
    domain::{Booking, BookingError, BookingStatus},
    service::Service,
};

#[derive(Deserialize)]
pub struct HoldRequest {
    pub user_id: String,
}

#[derive(Deserialize)]
pub struct ConfirmRequest {
    pub session_id: String,
}

#[derive(Deserialize)]
pub struct ReleaseRequest {
    pub session_id: String,
}

pub async fn hold_seat(
    State(svc): State<Arc<Service<RedisStore>>>,
    Path((movie_id, seat_id)): Path<(String, String)>,
    Json(req): Json<HoldRequest>,
) -> impl IntoResponse {
    let booking = Booking {
        id: uuid::Uuid::new_v4().to_string(),
        movie_id,
        seat_id,
        user_id: req.user_id,
        status: BookingStatus::Held,
        expires_at: Some(SystemTime::now() + Duration::from_secs(120)),
    };

    match svc.book(booking).await {
        Ok(b) => (StatusCode::OK, Json(b)).into_response(),
        Err(BookingError::SeatAlreadyBooked) => {
            (StatusCode::CONFLICT, "Seat already booked").into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn confirm_seat(
    State(svc): State<Arc<Service<RedisStore>>>,
    Path((_movie_id, _seat_id)): Path<(String, String)>,
    Json(req): Json<ConfirmRequest>,
) -> impl IntoResponse {

    match svc.confirm(&req.session_id).await {
        Ok(())=>(StatusCode::OK , "Seat Confirmed").into_response(),
        Err(BookingError::SeatAlreadyBooked)=>(StatusCode::CONFLICT, "Seat already booked").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        
    }
}

pub async fn release_seat(
    State(svc): State<Arc<Service<RedisStore>>>,
    Path((_movie_id, _seat_id)): Path<(String, String)>,
    Json(req): Json<ReleaseRequest>,
) -> impl IntoResponse {

    match svc.release(&req.session_id).await {
        Ok(())=>(StatusCode::OK , "Release SuccessFully" ).into_response(),
        Err(e)=>( StatusCode::INTERNAL_SERVER_ERROR , e.to_string()).into_response()
    }




}

pub async fn list_seats(
    State(svc): State<Arc<Service<RedisStore>>>,
    Path(movie_id): Path<String>,
) -> impl IntoResponse {
    match svc.list_booking(&movie_id).await {
        Ok(m)=>(StatusCode::OK , Json(m)).into_response(),
        Err(e)=>(StatusCode::INTERNAL_SERVER_ERROR , e.to_string()).into_response()
    }
}
