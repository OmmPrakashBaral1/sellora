from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends

from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.models import User
from app.routers.auth import router as auth_router
from app.routers.products import router as products_router
from app.routers.orders import router as orders_router
from app.routers.reviews import router as reviews_router
from app.routers.payments import router as payments_router
from app.routers.seller_orders import router as seller_order_router
from app.routers.seller_applications import router as seller_applications_router
from app.routers.webhooks import router as webhooks_router

from app.dependencies.auth import get_current_user, require_role

app = FastAPI(title="Sellora API")
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(reviews_router)
app.include_router(payments_router)
app.include_router(seller_order_router)
app.include_router(seller_applications_router)
app.include_router(webhooks_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"]
)


@app.get("/")
def home():
    return {"message": "Welcome to Sellora API"}


@app.get("/health")
def health_check():
    with engine.connect():
        return {"status": "Database connection successful"}


@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "gmail": user.gmail,
            "role": user.role
        }
        for user in users
    ]


@app.get("/me")
def read_my_profile(
    current_user: User = Depends(get_current_user)
    ):
   return{
    "id": current_user.id,
    "name": current_user.name,
    "gmail": current_user.gmail,
    "role": current_user.role
   }


@app.get("/seller/dashboard")
def seller_dashboard(
    current_user: User = Depends(require_role("SELLER"))
):
    return {
        "message": "Welcome to the Seller Dashboard",
        "user_id": current_user.id,
        "role": current_user.role
    }