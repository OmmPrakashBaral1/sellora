from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    gmail: str
    password: str


class UserLogin(BaseModel):
    gmail: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str