"""
Authentication Utilities

This module handles NextAuth JWT token verification.

LEARNING NOTE:
- Now validates NextAuth.js JWT tokens instead of custom tokens
- NextAuth tokens are signed with NEXTAUTH_SECRET
- Provides seamless integration between Next.js frontend and Flask backend
"""

import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, current_app, jsonify
from typing import Optional, Dict, Any


def verify_nextauth_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a NextAuth JWT token.

    LEARNING NOTE:
    - NextAuth uses NEXTAUTH_SECRET for signing tokens
    - Token payload structure differs from custom JWT
    - Contains user info from NextAuth session

    Args:
        token: NextAuth JWT token string

    Returns:
        dict: Decoded user payload if valid, None otherwise
    """

    try:
        # Get NextAuth secret from environment
        nextauth_secret = current_app.config.get('NEXTAUTH_SECRET')

        if not nextauth_secret:
            current_app.logger.error('NEXTAUTH_SECRET not configured')
            return None

        # Decode and verify NextAuth token
        # NextAuth uses HS256 algorithm by default
        payload = jwt.decode(
            token,
            nextauth_secret,
            algorithms=['HS256'],
            options={"verify_signature": True}
        )

        current_app.logger.info(f'✅ Verified NextAuth token for user: {payload.get("email", "unknown")}')

        # Extract user information from NextAuth token payload
        # NextAuth tokens have different structure than custom tokens
        user_info = {
            'user_id': payload.get('id') or payload.get('sub'),
            'email': payload.get('email'),
            'role': payload.get('role', 'user'),
            'name': payload.get('name'),
            'phone': payload.get('phone'),
            'exp': payload.get('exp'),
            'iat': payload.get('iat')
        }

        return user_info

    except jwt.ExpiredSignatureError:
        current_app.logger.warning('NextAuth token has expired')
        return None

    except jwt.InvalidTokenError as e:
        current_app.logger.warning(f'Invalid NextAuth token: {str(e)}')
        return None

    except Exception as e:
        current_app.logger.error(f'Error verifying NextAuth token: {str(e)}')
        return None


def token_required(f):
    """
    Decorator to protect routes that require NextAuth authentication.

    LEARNING NOTE:
    - Updated to verify NextAuth JWT tokens
    - Provides seamless auth integration with Next.js frontend
    - Maintains same interface for Flask routes

    Usage:
        @token_required
        def protected_route():
            # This route requires valid NextAuth token
            pass

    Args:
        f: Function to be decorated

    Returns:
        Wrapped function that checks NextAuth authentication
    """

    @wraps(f)  # Preserves original function metadata
    def decorated(*args, **kwargs):
        """
        Wrapper function that performs NextAuth token validation.
        """

        # Get token from Authorization header
        # Expected format: "Bearer <nextauth-token>"
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            current_app.logger.warning('Missing Authorization header')
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Authorization header is missing'
            }), 401

        # Parse token from header
        try:
            # Split "Bearer <token>" and get token part
            token_parts = auth_header.split()

            if len(token_parts) != 2 or token_parts[0].lower() != 'bearer':
                current_app.logger.warning('Invalid authorization header format')
                return jsonify({
                    'error': 'Unauthorized',
                    'message': 'Invalid authorization header format. Use: Bearer <token>'
                }), 401

            token = token_parts[1]

        except Exception as e:
            current_app.logger.warning(f'Error parsing authorization header: {str(e)}')
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid authorization header'
            }), 401

        # Verify NextAuth token
        user_payload = verify_nextauth_token(token)

        if not user_payload:
            current_app.logger.warning('Invalid or expired NextAuth token')
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid or expired token'
            }), 401

        # Add user info to request context
        # This makes user data available in route function
        request.current_user = user_payload

        # Call the original function
        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    """
    Decorator to protect routes that require admin role.

    Updated to work with NextAuth tokens.

    Usage:
        @admin_required
        def admin_only_route():
            # This route requires admin role
            pass

    Args:
        f: Function to be decorated

    Returns:
        Wrapped function that checks admin role
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        """
        Wrapper function that checks admin role using NextAuth token.
        """

        # First check if user is authenticated
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Authorization header is missing'
            }), 401

        # Parse and verify NextAuth token
        try:
            token = auth_header.split()[1]
            user_payload = verify_nextauth_token(token)

            if not user_payload:
                return jsonify({
                    'error': 'Unauthorized',
                    'message': 'Invalid or expired token'
                }), 401

            # Check if user has admin role
            if user_payload.get('role') != 'admin':
                current_app.logger.warning(f'Non-admin user {user_payload.get("email")} attempted admin access')
                return jsonify({
                    'error': 'Forbidden',
                    'message': 'Admin access required'
                }), 403

            # Add user info to request
            request.current_user = user_payload

            return f(*args, **kwargs)

        except Exception as e:
            current_app.logger.warning(f'Error in admin_required decorator: {str(e)}')
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid authorization header'
            }), 401

    return decorated


def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user from request context.

    Returns:
        dict: Current user payload from NextAuth token or None
    """
    return getattr(request, 'current_user', None)


# Legacy functions - kept for backward compatibility but deprecated
def generate_token(user_id: str, email: str, role: str) -> str:
    """
    DEPRECATED: Legacy function for custom JWT generation.

    Use NextAuth.js for token generation instead.
    This function is kept for backward compatibility only.
    """
    current_app.logger.warning('generate_token() is deprecated - use NextAuth.js for authentication')

    # Return a dummy token to maintain compatibility
    return "deprecated_use_nextauth"


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    DEPRECATED: Legacy function for custom JWT verification.

    Use verify_nextauth_token() instead.
    This function is kept for backward compatibility only.
    """
    current_app.logger.warning('verify_token() is deprecated - use verify_nextauth_token()')

    # Try NextAuth token verification as fallback
    return verify_nextauth_token(token)
