"""
Google OAuth Routes

This module provides endpoints for Google OAuth 2.0 authentication.
Allows users to sign in with their Google accounts.

RETURN FORMAT STANDARDS:
========================
All endpoints MUST return JSON-serializable data (dict, list, etc.) with status codes.
NEVER return Flask Response objects (like redirect()) directly - they are not JSON-serializable.
For redirects, return a dict with 'redirect_url' field and let the frontend handle navigation.

Examples:
  CORRECT:   return {'redirect_url': url, 'token': token}, 200
  INCORRECT: return redirect(url)  # Not JSON-serializable
"""

from flask import request, current_app
from flask_restx import Namespace, Resource
import secrets
from models.user import User
from utils.google_oauth import create_google_oauth_instance
from utils.auth import generate_token, token_required


def register_google_routes(namespace):
    """Register Google OAuth routes on the provided namespace"""
    
    @namespace.route('/google')
    class GoogleLogin(Resource):
        @namespace.doc(
            description='Get Google OAuth URL to start authentication flow',
            responses={
                200: 'Success - Returns auth_url to redirect user to Google',
                500: 'OAuth not configured'
            }
        )
        def get(self):
            """
            Initiate Google OAuth flow
            
            **How to use:**
            1. Call this endpoint to get the auth_url
            2. Copy the auth_url from the response
            3. Open auth_url in your browser to sign in with Google
            4. After successful login, you'll be redirected back with a JWT token
            
            **Returns:**
            - auth_url: URL to redirect user to Google sign-in page
            - state: CSRF protection token (automatically handled)
            """
            google_oauth = create_google_oauth_instance()
            
            if not google_oauth:
                return {
                    'error': 'Google OAuth not configured',
                    'message': 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment'
                }, 500
            
            # Generate random state for CSRF protection
            state = secrets.token_urlsafe(32)
            
            # Store state in session (you can also use Redis for production)
            # For now, we'll validate it in the callback
            
            # Get authorization URL
            auth_url = google_oauth.get_authorization_url(state=state)
            
            # Return URL for frontend to redirect to
            # Or redirect directly if called from backend
            return {
                'auth_url': auth_url,
                'state': state
            }, 200


    @namespace.route('/google/callback')
    class GoogleCallback(Resource):
        @namespace.doc(
            description='OAuth callback endpoint - automatically called by Google after user signs in',
            params={
                'code': 'Authorization code from Google (automatic)',
                'state': 'CSRF protection token (automatic)',
                'error': 'Error message if authorization failed'
            },
            responses={
                302: 'Success - Redirects to frontend with JWT token',
                400: 'Missing or invalid parameters',
                500: 'Server error during authentication'
            }
        )
        @namespace.doc(deprecated=False, hidden=False)
        def get(self):
            """
            Handle Google OAuth callback
            
            **Note:** This endpoint is called automatically by Google after user signs in.
            You don't need to call this manually. It will redirect to your frontend with a token.
            """
            # Check for errors
            error = request.args.get('error')
            if error:
                return {
                    'error': error,
                    'message': 'Google authorization failed'
                }, 400
            
            # Get authorization code
            code = request.args.get('code')
            if not code:
                return {'error': 'Missing authorization code'}, 400
            
            # Get state for validation
            state = request.args.get('state')
            if not state:
                return {'error': 'Missing state parameter'}, 400
            
            # Initialize Google OAuth
            google_oauth = create_google_oauth_instance()
            if not google_oauth:
                return {'error': 'Google OAuth not configured'}, 500
            
            try:
                # Exchange code for token
                token_response = google_oauth.exchange_code_for_token(code)
                if not token_response:
                    return {'error': 'Failed to exchange code for token'}, 500
                
                access_token = token_response.get('access_token')
                id_token = token_response.get('id_token')
                
                # Verify ID token
                token_info = google_oauth.verify_id_token(id_token)
                if not token_info:
                    return {'error': 'Invalid ID token'}, 401
                
                # Get user info
                user_info = google_oauth.get_user_info(access_token)
                if not user_info:
                    return {'error': 'Failed to get user info'}, 500
                
                # Extract user data
                google_id = user_info.get('id')
                email = user_info.get('email')
                name = user_info.get('name', '')
                picture = user_info.get('picture', '')
                
                if not google_id or not email:
                    return {'error': 'Missing user information'}, 400
                
                # Check if user exists
                db = current_app.db
                user_model = User(db)
                
                # Try to find by Google ID first
                user = user_model.collection.find_one({'google_id': google_id})
                
                # If not found, try by email
                if not user:
                    user = user_model.find_by_email(email)
                    
                    # If user exists with same email, link Google account
                    if user:
                        # Only update avatar if user doesn't have a custom one
                        update_data = {
                            'google_id': google_id,
                            'oauth_provider': 'google'
                        }
                        # Only update avatar if user doesn't have one or it's not a custom upload
                        if not user.get('avatar') or (user.get('avatar') and not user.get('avatar').startswith('/uploads/')):
                            update_data['avatar'] = picture
                        
                        user_model.collection.update_one(
                            {'_id': user['_id']},
                            {'$set': update_data}
                        )
                        user = user_model.collection.find_one({'_id': user['_id']})
                
                # If user doesn't exist, create new user
                if not user:
                    # Generate username from email or name
                    username = email.split('@')[0]
                    
                    # Check if username exists, append number if needed
                    counter = 1
                    original_username = username
                    while user_model.find_by_username(username):
                        username = f"{original_username}{counter}"
                        counter += 1
                    
                    # Create new user (no password needed for OAuth users)
                    user_data = {
                        'email': email,
                        'username': username,
                        'name': name,
                        'full_name': name,
                        'avatar': picture,
                        'google_id': google_id,
                        'oauth_provider': 'google',
                        'role': 'user',
                        'status': 'online',
                        'email_verified': True  # OAuth users are pre-verified
                    }
                    
                    user_id = user_model.create(user_data)
                    user = user_model.find_by_id(user_id)
                else:
                    # Format the raw MongoDB document
                    user = user_model._format_user(user)
                
                # Update last login and status
                user_model.update_last_login(user['id'])
                user_model.update_status(user['id'], 'online')
                
                # Generate JWT token
                jwt_token = generate_token(
                    user_id=user['id'],
                    email=user['email'],
                    role=user['role']
                )
                
                # Return JSON with redirect URL and token
                # Frontend should handle the redirect with the token
                frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:8080')
                redirect_url = f"{frontend_url}/callback?token={jwt_token}"
                
                # Return serializable JSON response with redirect information
                # This allows Flask-RESTX to properly serialize the response
                return {
                    'success': True,
                    'redirect_url': redirect_url,
                    'token': jwt_token,
                    'user': {
                        'id': user['id'],
                        'email': user['email'],
                        'name': user.get('name') or user.get('full_name'),
                        'role': user['role']
                    },
                    'message': 'Google login successful - redirect to the provided URL'
                }, 200
                
            except Exception as e:
                current_app.logger.error(f"Google OAuth error: {str(e)}")
                return {'error': 'Authentication failed', 'details': str(e)}, 500


    @namespace.route('/google/link')
    class LinkGoogleAccount(Resource):
        @namespace.doc(security='Bearer')
        @token_required
        def post(self, current_user):
            """
            Link Google account to existing user

            Requires authentication
            Body should contain Google ID token
            """
            data = request.get_json()
            id_token = data.get('id_token')

            if not id_token:
                return {'error': 'Missing ID token'}, 400

            # Verify ID token
            google_oauth = create_google_oauth_instance()
            if not google_oauth:
                return {'error': 'Google OAuth not configured'}, 500

            token_info = google_oauth.verify_id_token(id_token)
            if not token_info:
                return {'error': 'Invalid ID token'}, 401

            google_id = token_info.get('sub')
            google_email = token_info.get('email')

            # Update user with Google ID
            db = current_app.db
            user_model = User(db)

            # Check if Google ID is already linked to another user
            existing = user_model.collection.find_one({'google_id': google_id})
            if existing and str(existing['_id']) != current_user['user_id']:
                return {'error': 'Google account already linked to another user'}, 400

            # Update user
            user_model.collection.update_one(
                {'_id': user_model._to_object_id(current_user['user_id'])},
                {'$set': {
                    'google_id': google_id,
                    'oauth_provider': 'google'
                }}
            )

            return {
                'success': True,
                'message': 'Google account linked successfully',
                'google_email': google_email
            }, 200
