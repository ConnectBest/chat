from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from functools import wraps
from utils.auth import verify_token

upload_bp = Blueprint('upload', __name__)

# Configure upload folders
AVATARS_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'uploads', 'avatars')
MESSAGES_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'uploads', 'messages')
UPLOAD_FOLDER = AVATARS_FOLDER  # Keep for backward compatibility

# File type configurations
AVATAR_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MESSAGE_FILE_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',  # Images
    'pdf', 'doc', 'docx', 'txt', 'md', 'rtf',  # Documents
    'xls', 'xlsx', 'csv',  # Spreadsheets
    'zip', 'rar', '7z', 'tar', 'gz',  # Archives
    'mp4', 'avi', 'mov', 'wmv', 'mkv',  # Videos
    'mp3', 'wav', 'ogg', 'flac'  # Audio
}

MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB
MAX_MESSAGE_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Create upload directories if they don't exist
os.makedirs(AVATARS_FOLDER, exist_ok=True)
os.makedirs(MESSAGES_FOLDER, exist_ok=True)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

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

@upload_bp.route('/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    """Upload avatar image and return URL"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, AVATAR_EXTENSIONS):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_AVATAR_SIZE:
            return jsonify({'error': 'File too large. Maximum size is 5MB'}), 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{ext}"
        
        # Save file
        filepath = os.path.join(AVATARS_FOLDER, unique_filename)
        file.save(filepath)
        
        # Generate URL using backend URL from config
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:5001')
        avatar_url = f"{backend_url}/static/uploads/avatars/{unique_filename}"
        
        return jsonify({
            'success': True,
            'avatar_url': avatar_url,
            'filename': unique_filename
        }), 200
        
    except Exception as e:
        print(f"Error uploading avatar: {str(e)}")
        return jsonify({'error': 'Failed to upload avatar'}), 500

@upload_bp.route('/delete/<filename>', methods=['DELETE'])
@require_auth
def delete_avatar(filename):
    """Delete uploaded avatar"""
    try:
        # Validate filename
        filename = secure_filename(filename)
        filepath = os.path.join(AVATARS_FOLDER, filename)
        
        # Check if file exists
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Delete file
        os.remove(filepath)
        
        return jsonify({'success': True, 'message': 'Avatar deleted'}), 200
        
    except Exception as e:
        print(f"Error deleting avatar: {str(e)}")
        return jsonify({'error': 'Failed to delete avatar'}), 500

@upload_bp.route('/message-file', methods=['POST'])
@require_auth
def upload_message_file():
    """Upload file attachment for messages (images, documents, videos, etc.)"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, MESSAGE_FILE_EXTENSIONS):
            return jsonify({
                'error': 'Invalid file type',
                'allowed': list(MESSAGE_FILE_EXTENSIONS)
            }), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_MESSAGE_FILE_SIZE:
            return jsonify({
                'error': f'File too large. Maximum size is {MAX_MESSAGE_FILE_SIZE // (1024*1024)}MB'
            }), 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        original_name = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}.{ext}"
        
        # Save file
        filepath = os.path.join(MESSAGES_FOLDER, unique_filename)
        file.save(filepath)
        
        # Generate URL using backend URL from config
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:5001')
        file_url = f"{backend_url}/static/uploads/messages/{unique_filename}"
        
        return jsonify({
            'success': True,
            'file_url': file_url,
            'filename': unique_filename,
            'original_name': original_name,
            'size': file_size,
            'type': file.content_type
        }), 200
        
    except Exception as e:
        print(f"Error uploading message file: {str(e)}")
        return jsonify({'error': 'Failed to upload file'}), 500
