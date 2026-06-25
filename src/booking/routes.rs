use std::sync::Arc;

use axum::{Router, routing::{delete, get, post, put}};

use crate::booking::{booking::RedisStore, handler::{list_seats,confirm_seat,hold_seat,release_seat}, service::Service};

pub fn router (svc: Arc<Service<RedisStore>> )->Router{


    Router::new()
        // .route("/movies", get(list_movies))
        .route("/movies/{movie_id}/seats", get(list_seats))
        .route("/movies/{movie_id}/seats/{seat_id}/hold", post(hold_seat))
        .route("/movies/{movie_id}/seats/{seat_id}/confirm", put(confirm_seat))
        .route("/movies/{movie_id}/seats/{seat_id}/release", delete(release_seat))
        .with_state(svc)
    
}