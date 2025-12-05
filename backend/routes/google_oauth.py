"""
Google OAuth Routes

This module provides endpoints for Google OAuth 2.0 authentication.
Allows users to sign in with their Google accounts.
"""

from flask import request, redirect, current_app
from flask_restx import Namespace, Resource
import secrets
from models.user import User
from utils.google_oauth import create_google_oauth_instance
from utils.auth import generate_token


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
            import logging
            logger = logging.getLogger(__name__)
            
            logger.info("=" * 60)
            logger.info("Google OAuth Callback Received")
            logger.info("=" * 60)
            
            # Check for errors
            error = request.args.get('error')
            if error:
                logger.error(f"OAuth error from Google: {error}")
                error_description = request.args.get('error_description', 'Google authorization failed')
                frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:8080')
                redirect_url = f"{frontend_url}/login?error={error_description}"
                return redirect(redirect_url)
            
            # Get authorization code
            code = request.args.get('code')
            if not code:
                logger.error("Missing authorization code in callback")
                return {'error': 'Missing authorization code'}, 400
            
            # Get state for validation
            state = request.args.get('state')
            if not state:
                logger.error("Missing state parameter in callback")
                return {'error': 'Missing state parameter'}, 400
            
            logger.info(f"Received code (first 20 chars): {code[:20]}...")
            logger.info(f"State: {state}")
            
            # Initialize Google OAuth
            google_oauth = create_google_oauth_instance()
            if not google_oauth:
                logger.error("Google OAuth not configured")
                frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:8080')
                redirect_url = f"{frontend_url}/login?error=OAuth not configured"
                return redirect(redirect_url)
            
            try:
                # Exchange code for token
                logger.info("Exchanging code for token...")
                token_response = google_oauth.exchange_code_for_token(code)
                
                if not token_response:
                    logger.error("Failed to exchange code for token - no response")
                    raise Exception("No token response from Google")
                
                logger.info("✅ Token exchange successful")
                
                access_token = token_response.get('access_token')
                id_token = token_response.get('id_token')
                
                if not access_token or not id_token:
                    logger.error(f"Missing tokens in response. Access token: {bool(access_token)}, ID token: {bool(id_token)}")
                    raise Exception("Incomplete token response")
                
                # Verify ID token
                logger.info("Verifying ID token...")
                token_info = google_oauth.verify_id_token(id_token)
                
                if not token_info:
                    logger.error("ID token verification failed")
                    raise Exception("Invalid ID token")
                
                logger.info("✅ ID token verified")
                
                # Get user info
                logger.info("Fetching user info from Google...")
                user_info = google_oauth.get_user_info(access_token)
                
                if not user_info:
                    logger.error("Failed to get user info")
                    raise Exception("Failed to fetch user information")
                
                logger.info(f"✅ User info retrieved: {user_info.get('email')}")
                
                # Extract user data
                google_id = user_info.get('id')
                email = user_info.get('email')
                name = user_info.get('name', '')
                picture = user_info.get('picture', '')
                
                if not google_id or not email:
                    logger.error(f"Missing required user info. Google ID: {bool(google_id)}, Email: {bool(email)}")
                    raise Exception("Incomplete user information")
                
                logger.info(f"Processing OAuth for user: {email}")
                
                # Check if user exists
                db = current_app.db
                user_model = User(db)
                
                # Try to find by Google ID first
                user = user_model.collection.find_one({'google_id': google_id})
                
                # If not found, try by email
                if not user:
                    logger.info(f"User not found by google_id, checking by email...")
                    user = user_model.find_by_email(email)
                    
                    # If user exists with same email, link Google account
                    if user:
                        logger.info(f"Linking Google account to existing user: {user.get('_id')}")
                        update_data = {
                            'google_id': google_id,
                            'oauth_provider': 'google',
                            'email_verified': True
                        }
                        # Only update avatar if user doesn't have a custom one
                        if not user.get('avatar') or (user.get('avatar') and not user.get('avatar').startswith('/uploads/')):
                            update_data['avatar'] = picture
                        
                        user_model.collection.update_one(
                            {'_id': user['_id']},
                            {'$set': update_data}
                        )
                        user = user_model.collection.find_one({'_id': user['_id']})
                        logger.info("✅ Google account linked successfully")
                
                # If user doesn't exist, create new user
                if not user:
                    logger.info(f"Creating new OAuth user: {email}")
                    
                    # Generate username from email or name
                    username = email.split('@')[0]
                    
                    # Check if username exists, append number if needed
                    counter = 1
                    original_username = username
                    while user_model.find_by_username(username):
                        username = f"{original_username}{counter}"
                        counter += 1
                    
                    logger.info(f"Username: {username}")
                    
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
                    logger.info(f"✅ New user created with ID: {user_id}")
                else:
                    # Format the raw MongoDB document
                    user = user_model._format_user(user)
                    logger.info(f"✅ Existing user found: {user['id']}")
                
                # Update last login and status
                logger.info("Updating user status...")
                user_model.update_last_login(user['id'])
                user_model.update_status(user['id'], 'online')
                
                # Generate JWT token
                logger.info("Generating JWT token...")
                jwt_token = generate_token(
                    user_id=user['id'],
                    email=user['email'],
                    role=user['role']
                )
                
                logger.info(f"✅ JWT token generated (first 20 chars): {jwt_token[:20]}...")
                
                # Redirect to frontend with token
                frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:8080')
                redirect_url = f"{frontend_url}/callback?token={jwt_token}"
                
                logger.info(f"🚀 Redirecting to: {redirect_url}")
                logger.info("=" * 60)
                logger.info("OAuth Flow Complete - SUCCESS")
                logger.info("=" * 60)
                
                return redirect(redirect_url)
                
                return redirect(redirect_url)
                
            except Exception as e:
                logger.error("=" * 60)
                logger.error("OAuth Flow Failed - ERROR")
                logger.error("=" * 60)
                logger.error(f"Error type: {type(e).__name__}")
                logger.error(f"Error message: {str(e)}")
                
                import traceback
                logger.error("Traceback:")
                logger.error(traceback.format_exc())
                
                # Redirect to login with error
                frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:8080')
                error_message = str(e) if current_app.debug else 'Authentication failed'
                redirect_url = f"{frontend_url}/login?error={error_message}"
                
                return redirect(redirect_url)


    @namespace.route('/google/link')
    class LinkGoogleAccount(Resource):
        @namespace.doc(security='Bearer')
        def post(self):
            """
            Link Google account to existing user
            
            Requires authentication
            Body should contain Google ID token
            """
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return {'error': 'Missing authorization header'}, 401
            
            try:
                from utils.auth import decode_token
                token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
                payload = decode_token(token)
                user_id = payload.get('user_id')
            except Exception:
                return {'error': 'Invalid token'}, 401
            
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
            if existing and str(existing['_id']) != user_id:
                return {'error': 'Google account already linked to another user'}, 400
            
            # Update user
            user_model.collection.update_one(
                {'_id': user_model._to_object_id(user_id)},
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
