mod booking;

use std::sync::Arc;
use tower_http::trace::TraceLayer;

use crate::booking::{booking::RedisStore, routes::router, service::Service};

#[tokio::main]
async fn main() {
    let client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
    // let con = client.get_multiplexed_async_connection().await.unwrap();

    tracing_subscriber::fmt::init();

    let store = Arc::new(RedisStore::new(client));
    let service = Arc::new(Service::new(store));
    let app = router(service).layer(
        TraceLayer::new_for_http()
            .make_span_with(tower_http::trace::DefaultMakeSpan::new().level(tracing::Level::INFO))
            .on_response(tower_http::trace::DefaultOnResponse::new().level(tracing::Level::INFO)),
    );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("Server is running");
    axum::serve(listener, app).await.unwrap();
}
