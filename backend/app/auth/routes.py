from fastapi import APIRouter, HTTPException, Response, Request, Depends
from datetime import datetime, timezone
import uuid

from app.database import get_db
from app.models.schemas import UserCreate, UserLogin, Token, UserOut
from app.auth.utils import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.auth.middleware import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


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

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,
    )

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

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,
    )

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