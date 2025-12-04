"""
Authentication Utilities

This module handles JWT token generation and verification.

LEARNING NOTE:
- JWT (JSON Web Token) is used for stateless authentication
- Token contains user information (payload) that's cryptographically signed
- Server can verify token without database lookup
- Tokens have expiration date for security
"""

import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, current_app, jsonify
from typing import Optional, Dict, Any


def generate_token(user_id: str, email: str, role: str) -> str:
    """
    Generate a JWT token for a user.
    
    LEARNING NOTE:
    JWT Structure: header.payload.signature
    - Header: Algorithm and token type
    - Payload: User data (not encrypted, only encoded!)
    - Signature: Cryptographic signature to verify token wasn't tampered
    
    Args:
        user_id: User's unique ID
        email: User's email
        role: User's role (admin/user)
    
    Returns:
        str: JWT token string
    """
    
    # Get configuration
    secret_key = current_app.config['JWT_SECRET_KEY']
    expiration_delta = current_app.config['JWT_EXPIRATION_DELTA']
    
    # Create payload (data to include in token)
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'iat': datetime.utcnow(),  # Issued at
        'exp': datetime.utcnow() + expiration_delta  # Expiration time
    }
    
    # Generate token using HS256 algorithm
    token = jwt.encode(
        payload,
        secret_key,
        algorithm='HS256'
    )
    
    return token


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.
    
    LEARNING NOTE:
    - Checks if token signature is valid (not tampered)
    - Checks if token has expired
    - Returns None if token is invalid or expired
    
    Args:
        token: JWT token string
    
    Returns:
        dict: Decoded payload if valid, None otherwise
    """
    
    try:
        secret_key = current_app.config['JWT_SECRET_KEY']
        
        # Decode and verify token
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=['HS256']
        )
        
        return payload
    
    except jwt.ExpiredSignatureError:
        # Token has expired
        return None
    
    except jwt.InvalidTokenError:
        # Token is invalid (wrong signature, malformed, etc.)
        return None


def token_required(f):
    """
    Decorator to protect routes that require authentication.
    
    LEARNING NOTE:
    - Decorator is a function that wraps another function
    - Used to add functionality without modifying original function
    - This decorator checks if valid token is present in request
    
    Usage:
        @token_required
        def protected_route():
            # This route requires valid JWT token
            pass
    
    Args:
        f: Function to be decorated
    
    Returns:
        Wrapped function that checks authentication
    """
    
    @wraps(f)  # Preserves original function metadata
    def decorated(*args, **kwargs):
        """
        Wrapper function that performs token validation.
        """
        
        # Get token from Authorization header
        # Expected format: "Bearer <token>"
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Authorization header is missing'
            }), 401
        
        # Parse token from header
        try:
            # Split "Bearer <token>" and get token part
            token_parts = auth_header.split()
            
            if len(token_parts) != 2 or token_parts[0].lower() != 'bearer':
                return jsonify({
                    'error': 'Unauthorized',
                    'message': 'Invalid authorization header format. Use: Bearer <token>'
                }), 401
            
            token = token_parts[1]
        
        except Exception:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid authorization header'
            }), 401
        
        # Verify token
        payload = verify_token(token)
        
        if not payload:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid or expired token'
            }), 401
        
        # Add user info to request context
        # This makes user_id, email, role available in route function
        request.current_user = payload
        
        # Call the original function
        return f(*args, **kwargs)
    
    return decorated


def admin_required(f):
    """
    Decorator to protect routes that require admin role.
    
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
        Wrapper function that checks admin role.
        """
        
        # First check if user is authenticated
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Authorization header is missing'
            }), 401
        
        # Parse and verify token
        try:
            token = auth_header.split()[1]
            payload = verify_token(token)
            
            if not payload:
                return jsonify({
                    'error': 'Unauthorized',
                    'message': 'Invalid or expired token'
                }), 401
            
            # Check if user has admin role
            if payload.get('role') != 'admin':
                return jsonify({
                    'error': 'Forbidden',
                    'message': 'Admin access required'
                }), 403
            
            # Add user info to request
            request.current_user = payload
            
            return f(*args, **kwargs)
        
        except Exception:
            return jsonify({
                'error': 'Unauthorized',
                'message': 'Invalid authorization header'
            }), 401
    
    return decorated


def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user from request context.
    
    Returns:
        dict: Current user payload or None
    """
    return getattr(request, 'current_user', None)
