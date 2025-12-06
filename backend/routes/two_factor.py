"""
Two-Factor Authentication Routes

Handles 2FA setup, verification, and management.
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.user import User
from utils.auth import token_required
from utils.two_factor import (
    generate_secret,
    generate_qr_code,
    verify_totp_code,
    get_backup_codes,
    format_secret_for_display,
    validate_totp_setup
)
import bcrypt

two_factor_ns = Namespace('2fa', description='Two-Factor Authentication operations')

setup_2fa_model = two_factor_ns.model('Setup2FA', {
    'password': fields.String(required=True, description='Current password for verification', example='SecurePass123')
})

verify_2fa_model = two_factor_ns.model('Verify2FA', {
    'code': fields.String(required=True, description='6-digit code from authenticator app', example='123456')
})

disable_2fa_model = two_factor_ns.model('Disable2FA', {
    'password': fields.String(required=True, description='Current password', example='SecurePass123'),
    'code': fields.String(required=True, description='6-digit code from authenticator app', example='123456')
})


@two_factor_ns.route('/setup')
class Setup2FA(Resource):
    @two_factor_ns.doc(security='Bearer')
    @two_factor_ns.expect(setup_2fa_model)
    @token_required
    def post(self, current_user):
        """
        Initialize 2FA setup - generates secret and QR code

        Step 1: User requests to enable 2FA
        Returns QR code and secret for authenticator app setup
        """
        try:
            data = request.get_json()
            password = data.get('password', '')

            # Verify password before allowing 2FA setup
            db = current_app.db
            user_model = User(db)
            user = user_model.find_by_email(current_user['email'])

            if not user or not user_model.verify_password(user, password):
                return {'error': 'Invalid password'}, 401

            # Check if 2FA is already enabled
            if user.get('two_factor_enabled'):
                return {'error': '2FA is already enabled. Disable it first to set up again.'}, 400

            # Generate new secret
            secret = generate_secret()

            # Generate QR code
            qr_code = generate_qr_code(secret, user['email'])

            # Store secret temporarily (will be confirmed in verify step)
            user_model.collection.update_one(
                {'email': user['email']},
                {'$set': {
                    'two_factor_secret_temp': secret,
                    'updated_at': user_model.collection.find_one({'email': user['email']})['updated_at']
                }}
            )

            return {
                'message': 'Scan the QR code with your authenticator app',
                'qr_code': qr_code,
                'secret': format_secret_for_display(secret),
                'instructions': [
                    '1. Download Google Authenticator, Authy, or similar app',
                    '2. Scan the QR code or enter the secret manually',
                    '3. Enter the 6-digit code from your app to complete setup'
                ]
            }, 200

        except Exception as e:
            current_app.logger.error(f"2FA setup error: {str(e)}")
            return {'error': 'Failed to initialize 2FA setup'}, 500


@two_factor_ns.route('/verify-setup')
class Verify2FASetup(Resource):
    @two_factor_ns.doc(security='Bearer')
    @two_factor_ns.expect(verify_2fa_model)
    @token_required
    def post(self, current_user):
        """
        Complete 2FA setup by verifying the first code

        Step 2: User enters code from authenticator app to confirm setup
        Generates backup codes and enables 2FA
        """
        try:
            data = request.get_json()
            code = data.get('code', '').strip()

            db = current_app.db
            user_model = User(db)
            user = user_model.collection.find_one({'email': current_user['email']})

            if not user:
                return {'error': 'User not found'}, 404

            # Get temporary secret
            temp_secret = user.get('two_factor_secret_temp')
            if not temp_secret:
                return {'error': 'No 2FA setup in progress. Please start setup first.'}, 400

            # Validate the code
            is_valid, error = validate_totp_setup(temp_secret, code)
            if not is_valid:
                return {'error': error}, 400

            # Generate backup codes
            backup_codes = get_backup_codes(8)

            # Hash backup codes before storing (like passwords)
            hashed_backup_codes = [
                bcrypt.hashpw(code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                for code in backup_codes
            ]

            # Enable 2FA and save everything
            user_model.collection.update_one(
                {'email': user['email']},
                {'$set': {
                    'two_factor_enabled': True,
                    'two_factor_secret': temp_secret,
                    'backup_codes': hashed_backup_codes,
                    'updated_at': user_model.collection.find_one({'email': user['email']})['updated_at']
                },
                '$unset': {
                    'two_factor_secret_temp': ''  # Remove temporary secret
                }}
            )

            return {
                'message': '2FA has been successfully enabled',
                'backup_codes': backup_codes,
                'warning': 'Save these backup codes in a secure place. Each code can only be used once.'
            }, 200

        except Exception as e:
            current_app.logger.error(f"2FA verification error: {str(e)}")
            return {'error': 'Failed to verify 2FA setup'}, 500


@two_factor_ns.route('/disable')
class Disable2FA(Resource):
    @two_factor_ns.doc(security='Bearer')
    @two_factor_ns.expect(disable_2fa_model)
    @token_required
    def post(self, current_user):
        """Disable 2FA (requires password and current 2FA code)"""
        try:
            data = request.get_json()
            password = data.get('password', '')
            code = data.get('code', '').strip()

            db = current_app.db
            user_model = User(db)
            user = user_model.find_by_email(current_user['email'])

            if not user or not user_model.verify_password(user, password):
                return {'error': 'Invalid password'}, 401

            # Get full user document for 2FA check
            user_doc = user_model.collection.find_one({'email': user['email']})

            if not user_doc.get('two_factor_enabled'):
                return {'error': '2FA is not enabled'}, 400

            # Verify 2FA code
            if not verify_totp_code(user_doc['two_factor_secret'], code):
                return {'error': 'Invalid 2FA code'}, 401

            # Disable 2FA
            user_model.collection.update_one(
                {'email': user['email']},
                {'$set': {
                    'two_factor_enabled': False,
                    'two_factor_secret': None,
                    'backup_codes': [],
                    'updated_at': user_doc['updated_at']
                }}
            )

            return {'message': '2FA has been successfully disabled'}, 200

        except Exception as e:
            current_app.logger.error(f"2FA disable error: {str(e)}")
            return {'error': 'Failed to disable 2FA'}, 500


@two_factor_ns.route('/status')
class Get2FAStatus(Resource):
    @two_factor_ns.doc(security='Bearer')
    @token_required
    def get(self, current_user):
        """Check if 2FA is enabled for current user"""
        try:
            db = current_app.db
            user_model = User(db)
            user = user_model.collection.find_one({'email': current_user['email']})

            if not user:
                return {'error': 'User not found'}, 404

            return {
                'two_factor_enabled': user.get('two_factor_enabled', False),
                'setup_in_progress': 'two_factor_secret_temp' in user and user['two_factor_secret_temp'] is not None
            }, 200

        except Exception as e:
            current_app.logger.error(f"2FA status error: {str(e)}")
            return {'error': 'Failed to get 2FA status'}, 500


@two_factor_ns.route('/regenerate-backup-codes')
class RegenerateBackupCodes(Resource):
    @two_factor_ns.doc(security='Bearer')
    @two_factor_ns.expect(verify_2fa_model)
    @token_required
    def post(self, current_user):
        """Regenerate backup codes (invalidates old ones)"""
        try:
            data = request.get_json()
            code = data.get('code', '').strip()

            db = current_app.db
            user_model = User(db)
            user = user_model.collection.find_one({'email': current_user['email']})

            if not user:
                return {'error': 'User not found'}, 404

            if not user.get('two_factor_enabled'):
                return {'error': '2FA is not enabled'}, 400

            # Verify 2FA code
            if not verify_totp_code(user['two_factor_secret'], code):
                return {'error': 'Invalid 2FA code'}, 401

            # Generate new backup codes
            backup_codes = get_backup_codes(8)

            # Hash backup codes
            hashed_backup_codes = [
                bcrypt.hashpw(code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                for code in backup_codes
            ]

            # Update backup codes
            user_model.collection.update_one(
                {'email': user['email']},
                {'$set': {
                    'backup_codes': hashed_backup_codes,
                    'updated_at': user['updated_at']
                }}
            )

            return {
                'message': 'Backup codes have been regenerated',
                'backup_codes': backup_codes,
                'warning': 'Old backup codes are now invalid. Save these new codes securely.'
            }, 200

        except Exception as e:
            current_app.logger.error(f"Backup codes regeneration error: {str(e)}")
            return {'error': 'Failed to regenerate backup codes'}, 500
