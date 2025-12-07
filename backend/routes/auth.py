"""
Simplified Authentication Routes - Email verification and user utilities

IMPORTANT: Primary authentication (login/logout/OAuth) is now handled by NextAuth.js
This module only provides supplementary functionality that NextAuth doesn't handle.

RETURN FORMAT STANDARDS FOR FLASK-RESTX:
=========================================
All endpoints in this module and across the application MUST follow these standards:

1. ALWAYS return JSON-serializable data types (dict, list, str, int, float, bool, None)
2. NEVER return Flask Response objects directly (use dict with status code instead)
3. Standard success response format:
   return {'key': 'value', ...}, 200
   
4. Standard error response format:
   return {'error': 'Error message', 'details': '...'}, 4xx/5xx
   
5. For endpoints that need redirects (like OAuth callbacks):
   return {'redirect_url': 'https://...', 'token': '...', ...}, 200
   (Let the frontend handle the actual redirect)
   
6. Tuples should have exactly 2 elements: (data_dict, status_code)
   CORRECT:   return {'data': value}, 200
   INCORRECT: return ({'data': value}), 200  # Extra parentheses create single-element tuple
   
7. Optional third element for custom headers:
   return {'data': value}, 200, {'Custom-Header': 'value'}
   
8. Flask-RESTX will automatically serialize the dict to JSON
   DO NOT use jsonify() - it creates Response objects that break serialization

These standards ensure consistent, error-free communication between frontend and backend.
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.user import User
from utils.auth import token_required, get_current_user
from utils.validators import validate_email, validate_password, validate_name, validate_phone
from utils.email_service import send_verification_email, send_welcome_email
import secrets
from datetime import datetime, timedelta

auth_ns = Namespace('auth', description='Authentication utilities (NextAuth integration)')

# Email verification model
verify_email_model = auth_ns.model('VerifyEmail', {
    'token': fields.String(required=True, description='Email verification token')
})

# User registration model (for admin use or special cases)
register_model = auth_ns.model('Register', {
    'email': fields.String(required=True, description='User email', example='john@example.com'),
    'password': fields.String(required=True, description='Password', example='SecurePass123'),
    'name': fields.String(required=True, description='Full name', example='John Doe'),
    'phone': fields.String(description='Phone number', example='+1234567890'),
    'role': fields.String(description='User role', example='user', enum=['admin', 'user'])
})


@auth_ns.route('/me')
class CurrentUser(Resource):
    @token_required
    @auth_ns.doc(security='Bearer')
    def get(self):
        """Get current authenticated user information (from NextAuth session)"""
        try:
            # Get user info from NextAuth token (validated by @token_required)
            current_user = get_current_user()

            if not current_user:
                return {'error': 'User information not found in token'}, 401

            # Optionally fetch fresh user data from database
            db = current_app.db
            user_model = User(db)
            user = user_model.find_by_id(current_user['user_id'])

            if not user:
                return {'error': 'User not found in database'}, 404

            # Return formatted user data
            user_data = {
                'id': user['id'],
                'email': user.get('email'),
                'username': user.get('username'),
                'name': user.get('name') or user.get('full_name') or user.get('username') or user.get('email', '').split('@')[0],
                'full_name': user.get('full_name'),
                'role': user.get('role'),
                'avatar': user.get('avatar'),
                'picture': user.get('picture'),
                'phone': user.get('phone'),
                'status': user.get('status', 'offline'),
                'status_message': user.get('status_message'),
                'google_id': user.get('google_id'),
                'oauth_provider': user.get('oauth_provider'),
                'email_verified': user.get('email_verified'),
                'created_at': user.get('created_at')
            }

            return {'user': user_data}, 200
        except Exception as e:
            current_app.logger.error(f"Error getting current user: {str(e)}")
            return {'error': 'Failed to get user information'}, 500


@auth_ns.route('/logout')
class Logout(Resource):
    @token_required
    @auth_ns.doc(security='Bearer')
    def post(self):
        """Update user status to offline (NextAuth handles session invalidation)"""
        try:
            current_user = get_current_user()

            if not current_user:
                return {'error': 'User information not found'}, 401

            # Update user status to offline
            db = current_app.db
            user_model = User(db)
            user_model.update_status(current_user['user_id'], 'offline')

            return {'message': 'Status updated to offline. NextAuth handles session logout.'}, 200
        except Exception as e:
            current_app.logger.error(f"Logout error: {str(e)}")
            return {'error': 'Logout status update failed'}, 500


@auth_ns.route('/register')
class Register(Resource):
    @auth_ns.expect(register_model)
    def post(self):
        """
        Register a new user (for special cases - most registration handled by NextAuth)

        IMPORTANT: This route is primarily for admin use or special registration scenarios.
        Normal user registration should go through NextAuth with Google OAuth or credentials.
        """
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip() if data.get('phone') else None
        role = data.get('role', 'user')

        # Validate input
        is_valid, error = validate_email(email)
        if not is_valid:
            return {'error': error}, 400

        is_valid, error = validate_password(password)
        if not is_valid:
            return {'error': error}, 400

        is_valid, error = validate_name(name)
        if not is_valid:
            return {'error': error}, 400

        if phone:
            is_valid, error = validate_phone(phone)
            if not is_valid:
                return {'error': error}, 400

        try:
            db = current_app.db
            user_model = User(db)

            # Generate unique username from email
            username = email.split('@')[0]
            counter = 1
            original_username = username
            while user_model.find_by_username(username):
                username = f"{original_username}{counter}"
                counter += 1

            # Generate verification token
            verification_token = secrets.token_urlsafe(32)
            verification_expires = datetime.utcnow() + timedelta(hours=24)

            # Create user
            user_data = {
                'email': email,
                'username': username,
                'password': password,
                'full_name': name,
                'phone': phone,
                'role': role,
                'email_verified': False,
                'verification_token': verification_token,
                'verification_expires': verification_expires
            }

            user_id = user_model.create(user_data)
            user = user_model.find_by_id(user_id)

            # Send verification email
            email_sent = send_verification_email(email, name, verification_token)

            message = ('Registration successful! Please check your email to verify your account. '
                      'You can then sign in using NextAuth.')

            return {
                'message': message,
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'username': user.get('username'),
                    'full_name': user.get('full_name'),
                    'role': user['role'],
                    'email_verified': user.get('email_verified', False)
                },
                'email_sent': email_sent,
                'next_step': 'Use NextAuth to sign in after email verification'
            }, 201
        except ValueError as e:
            return {'error': str(e)}, 409
        except Exception as e:
            current_app.logger.error(f"Registration error for {email}: {str(e)}")

            if 'duplicate' in str(e).lower() or 'email' in str(e).lower() and 'exists' in str(e).lower():
                return {'error': 'User with this email already exists.'}, 409
            else:
                return {'error': 'Registration failed. Please try again.'}, 500


@auth_ns.route('/verify-email')
class VerifyEmail(Resource):
    @auth_ns.expect(verify_email_model)
    def post(self):
        """Verify user's email address using verification token"""
        data = request.get_json()
        token = data.get('token', '').strip()

        if not token:
            return {'error': 'Verification token is required'}, 400

        try:
            db = current_app.db
            user_model = User(db)

            # Verify email using token
            user = user_model.verify_email(token)

            if not user:
                return {'error': 'Invalid or expired verification token'}, 400

            # Send welcome email
            send_welcome_email(user['email'], user.get('full_name', user['username']))

            return {
                'message': 'Email verified successfully! You can now sign in using NextAuth.',
                'user': user,
                'next_step': 'Sign in at /login using your email and password or Google OAuth'
            }, 200

        except Exception as e:
            current_app.logger.error(f"Email verification error: {str(e)}")
            return {'error': 'Email verification failed'}, 500


# Health check endpoint to verify NextAuth integration
@auth_ns.route('/status')
class AuthStatus(Resource):
    def get(self):
        """Get authentication system status"""
        return {
            'auth_provider': 'NextAuth.js',
            'backend_integration': 'Flask + NextAuth JWT validation',
            'supported_providers': ['credentials', 'google'],
            'endpoints': {
                'login': 'Handled by NextAuth at /api/auth/signin',
                'logout': 'Handled by NextAuth at /api/auth/signout',
                'session': 'Handled by NextAuth at /api/auth/session',
                'registration': '/api/auth/register (limited use)',
                'email_verification': '/api/auth/verify-email'
            }
        }, 200

