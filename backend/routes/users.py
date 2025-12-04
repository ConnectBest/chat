"""
User Routes - User profile and management
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.user import User
from bson.objectid import ObjectId

users_ns = Namespace('users', description='User operations')

update_profile_model = users_ns.model('UpdateProfile', {
    'name': fields.String(description='Full name'),
    'phone': fields.String(description='Phone number'),
    'status_message': fields.String(description='Custom status message')
})

# Base class for shared profile logic
class ProfileResourceBase(Resource):
    """Base class for profile endpoints"""
    
    @users_ns.doc(security='Bearer')
    def get(self):
        """Get user profile"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            db = current_app.db
            user_model = User(db)
            user = user_model.find_by_id(payload['user_id'])
            
            if not user:
                return {'error': 'User not found'}, 404
            
            return {'user': user}, 200
        except Exception as e:
            return {'error': str(e)}, 500
    
    @users_ns.expect(update_profile_model)
    @users_ns.doc(security='Bearer')
    def put(self):
        """Update user profile"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            data = request.get_json()
            db = current_app.db
            user_model = User(db)
            
            # Update both name and full_name if 'name' is provided
            updates = {}
            if 'name' in data:
                updates['name'] = data['name']
                updates['full_name'] = data['name']
            if 'phone' in data:
                updates['phone'] = data['phone']
            if 'status_message' in data:
                updates['status_message'] = data['status_message']
            if 'avatar' in data:
                updates['avatar'] = data['avatar']
            
            # Handle status update separately with validation
            if 'status' in data:
                status = data['status']
                if status in user_model.STATUSES:
                    user_model.update_status(payload['user_id'], status)
                else:
                    return {'error': f'Invalid status. Must be one of: {user_model.STATUSES}'}, 400
            
            user = user_model.update(payload['user_id'], updates)
            
            if not user:
                return {'error': 'User not found'}, 404
            
            return {'user': user, 'message': 'Profile updated successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Profile update error: {str(e)}")
            return {'error': str(e)}, 500


@users_ns.route('/me/avatar')
class UserAvatarUpdate(Resource):
    @users_ns.doc(security='Bearer')
    def post(self):
        """Upload or update user profile picture"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            token_parts = auth_header.split()
            token = token_parts[1] if len(token_parts) > 1 else token_parts[0]
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            # Check if avatar URL is provided in JSON body
            data = request.get_json()
            if data and data.get('avatar_url'):
                avatar_url = data.get('avatar_url')
                
                db = current_app.db
                user_model = User(db)
                
                # Update user avatar
                result = user_model.collection.update_one(
                    {'_id': ObjectId(payload['user_id'])},
                    {'$set': {'avatar': avatar_url}}
                )
                
                if result.modified_count > 0:
                    return {'message': 'Avatar updated', 'avatar_url': avatar_url}, 200
                else:
                    return {'message': 'Avatar already set or user not found'}, 200
            
            # Check if file is uploaded
            if 'file' not in request.files:
                return {'error': 'No file provided'}, 400
            
            file = request.files['file']
            if file.filename == '':
                return {'error': 'No file selected'}, 400
            
            # Validate file type
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
            file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
            if file_ext not in allowed_extensions:
                return {'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}, 400
            
            # Create uploads directory if it doesn't exist
            import os
            upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'avatars')
            os.makedirs(upload_dir, exist_ok=True)
            
            # Generate unique filename
            import uuid
            filename = f"{payload['user_id']}_{uuid.uuid4().hex}.{file_ext}"
            filepath = os.path.join(upload_dir, filename)
            
            # Save file
            file.save(filepath)
            
            # Generate URL (adjust based on your server setup)
            avatar_url = f"/uploads/avatars/{filename}"
            
            # Update user in database
            db = current_app.db
            user_model = User(db)
            
            result = user_model.collection.update_one(
                {'_id': ObjectId(payload['user_id'])},
                {'$set': {'avatar': avatar_url}}
            )
            
            if result.modified_count > 0:
                return {'message': 'Avatar uploaded successfully', 'avatar_url': avatar_url}, 200
            else:
                return {'error': 'Failed to update avatar in database'}, 500
                
        except Exception as e:
            current_app.logger.error(f"Error updating avatar: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to upload avatar'}, 500


@users_ns.route('/profile')
class UserProfile(ProfileResourceBase):
    pass


@users_ns.route('/me')
class UserMe(ProfileResourceBase):
    pass


@users_ns.route('/search')
class UserSearch(Resource):
    @users_ns.doc(security='Bearer', params={'query': 'Search query', 'limit': 'Max results (default 20)'})
    def get(self):
        """Search users by name or email"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            query = request.args.get('query', '')
            limit = int(request.args.get('limit', 20))
            
            db = current_app.db
            user_model = User(db)
            users = user_model.search_users(query, limit)
            
            return {'users': users}, 200
        except Exception as e:
            return {'error': str(e)}, 500


@users_ns.route('')
class UserList(Resource):
    @users_ns.doc(security='Bearer')
    def get(self):
        """Get all users for user directory"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            db = current_app.db
            user_model = User(db)
            
            # Get all users
            all_users = user_model.find_all()
            
            # Format users for response
            user_list = []
            for user in all_users:
                user_list.append({
                    'id': str(user.get('_id')),
                    'name': user.get('name') or user.get('full_name') or user.get('username') or user.get('email', '').split('@')[0],
                    'email': user.get('email', ''),
                    'username': user.get('username', ''),
                    'role': user.get('role', 'user'),
                    'status': user.get('status', 'offline'),
                    'avatar': user.get('avatar') or user.get('picture') or None
                })
            
            return {
                'users': user_list,
                'total': len(user_list)
            }, 200
        except Exception as e:
            return {'error': str(e)}, 500


@users_ns.route('/statistics')
class UserStatistics(Resource):
    @users_ns.doc(security='Bearer')
    def get(self):
        """Get system statistics for admin dashboard"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            token = auth_header.split()[1]
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            db = current_app.db
            
            # Check if user is admin
            user_model = User(db)
            user = user_model.find_by_id(payload['user_id'])
            if not user or user.get('role') != 'admin':
                return {'error': 'Admin access required'}, 403
            
            # Count total users
            total_users = db.users.count_documents({})
            
            # Count active users (status is 'online' or 'active')
            active_users = db.users.count_documents({
                'status': {'$in': ['online', 'active']}
            })
            
            # Count total channels
            total_channels = db.channels.count_documents({})
            
            # Count total messages
            total_messages = db.messages.count_documents({})
            
            return {
                'statistics': {
                    'totalUsers': total_users,
                    'activeUsers': active_users,
                    'totalChannels': total_channels,
                    'totalMessages': total_messages
                }
            }, 200
        except Exception as e:
            current_app.logger.error(f"Statistics error: {str(e)}")
            return {'error': str(e)}, 500
