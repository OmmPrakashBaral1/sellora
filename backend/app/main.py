
from fastapi import FastAPI, Depends

from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import User
from app.routers.auth import router as auth_router
from app.routers.products import router as products_router
from app.routers.orders import router as orders_router

from app.dependencies.auth import get_current_user, require_role

app = FastAPI(title="Sellora API")
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)


Base.metadata.create_all(bind=engine)



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