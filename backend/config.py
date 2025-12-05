"""
Configuration Module for Flask Application

This module contains all configuration settings for the Flask app.
It loads environment variables and provides different config classes
for development, testing, and production environments.
"""

import os
import logging
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """
    Base configuration class with default settings.
    Other config classes inherit from this.
    """

    def __init__(self):
        """Initialize configuration"""
        pass

    # Flask Core Settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

    # MongoDB Configuration
    MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/chatapp')
    MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'chatapp')

    # JWT (JSON Web Token) Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', 168))  # 7 days
    JWT_EXPIRATION_DELTA = timedelta(hours=JWT_EXPIRATION_HOURS)

    # CORS (Cross-Origin Resource Sharing) Configuration
    # Allows frontend to make requests from different origin
    # For production, set CORS_ORIGINS to your actual frontend domain(s)
    # Example: CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
    cors_origins_str = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:8080')
    CORS_ORIGINS = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]

    # Server Configuration
    PORT = int(os.getenv('PORT', 5001))
    HOST = os.getenv('HOST', '0.0.0.0')

    # Upload Configuration
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 52428800))  # 50MB
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'doc', 'docx'}

    # Redis Configuration (Optional - for caching)
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

    # Email Configuration (Optional)
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', '')

    # Pagination
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 100

    # Rate Limiting (requests per minute)
    RATE_LIMIT = 100

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5001/api/auth/google/callback')

    # Frontend URL (for OAuth redirects)
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:8080')

    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

    def get_log_level(self):
        """Convert string log level to logging constant"""
        log_levels = {
            'DEBUG': logging.DEBUG,
            'INFO': logging.INFO,
            'WARNING': logging.WARNING,
            'ERROR': logging.ERROR,
            'CRITICAL': logging.CRITICAL
        }
        return log_levels.get(self.LOG_LEVEL, logging.INFO)


class DevelopmentConfig(Config):
    """Development environment configuration"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production environment configuration"""
    DEBUG = False
    TESTING = False

    # Enforce HTTPS in production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Override CORS_ORIGINS to ensure production domains are set
    # Will raise error if CORS_ORIGINS not explicitly set in production
    def __init__(self):
        super().__init__()
        origins = os.getenv('CORS_ORIGINS')
        if not origins:
            # Default to the Lightsail domain if not explicitly set
            self.CORS_ORIGINS = ['https://chat-app.efr21as675de2.us-west-2.cs.amazonlightsail.com']
        else:
            # Check for localhost in production and warn but don't crash
            if 'localhost' in origins:
                logger = logging.getLogger(__name__)
                logger.warning(
                    "CORS_ORIGINS contains localhost in production environment. "
                    "This should be avoided in production deployments."
                )

            self.CORS_ORIGINS = [origin.strip() for origin in origins.split(',') if origin.strip()]


class TestingConfig(Config):
    """Testing environment configuration"""
    TESTING = True
    MONGODB_URI = 'mongodb://localhost:27017/chatapp_test'
    MONGODB_DB_NAME = 'chatapp_test'


# Dictionary to easily switch between configs
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}


def get_config():
    """
    Returns the appropriate config class based on FLASK_ENV

    Returns:
        Config: Configuration class instance
    """
    env = os.getenv('FLASK_ENV', 'development')
    config_class = config_by_name.get(env, DevelopmentConfig)
    return config_class()
