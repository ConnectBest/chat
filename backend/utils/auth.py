"""
Authentication Utilities

This module handles NextAuth session validation via user headers.

LEARNING NOTE:
- NextAuth session verification is handled at Next.js API route level
- Flask receives validated user information via headers
- Provides seamless integration between Next.js frontend and Flask backend

CRITICAL SERIALIZATION NOTE:
- All decorators MUST return JSON-serializable tuples: (dict, status_code)
- NEVER use jsonify() in decorators - it creates Response objects incompatible with Flask-RESTX
- Response objects break JSON serialization in production Fargate deployments
- Always use: return {'error': 'message'}, 401
- Never use: return jsonify({'error': 'message'}), 401
"""

import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, current_app
from typing import Optional, Dict, Any


def verify_nextauth_token(token: str) -> Optional[Dict[str, Any]]:
    """
    DEPRECATED: Verify and decode a NextAuth JWT token.

    This function is kept for backward compatibility.
    New authentication flow uses user headers from Next.js API routes.
    """
    try:
        # Get NextAuth secret from environment
        nextauth_secret = current_app.config.get('NEXTAUTH_SECRET')

        if not nextauth_secret:
            current_app.logger.error('NEXTAUTH_SECRET not configured')
            return None

        # Decode and verify NextAuth token
        payload = jwt.decode(
            token,
            nextauth_secret,
            algorithms=['HS256'],
            options={"verify_signature": True}
        )

        current_app.logger.info(f'✅ Verified NextAuth token for user: {payload.get("email", "unknown")}')

        # Extract user information from NextAuth token payload
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


def extract_user_from_headers() -> Optional[Dict[str, Any]]:
    """
    Extract user information from NextAuth session headers.

    LEARNING NOTE:
    - Next.js API routes validate NextAuth session server-side
    - User information is passed via custom headers
    - More secure than client-side JWT handling
    """
    try:
        user_id = request.headers.get('X-User-ID')
        user_email = request.headers.get('X-User-Email')
        user_role = request.headers.get('X-User-Role', 'user')

        if not user_id or not user_email:
            current_app.logger.warning('Missing required user headers')
            return None

        user_info = {
            'user_id': user_id,
            'email': user_email,
            'role': user_role,
            'name': user_email.split('@')[0],  # Fallback name
        }

        current_app.logger.info(f'✅ Extracted user from headers: {user_email}')
        return user_info

    except Exception as e:
        current_app.logger.error(f'Error extracting user from headers: {str(e)}')
        return None


