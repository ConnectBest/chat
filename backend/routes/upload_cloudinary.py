"""
Cloudinary Upload Route - Production Ready (Easiest Option)
Use this for automatic image optimization and transformations
"""

from flask import Blueprint, request, jsonify
import os
import cloudinary
import cloudinary.uploader
from functools import wraps
from utils.auth import verify_token

upload_cloudinary_bp = Blueprint('upload_cloudinary', __name__)

# Cloudinary Configuration (set these in environment variables)
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_token(token)
        
        if not user_data:
            return jsonify({'error': 'Invalid token'}), 401
        
        request.user = user_data
        return f(*args, **kwargs)
    return decorated_function

@upload_cloudinary_bp.route('/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    """Upload avatar image to Cloudinary and return URL"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large. Maximum size is 5MB'}), 400
        
        # Upload to Cloudinary with automatic optimization
        upload_result = cloudinary.uploader.upload(
            file,
            folder='chat-avatars',
            transformation=[
                {'width': 400, 'height': 400, 'crop': 'fill'},  # Resize and crop
                {'quality': 'auto'},  # Automatic quality optimization
                {'fetch_format': 'auto'}  # Automatic format selection (WebP if supported)
            ],
            resource_type='image'
        )
        
        # Get optimized URL
        avatar_url = upload_result['secure_url']
        public_id = upload_result['public_id']
        
        return jsonify({
            'success': True,
            'avatar_url': avatar_url,
            'public_id': public_id
        }), 200
        
    except Exception as e:
        print(f"Cloudinary Error: {str(e)}")
        return jsonify({'error': 'Failed to upload to Cloudinary'}), 500

@upload_cloudinary_bp.route('/delete/<path:public_id>', methods=['DELETE'])
@require_auth
def delete_avatar(public_id):
    """Delete uploaded avatar from Cloudinary"""
    try:
        # Delete from Cloudinary
        cloudinary.uploader.destroy(public_id)
        
        return jsonify({'success': True, 'message': 'Avatar deleted'}), 200
        
    except Exception as e:
        print(f"Cloudinary Error: {str(e)}")
        return jsonify({'error': 'Failed to delete from Cloudinary'}), 500
