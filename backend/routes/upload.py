from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from utils.auth import token_required

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

@upload_bp.route('/avatar', methods=['POST'])
@token_required
def upload_avatar(current_user):
    """Upload avatar image and return URL"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400
        
        file = request.files['file']
        
        if file.filename == '':
            return {'error': 'No file selected'}, 400
        
        if not allowed_file(file.filename, AVATAR_EXTENSIONS):
            return {'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, webp'}, 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_AVATAR_SIZE:
            return {'error': 'File too large. Maximum size is 5MB'}, 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{ext}"
        
        # Save file
        filepath = os.path.join(AVATARS_FOLDER, unique_filename)
        file.save(filepath)
        
        # Generate URL using backend URL from config
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:5001')
        avatar_url = f"{backend_url}/static/uploads/avatars/{unique_filename}"
        
        return {
            'success': True,
            'avatar_url': avatar_url,
            'filename': unique_filename
        }, 200
        
    except Exception as e:
        print(f"Error uploading avatar: {str(e)}")
        return {'error': 'Failed to upload avatar'}, 500

@upload_bp.route('/delete/<filename>', methods=['DELETE'])
@token_required
def delete_avatar(filename, current_user):
    """Delete uploaded avatar"""
    try:
        # Validate filename
        filename = secure_filename(filename)
        filepath = os.path.join(AVATARS_FOLDER, filename)
        
        # Check if file exists
        if not os.path.exists(filepath):
            return ({'error': 'File not found'}), 404
        
        # Delete file
        os.remove(filepath)
        
        return ({'success': True, 'message': 'Avatar deleted'}), 200
        
    except Exception as e:
        print(f"Error deleting avatar: {str(e)}")
        return ({'error': 'Failed to delete avatar'}), 500

@upload_bp.route('/message-file', methods=['POST'])
@token_required
def upload_message_file(current_user):
    """Upload file attachment for messages (images, documents, videos, etc.)"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400
        
        file = request.files['file']
        
        if file.filename == '':
            return {'error': 'No file selected'}, 400
        
        if not allowed_file(file.filename, MESSAGE_FILE_EXTENSIONS):
            return ({
                'error': 'Invalid file type',
                'allowed': list(MESSAGE_FILE_EXTENSIONS)
            }), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_MESSAGE_FILE_SIZE:
            return ({
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
        
        return ({
            'success': True,
            'file_url': file_url,
            'filename': unique_filename,
            'original_name': original_name,
            'size': file_size,
            'type': file.content_type
        }), 200
        
    except Exception as e:
        print(f"Error uploading message file: {str(e)}")
        return ({'error': 'Failed to upload file'}), 500
