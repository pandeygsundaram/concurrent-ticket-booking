mod booking;

use std::sync::Arc;

use crate::booking::{booking::RedisStore, routes::router, service::Service};

#[tokio::main]
async fn main() {
    let client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
    // let con = client.get_multiplexed_async_connection().await.unwrap();

    let store = Arc::new(RedisStore::new(client));
    let service = Arc::new(Service::new(store));
    let app = router(service);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("Server is running");
    axum::serve(listener, app).await.unwrap();
}
