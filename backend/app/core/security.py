import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import firebase_admin
from firebase_admin import auth
from firebase_admin.auth import UserRecord

logger = logging.getLogger(__name__)

# OAuth2 scheme to extract the token from the Authorization header
# We point tokenUrl to the *frontend's* login path or a placeholder,
# as FastAPI uses it for documentation purposes. The actual token
# verification happens via Firebase.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # Placeholder tokenUrl

async def verify_firebase_token(token: str = Depends(oauth2_scheme)) -> UserRecord:
    """
    FastAPI dependency that verifies a Firebase ID token provided in the
    Authorization header.

    Args:
        token: The bearer token extracted from the Authorization header.

    Returns:
        The decoded Firebase UserRecord object if the token is valid.

    Raises:
        HTTPException (401 Unauthorized): If the token is invalid, expired,
                                         revoked, or Firebase Admin SDK is not initialized.
    """
    if not firebase_admin._apps:
        logger.error("Firebase Admin SDK has not been initialized properly.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Firebase Admin not initialized. Cannot verify token."
        )

    try:
        # Verify the ID token using the Firebase Admin SDK.
        # This verifies the signature, expiration, and issuer.
        # `check_revoked=True` ensures that the token hasn't been revoked (e.g., user signed out).
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        
        # Optionally, you can fetch the full UserRecord for more details
        # user = auth.get_user(decoded_token['uid'])
        # return user # If you want the full user object
        
        logger.info(f"Successfully verified token for UID: {decoded_token['uid']}")
        return decoded_token # Return the decoded token payload (dict) for now

    except auth.RevokedIdTokenError:
        logger.warning("Attempted to use a revoked Firebase ID token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError:
        logger.warning("Attempted to use an expired Firebase ID token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError as e:
        logger.error(f"Invalid Firebase ID token provided: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Catch any other unexpected errors during verification
        logger.error(f"An unexpected error occurred during token verification: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not process token verification.",
        )

# You could add more security-related functions here, like permission checks. 