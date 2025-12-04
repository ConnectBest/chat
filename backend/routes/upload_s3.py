"""
AWS S3 Upload Route - Production Ready
Use this instead of upload.py for production deployment
"""

from flask import Blueprint, request, jsonify
import os
import uuid
import boto3
from botocore.exceptions import ClientError
from functools import wraps
from utils.auth import verify_token

upload_s3_bp = Blueprint('upload_s3', __name__)

# AWS S3 Configuration (set these in environment variables)
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'my-chat-app-avatars')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

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

@upload_s3_bp.route('/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    """Upload avatar image to S3 and return URL"""
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
                'ContentType': f'image/{ext}',
                'CacheControl': 'max-age=31536000'  # Cache for 1 year
            }
        )
        
        # Generate public URL
        avatar_url = f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_filename}"
        
        # Alternative: Use CloudFront CDN URL if configured
        # avatar_url = f"https://your-cloudfront-domain.com/{unique_filename}"
        
        return jsonify({
            'success': True,
            'avatar_url': avatar_url,
            'filename': unique_filename
        }), 200
        
    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        return jsonify({'error': 'Failed to upload to S3'}), 500
    except Exception as e:
        print(f"Error uploading avatar: {str(e)}")
        return jsonify({'error': 'Failed to upload avatar'}), 500

@upload_s3_bp.route('/delete/<path:filename>', methods=['DELETE'])
@require_auth
def delete_avatar(filename):
    """Delete uploaded avatar from S3"""
    try:
        # Delete from S3
        s3_client.delete_object(
            Bucket=S3_BUCKET_NAME,
            Key=filename
        )
        
        return jsonify({'success': True, 'message': 'Avatar deleted'}), 200
        
    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        return jsonify({'error': 'Failed to delete from S3'}), 500
    except Exception as e:
        print(f"Error deleting avatar: {str(e)}")
        return jsonify({'error': 'Failed to delete avatar'}), 500
