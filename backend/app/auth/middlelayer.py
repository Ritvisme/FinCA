from fastapi import Depends, HTTPException, status
from fastapi.security  import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.auth.utils import decode_access_token
from app.database import get_db


