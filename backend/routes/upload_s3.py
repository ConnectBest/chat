"""
AWS S3 Upload Route - Production Ready
Use this instead of upload.py for production deployment
"""

from flask import Blueprint, request
import os
import uuid
import boto3
from botocore.exceptions import ClientError
from werkzeug.utils import secure_filename
from utils.auth import token_required

upload_s3_bp = Blueprint('upload_s3', __name__)

# AWS S3 Configuration (set these in environment variables)
# Note: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not needed in ECS with IAM roles
AWS_REGION = os.getenv('AWS_REGION', 'us-west-2')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'connectbest-chat-files')

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

# Initialize S3 client - uses IAM role credentials in ECS automatically
s3_client = boto3.client('s3', region_name=AWS_REGION)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_content_type(filename):
    """Get appropriate content type for file"""
    ext = filename.rsplit('.', 1)[1].lower()

    # Images
    if ext in ['jpg', 'jpeg']: return 'image/jpeg'
    if ext in ['png']: return 'image/png'
    if ext in ['gif']: return 'image/gif'
    if ext in ['webp']: return 'image/webp'
    if ext in ['svg']: return 'image/svg+xml'

    # Documents
    if ext in ['pdf']: return 'application/pdf'
    if ext in ['doc']: return 'application/msword'
    if ext in ['docx']: return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if ext in ['txt']: return 'text/plain'

    # Default
    return 'application/octet-stream'

@upload_s3_bp.route('/avatar', methods=['POST'])
@token_required
def upload_avatar(current_user):
    """Upload avatar image to S3 and return URL"""
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
        unique_filename = f"avatars/{uuid.uuid4()}.{ext}"

        # Upload to S3
        s3_client.upload_fileobj(
            file,
            S3_BUCKET_NAME,
            unique_filename,
            ExtraArgs={
                'ACL': 'public-read',  # Make file publicly accessible
                'ContentType': get_content_type(file.filename),
                'CacheControl': 'max-age=31536000'  # Cache for 1 year
            }
        )

        # Generate public URL
        avatar_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_filename}"

        return {
            'success': True,
            'avatar_url': avatar_url,
            'filename': unique_filename
        }, 200

    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        return {'error': 'Failed to upload to S3'}, 500
    except Exception as e:
        print(f"Error uploading avatar: {str(e)}")
        return {'error': 'Failed to upload avatar'}, 500

@upload_s3_bp.route('/message-file', methods=['POST'])
@token_required
def upload_message_file(current_user):
    """Upload file attachment for messages (images, documents, videos, etc.) to S3"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return {'error': 'No file provided'}, 400

        file = request.files['file']

        if file.filename == '':
            return {'error': 'No file selected'}, 400

        if not allowed_file(file.filename, MESSAGE_FILE_EXTENSIONS):
            return {
                'error': 'Invalid file type',
                'allowed': list(MESSAGE_FILE_EXTENSIONS)
            }, 400

        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_MESSAGE_FILE_SIZE:
            return {
                'error': f'File too large. Maximum size is {MAX_MESSAGE_FILE_SIZE // (1024*1024)}MB'
            }, 400

        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        original_name = secure_filename(file.filename)
        unique_filename = f"messages/{uuid.uuid4()}.{ext}"

        # Upload to S3
        s3_client.upload_fileobj(
            file,
            S3_BUCKET_NAME,
            unique_filename,
            ExtraArgs={
                'ACL': 'public-read',  # Make file publicly accessible
                'ContentType': get_content_type(file.filename),
                'CacheControl': 'max-age=31536000',  # Cache for 1 year
                'ContentDisposition': f'inline; filename="{original_name}"'  # Preserve original name
            }
        )

        # Generate public URL
        file_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_filename}"

        return {
            'success': True,
            'file_url': file_url,
            'filename': unique_filename,
            'original_name': original_name,
            'size': file_size,
            'type': file.content_type
        }, 200

    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        return {'error': 'Failed to upload to S3'}, 500
    except Exception as e:
        print(f"Error uploading message file: {str(e)}")
        return {'error': 'Failed to upload file'}, 500

@upload_s3_bp.route('/delete/<path:filename>', methods=['DELETE'])
@token_required
def delete_avatar(filename, current_user):
    """Delete uploaded avatar from S3"""
    try:
        # Delete from S3
        s3_client.delete_object(
            Bucket=S3_BUCKET_NAME,
            Key=filename
        )
        
        return {'success': True, 'message': 'Avatar deleted'}, 200
        
    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        return {'error': 'Failed to delete from S3'}, 500
    except Exception as e:
        print(f"Error deleting avatar: {str(e)}")
        return {'error': 'Failed to delete avatar'}, 500
