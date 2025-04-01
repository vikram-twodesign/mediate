from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

# Import the verification dependency and UserRecord model
from app.core.security import verify_firebase_token
from firebase_admin.auth import UserRecord # Import UserRecord if you return the full user object

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str

# Keep the existing placeholder register/login for now
# The actual registration/login will happen on the frontend using Firebase SDK

@router.post("/register", response_model=dict, deprecated=True)
async def register_user(user: UserCreate):
    """(Deprecated) Register a new user. User registration should be handled via Firebase Frontend SDK."""
    # This will be implemented with actual database operations
    # Or more likely, removed entirely as registration happens on the frontend.
    return {"message": "User registration should be handled via Firebase Frontend SDK"}

@router.post("/login", response_model=Token, deprecated=True)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """(Deprecated) Login and get access token. Token generation/retrieval happens via Firebase Frontend SDK."""
    # This will be implemented with actual authentication
    # Or more likely, removed entirely as token handling happens on the frontend.
    # The frontend will get the ID token from Firebase Auth and send it in the
    # Authorization: Bearer <token> header for requests to secured endpoints.
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Login should be handled via Firebase Frontend SDK. Send ID token in Authorization header."
    )

# --- New Secured Endpoint Example ---
@router.get("/me", response_model=dict) # Change response_model if returning UserRecord
async def read_users_me(current_user: dict = Depends(verify_firebase_token)):
    """
    Fetch the profile of the currently logged-in user.
    Requires a valid Firebase ID token in the Authorization header.
    """
    # `verify_firebase_token` handles the token verification.
    # If the token is valid, `current_user` will contain the decoded token payload (dict).
    # If the token is invalid or missing, it raises an HTTPException.
    
    # You can customize the response based on the decoded token payload
    # For example, return the UID and email:
    return {"uid": current_user.get("uid"), "email": current_user.get("email")}
    # If you changed verify_firebase_token to return UserRecord, you'd access properties like:
    # return {"uid": current_user.uid, "email": current_user.email, "display_name": current_user.display_name}
# --- End Secured Endpoint Example --- 