def token_required(f):
    """
    Decorator to protect routes that require NextAuth authentication.

    LEARNING NOTE:
    - Updated to use user headers from Next.js API routes
    - Falls back to JWT token validation for direct API access
    - Provides seamless auth integration with Next.js frontend

    Usage:
        @token_required
        def protected_route():
            # This route requires valid NextAuth session
            pass

    Args:
        f: Function to be decorated

    Returns:
        Wrapped function that checks NextAuth authentication
    """

    @wraps(f)  # Preserves original function metadata
    def decorated(*args, **kwargs):
        """
        Wrapper function that performs NextAuth session validation.
        """

        # First try to get user from headers (Next.js API route approach)
        user_payload = extract_user_from_headers()

        if user_payload:
            # Add user info to request context
            request.current_user = user_payload
            # Pass current_user as keyword argument to the wrapped function
            kwargs['current_user'] = user_payload
            return f(*args, **kwargs)

        # Fallback: try JWT token validation for direct API access
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            current_app.logger.warning('Missing user headers and Authorization header')
            # Return dict tuple - NEVER jsonify() in decorators (breaks Flask-RESTX serialization)
            return {
                'error': 'Unauthorized',
                'message': 'Authentication required'
            }, 401

        # Parse token from header
        try:
            token_parts = auth_header.split()

            if len(token_parts) != 2 or token_parts[0].lower() != 'bearer':
                current_app.logger.warning('Invalid authorization header format')
                # Return dict tuple - NEVER jsonify() (breaks serialization)
                return {
                    'error': 'Unauthorized',
                    'message': 'Invalid authorization header format. Use: Bearer <token>'
                }, 401

            token = token_parts[1]

        except Exception as e:
            current_app.logger.warning(f'Error parsing authorization header: {str(e)}')
            # Return dict tuple - NEVER jsonify() (breaks serialization)
            return {
                'error': 'Unauthorized',
                'message': 'Invalid authorization header'
            }, 401

        # Verify JWT token (fallback)
        user_payload = verify_nextauth_token(token)

        if not user_payload:
            current_app.logger.warning('Invalid or expired token')
            # Return dict tuple - NEVER jsonify() (breaks serialization)
            return {
                'error': 'Unauthorized',
                'message': 'Invalid or expired token'
            }, 401

        # Add user info to request context
        request.current_user = user_payload

        # Pass current_user as keyword argument to the wrapped function
        kwargs['current_user'] = user_payload

        # Call the original function
        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    """
    Decorator to protect routes that require admin role.

    Updated to work with NextAuth user headers and token fallback.

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
        Wrapper function that checks admin role using NextAuth session.
        """

        # First try to get user from headers
        user_payload = extract_user_from_headers()

        if not user_payload:
            # Fallback: try JWT token validation
            auth_header = request.headers.get('Authorization')

            if not auth_header:
                # Return dict tuple - NEVER jsonify() (breaks serialization)
                return {
                    'error': 'Unauthorized',
                    'message': 'Authentication required'
                }, 401

            try:
                token = auth_header.split()[1]
                user_payload = verify_nextauth_token(token)

                if not user_payload:
                    # Return dict tuple - NEVER jsonify() (breaks serialization)
                    return {
                        'error': 'Unauthorized',
                        'message': 'Invalid or expired token'
                    }, 401

            except Exception as e:
                current_app.logger.warning(f'Error in admin_required decorator: {str(e)}')
                # Return dict tuple - NEVER jsonify() (breaks serialization)
                return {
                    'error': 'Unauthorized',
                    'message': 'Invalid authorization header'
                }, 401

        # Check if user has admin role
        if user_payload.get('role') != 'admin':
            current_app.logger.warning(f'Non-admin user {user_payload.get("email")} attempted admin access')
            # Return dict tuple - NEVER jsonify() (breaks serialization)
            return {
                'error': 'Forbidden',
                'message': 'Admin access required'
            }, 403

        # Add user info to request
        request.current_user = user_payload

        # Pass current_user as keyword argument to the wrapped function
        kwargs['current_user'] = user_payload

        return f(*args, **kwargs)

    return decorated


def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user from request context.

    Returns:
        dict: Current user payload from NextAuth session or None
    """
    return getattr(request, 'current_user', None)


# Legacy functions - kept for backward compatibility but deprecated
def generate_token(user_id: str, email: str, role: str) -> str:
    """
    Generate a JWT token for user authentication.
    
    This function is used for OAuth flows where NextAuth is not handling the callback.
    For standard authentication flows, NextAuth.js should be used instead.
    
    Args:
        user_id: User's unique identifier
        email: User's email address
        role: User's role (admin, user, etc.)
    
    Returns:
        JWT token string
    """
    try:
        # Get JWT secret from configuration
        jwt_secret = current_app.config.get('JWT_SECRET_KEY')
        
        if not jwt_secret:
            current_app.logger.error('JWT_SECRET_KEY not configured')
            raise ValueError('JWT_SECRET_KEY not configured')
        
        # Create token payload
        now = datetime.now(timezone.utc)
        expiration_delta = current_app.config['JWT_EXPIRATION_DELTA']
        payload = {
            'user_id': user_id,  # Legacy field for compatibility with existing frontend code
            'id': user_id,       # Alternative legacy field
            'sub': user_id,      # Standard JWT claim (preferred)
            'email': email,
            'role': role,
            'iat': int(now.timestamp()),  # Issued at (Unix timestamp)
            'exp': int((now + expiration_delta).timestamp())  # Expires based on config (Unix timestamp)
        }
        
        # Generate JWT token
        token = jwt.encode(
            payload,
            jwt_secret,
            algorithm='HS256'
        )
        
        current_app.logger.debug('JWT token generated successfully')
        return token
        
    except Exception as e:
        current_app.logger.error(f'Error generating token: {str(e)}')
        raise


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    DEPRECATED: Legacy function for custom JWT verification.

    Use verify_nextauth_token() instead.
    This function is kept for backward compatibility only.
    """
    current_app.logger.warning('verify_token() is deprecated - use verify_nextauth_token()')

    # Try NextAuth token verification as fallback
    return verify_nextauth_token(token)
