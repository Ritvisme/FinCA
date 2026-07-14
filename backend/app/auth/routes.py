from fastapi import APIRouter, HTTPException, Response, Request, Depends
from datetime import datetime, timezone
import uuid

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.database import get_db
from app.config import settings
from app.models.schemas import UserCreate, UserLogin, GoogleLogin, Token, UserOut
from app.auth.utils import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.auth.middleware import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """One helper so login, refresh, and Google-login all match."""
    # In prod the frontend (e.g. vercel.app) and backend (e.g. onrender.com) are
    # different sites, so the cookie must be SameSite=None + Secure to be sent
    # cross-origin. Locally, Lax over http is correct.
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.is_prod,
        samesite="none" if settings.is_prod else "lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


@router.post("/register", response_model=UserOut)#this means the response will only contain the fields defined in userout to prevent password leakage.
async def register(user_data: UserCreate):#validates the incoming json data against usercreate schema and then we are checking if 
    """ the email is already registered in the database if it is then we are raising an HTTP exception otherwise we are creating a new user document
        with a unique id, name, email, hashed password, role and created_at timestamp and inserting it into the database and then returning the user data
        without the password hash"""
    db = get_db()

    existing = await db["users"].find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())#generates a unique user id using uuid4 and converting it to string if the user dont exist
    user_doc = {
        "_id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),#only stores the hashed password in db.
        "role": user_data.role,
        "created_at": datetime.now(timezone.utc),
    }
    await db["users"].insert_one(user_doc)

    return UserOut(
        id=user_id,
        name=user_doc["name"],
        email=user_doc["email"],
        role=user_doc["role"],
        created_at=user_doc["created_at"],
    )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, response: Response):
    db = get_db()

    user = await db["users"].find_one({"email": user_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token_data = {"user_id": user["_id"], "role": user["role"]}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    _set_refresh_cookie(response, refresh_token)

    return Token(access_token=access_token)


@router.post("/google", response_model=Token)
async def google_login(data: GoogleLogin, response: Response):
    """Verify a Google ID token, then log the user in (creating an account on first sign-in)."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google login not configured")

    try:
        info = google_id_token.verify_oauth2_token(
            data.id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = info.get("email")
    if not email or not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email not verified")

    db = get_db()
    user = await db["users"].find_one({"email": email})
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "name": info.get("name") or email.split("@")[0],
            "email": email,
            "password_hash": None,  # Google users have no password
            "role": "client",
            "google_id": info.get("sub"),
            "created_at": datetime.now(timezone.utc),
        }
        await db["users"].insert_one(user)

    token_data = {"user_id": user["_id"], "role": user["role"]}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    _set_refresh_cookie(response, refresh_token)
    return Token(access_token=access_token)


@router.post("/refresh", response_model=Token)
async def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = decode_refresh_token(refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_data = {"user_id": payload["user_id"], "role": payload["role"]}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    _set_refresh_cookie(response, new_refresh)

    return Token(access_token=new_access)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def get_me(user=Depends(get_current_user)):
    return UserOut(
        id=user["_id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"],
    )