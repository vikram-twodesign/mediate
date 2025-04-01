from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.database import Database
from app.core.config import settings
import urllib.parse
import logging

# Configure logging
logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db: Database = None

db = MongoDB()

async def connect_to_mongo():
    """Create database connection."""
    try:
        # Check if DATABASE_URL is configured
        if not settings.DATABASE_URL or settings.DATABASE_URL == "your_database_url_here":
            logger.warning("DATABASE_URL not properly configured in settings. Skipping MongoDB connection.")
            return

        # Connect to MongoDB
        db.client = AsyncIOMotorClient(settings.DATABASE_URL)
        
        # Parse the database name from the connection string
        # or use a default name if not specified
        if "mongodb://" in settings.DATABASE_URL:
            # Try to extract db name from connection string
            parts = settings.DATABASE_URL.split("/")
            db_name = parts[-1].split("?")[0] if len(parts) > 3 else "medical_consultation"
        else:
            db_name = "medical_consultation"
            
        # Get the database with the name
        db.db = db.client[db_name]
        
        logger.info(f"Connected to MongoDB database: {db_name}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        # Allow the app to run without MongoDB for development/testing
        logger.warning("Running without MongoDB connection. Some features may not work.")

async def close_mongo_connection():
    """Close database connection."""
    if db.client:
        db.client.close()
        logger.info("Closed MongoDB connection")

def get_database() -> Database:
    """Get database instance."""
    if not db.db:
        raise Exception("Database not connected. Call connect_to_mongo() first.")
    return db.db 