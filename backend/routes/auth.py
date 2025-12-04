"""
Authentication Routes - Handles user registration, login, and authentication
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.user import User
from utils.auth import generate_token
from utils.validators import validate_email, validate_password, validate_name, validate_phone
from utils.email_service import send_verification_email, send_welcome_email
import secrets
from datetime import datetime, timedelta

auth_ns = Namespace('auth', description='Authentication operations')

# Import Google OAuth routes to register them on same namespace
from routes.google_oauth import register_google_routes

register_model = auth_ns.model('Register', {
    'email': fields.String(required=True, description='User email', example='john@example.com'),
    'password': fields.String(required=True, description='Password', example='SecurePass123'),
    'name': fields.String(required=True, description='Full name', example='John Doe'),
    'phone': fields.String(description='Phone number', example='+1234567890'),
    'role': fields.String(description='User role', example='user', enum=['admin', 'user'])
})

login_model = auth_ns.model('Login', {
    'email': fields.String(required=True, example='john@example.com'),
    'password': fields.String(required=True, example='SecurePass123'),
    'two_factor_code': fields.String(description='6-digit 2FA code (if 2FA is enabled)', example='123456')
})


@auth_ns.route('/register')
class Register(Resource):
    @auth_ns.expect(register_model)
    def post(self):
        """Register a new user"""
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip() if data.get('phone') else None
        role = data.get('role', 'user')
        
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
            
            # Generate username from email
            username = email.split('@')[0]
            counter = 1
            original_username = username
            while user_model.find_by_username(username):
                username = f"{original_username}{counter}"
                counter += 1
            
            # Generate verification token (secure random string)
            verification_token = secrets.token_urlsafe(32)
            verification_expires = datetime.utcnow() + timedelta(hours=24)
            
            # Create user with verification fields
            user_data = {
                'email': email,
                'username': username,
                'password': password,
                'full_name': name,
                'role': role,
                'email_verified': False,
                'verification_token': verification_token,
                'verification_expires': verification_expires
            }
            
            user_id = user_model.create(user_data)
            user = user_model.find_by_id(user_id)
            
            # Send verification email (don't include token in response for security)
            email_sent = send_verification_email(email, name, verification_token)
            
            if email_sent:
                message = 'Registration successful! Please check your email to verify your account.'
            else:
                message = 'Registration successful! Email verification link will be sent shortly.'
            
            # Don't return verification_token or verification_expires to client
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
                'email_sent': email_sent
            }, 201
        except ValueError as e:
            return {'error': str(e)}, 409
        except Exception as e:
            current_app.logger.error(f"Registration error: {str(e)}")
            return {'error': 'Failed to register user'}, 500


@auth_ns.route('/login')
class Login(Resource):
    @auth_ns.expect(login_model)
    def post(self):
        """Login with email, password, and optional 2FA code"""
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        two_factor_code = data.get('two_factor_code', '').strip()
        
        if not email or not password:
            return {'error': 'Email and password are required'}, 400
        
        try:
            db = current_app.db
            user_model = User(db)
            user = user_model.find_by_email(email)
            
            if not user or not user_model.verify_password(user, password):
                return {'error': 'Invalid credentials'}, 401
            
            # Check if email is verified (skip for OAuth users)
            if not user.get('oauth_provider') and not user.get('email_verified'):
                return {
                    'error': 'Please verify your email before logging in. Check your inbox for the verification link.',
                    'email_not_verified': True
                }, 403
            
            # Check if 2FA is enabled
            if user.get('two_factor_enabled'):
                if not two_factor_code:
                    return {
                        'requires_2fa': True,
                        'message': 'Please enter your 2FA code'
                    }, 200
                
                # Verify 2FA code
                from utils.two_factor import verify_totp_code
                import bcrypt
                
                # Try TOTP code first
                if not verify_totp_code(user['two_factor_secret'], two_factor_code):
                    # Try backup codes
                    backup_codes = user.get('backup_codes', [])
                    backup_code_valid = False
                    used_code_index = None
                    
                    for i, hashed_code in enumerate(backup_codes):
                        if bcrypt.checkpw(two_factor_code.encode('utf-8'), hashed_code.encode('utf-8')):
                            backup_code_valid = True
                            used_code_index = i
                            break
                    
                    if not backup_code_valid:
                        return {'error': 'Invalid 2FA code'}, 401
                    
                    # Remove used backup code
                    if used_code_index is not None:
                        backup_codes.pop(used_code_index)
                        user_model.collection.update_one(
                            {'_id': user['_id']},
                            {'$set': {'backup_codes': backup_codes}}
                        )
            
            user_model.update_last_login(str(user['_id']))
            user_model.update_status(str(user['_id']), 'online')
            
            formatted_user = user_model._format_user(user)
            token = generate_token(user_id=formatted_user['id'], email=formatted_user['email'], role=formatted_user['role'])
            
            return {'user': formatted_user, 'token': token}, 200
        except Exception as e:
            current_app.logger.error(f"Login error: {str(e)}")
            return {'error': 'Login failed'}, 500


@auth_ns.route('/me')
class CurrentUser(Resource):
    @auth_ns.doc(security='Bearer')
    def get(self):
        """Get current authenticated user information"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Authorization header is missing'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            
            if not payload:
                return {'error': 'Invalid or expired token'}, 401
            
            db = current_app.db
            user_model = User(db)
            user = user_model.find_by_id(payload['user_id'])
            
            if not user:
                return {'error': 'User not found'}, 404
            
            # Format user data with name field - prioritize 'name' field, then fall back to others
            user_data = {
                'id': user['id'],
                'email': user.get('email'),
                'username': user.get('username'),
                'name': user.get('name') or user.get('full_name') or user.get('username') or user.get('email', '').split('@')[0],
                'full_name': user.get('full_name'),
                'role': user.get('role'),
                'avatar': user.get('avatar'),
                'picture': user.get('picture'),  # Include picture field for backward compatibility
                'phone': user.get('phone'),
                'status': user.get('status', 'offline'),
                'status_message': user.get('status_message'),
                'google_id': user.get('google_id'),
                'created_at': user.get('created_at')
            }
            
            return {'user': user_data}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to get user information'}, 500


@auth_ns.route('/logout')
class Logout(Resource):
    @auth_ns.doc(security='Bearer')
    def post(self):
        """Logout current user"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Authorization header is missing'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            
            if not payload:
                return {'error': 'Invalid or expired token'}, 401
            
            db = current_app.db
            user_model = User(db)
            user_model.update_status(payload['user_id'], 'offline')
            
            return {'message': 'Logged out successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Logout error: {str(e)}")
            return {'error': 'Logout failed'}, 500


verify_email_model = auth_ns.model('VerifyEmail', {
    'token': fields.String(required=True, description='Email verification token')
})


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
            
            # Generate token for auto-login
            auth_token = generate_token(user_id=user['id'], email=user['email'], role=user['role'])
            
            return {
                'message': 'Email verified successfully! You can now login.',
                'user': user,
                'token': auth_token
            }, 200
            
        except Exception as e:
            current_app.logger.error(f"Email verification error: {str(e)}")
            return {'error': 'Email verification failed'}, 500


# Register Google OAuth routes on the same namespace
register_google_routes(auth_ns)

