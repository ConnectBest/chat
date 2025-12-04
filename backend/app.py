"""
Main Application Module

This is the entry point of the Flask application.
It initializes Flask, configures middleware, registers blueprints,
and sets up Swagger documentation.
"""

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_restx import Api
from flask_socketio import SocketIO, emit, join_room, leave_room
from pymongo import MongoClient
from config import get_config
import logging
import os
import certifi

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app():
    """
    Application factory pattern.
    Creates and configures the Flask application.
    
    Returns:
        Flask: Configured Flask application instance
    """
    
    # Initialize Flask app
    app = Flask(__name__)
    
    # Load configuration
    config = get_config()
    app.config.from_object(config)
    
    # Configure upload folder
    STATIC_FOLDER = os.path.join(os.path.dirname(__file__), 'static')
    app.config['STATIC_FOLDER'] = STATIC_FOLDER
    os.makedirs(os.path.join(STATIC_FOLDER, 'uploads', 'avatars'), exist_ok=True)
    
    # Initialize CORS (Cross-Origin Resource Sharing)
    # This allows frontend running on different port/domain to access API
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 3600  # Cache preflight requests for 1 hour
        },
        r"/socket.io/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        },
        r"/static/*": {
            "origins": "*",  # Allow static files from anywhere
            "methods": ["GET"],
            "max_age": 86400  # Cache for 24 hours
        }
    })
    
    # Initialize Socket.IO for WebSocket support
    socketio = SocketIO(
        app, 
        cors_allowed_origins=app.config['CORS_ORIGINS'],
        async_mode='eventlet',
        logger=True,
        engineio_logger=True
    )
    app.socketio = socketio
    
    # Initialize MongoDB connection
    # Use connection pooling - don't close connection after each request
    try:
        # Build connection options based on URI
        connection_options = {
            'serverSelectionTimeoutMS': 15000,  # Increased timeout for initial connection
            'connectTimeoutMS': 15000,  # Connection timeout
            'socketTimeoutMS': 15000,  # Socket timeout
            'maxPoolSize': 20,  # Reduced pool size for container environments
            'minPoolSize': 5,  # Minimum number of connections in the pool
            'maxIdleTimeMS': 30000,  # Close connections after 30 seconds of inactivity
            'retryWrites': True,  # Enable retry writes
            'w': 'majority'  # Write concern
        }

        # Add TLS/SSL configuration for Atlas connections
        if 'mongodb+srv://' in app.config['MONGODB_URI'] or 'ssl=true' in app.config['MONGODB_URI']:
            connection_options.update({
                'tls': True,
                'tlsCAFile': certifi.where(),
                'tlsAllowInvalidCertificates': False,
                'tlsAllowInvalidHostnames': False
            })

        app.mongo_client = MongoClient(
            app.config['MONGODB_URI'],
            **connection_options
        )

        # Test connection with retry
        max_retries = 3
        for attempt in range(max_retries):
            try:
                app.mongo_client.server_info()
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                logger.warning(f"MongoDB connection attempt {attempt + 1} failed: {str(e)}, retrying...")

        app.db = app.mongo_client[app.config['MONGODB_DB_NAME']]
        logger.info(f"✅ Connected to MongoDB: {app.config['MONGODB_DB_NAME']}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {str(e)}")
        raise
    
    # Initialize Flask-RESTX API with Swagger documentation
    api = Api(
        app,
        version='1.0',
        title='Chat Application API',
        description='A comprehensive REST API for a real-time chat application with '
                    'user authentication, channels, and messaging features.',
        doc='/docs',  # Swagger UI will be available at /docs
        prefix='/api',
        authorizations={
            'Bearer': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'Authorization',
                'description': 'Add "Bearer " prefix before your JWT token'
            }
        },
        security='Bearer'
    )
    
    # Register API namespaces (blueprints)
    from routes.auth import auth_ns
    from routes.users import users_ns
    from routes.channels import channels_ns
    from routes.messages import messages_ns
    from routes.two_factor import two_factor_ns
    from routes.direct_messages import dm_ns
    
    api.add_namespace(auth_ns, path='/auth')
    api.add_namespace(users_ns, path='/users')
    api.add_namespace(channels_ns, path='/chat/channels')
    api.add_namespace(messages_ns, path='/chat')
    api.add_namespace(two_factor_ns, path='/2fa')
    api.add_namespace(dm_ns, path='/dm')
    
    # Register upload blueprint
    from routes.upload import upload_bp
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    
    # Socket.IO event handlers
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        logger.info(f'Client connected: {request.sid}')
        emit('connected', {'message': 'Connected to server'})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        logger.info(f'Client disconnected: {request.sid}')
    
    @socketio.on('join_channel')
    def handle_join_channel(data):
        """Join a channel room"""
        channel_id = data.get('channelId')
        if channel_id:
            join_room(channel_id)
            logger.info(f'Client {request.sid} joined channel {channel_id}')
            emit('joined_channel', {'channelId': channel_id}, room=request.sid)
    
    @socketio.on('leave_channel')
    def handle_leave_channel(data):
        """Leave a channel room"""
        channel_id = data.get('channelId')
        if channel_id:
            leave_room(channel_id)
            logger.info(f'Client {request.sid} left channel {channel_id}')
    
    # Static file serving for uploaded images
    @app.route('/static/uploads/<path:subpath>/<filename>')
    def serve_uploads(subpath, filename):
        """Serve uploaded files"""
        return send_from_directory(os.path.join(app.config['STATIC_FOLDER'], 'uploads', subpath), filename)
    
    # Google OAuth routes are registered within auth_ns
    # Available at: /api/auth/google and /api/auth/google/callback
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """
        Health check endpoint to verify API is running
        
        Returns:
            JSON response with status
        """
        try:
            # Check MongoDB connection
            app.mongo_client.server_info()
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'message': 'Chat API is running'
            }), 200
        except Exception as e:
            return jsonify({
                'status': 'unhealthy',
                'database': 'disconnected',
                'error': str(e)
            }), 500
    
    # Root endpoint
    @app.route('/')
    def index():
        """Root endpoint with API information"""
        return jsonify({
            'message': 'Welcome to Chat Application API',
            'version': '1.0',
            'documentation': '/docs',
            'health': '/api/health'
        })
    
    # Serve uploaded files (avatars, attachments)
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        """Serve uploaded files"""
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        return send_from_directory(upload_dir, filename)
    
    # Global error handlers
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors"""
        return jsonify({
            'error': 'Resource not found',
            'message': 'The requested URL was not found on the server'
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 errors"""
        logger.error(f"Internal error: {str(error)}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500
    
    return app


# Create app instance
app = create_app()
socketio = app.socketio


if __name__ == '__main__':
    """
    Run the application in development mode with Socket.IO
    
    In production, use a WSGI server like Gunicorn with eventlet:
    gunicorn -w 1 --worker-class eventlet -b 0.0.0.0:5001 app:app
    """
    port = app.config.get('PORT', 5001)
    host = app.config.get('HOST', '0.0.0.0')
    
    logger.info(f"🚀 Starting server on http://{host}:{port}")
    logger.info(f"📚 Swagger UI available at http://{host}:{port}/docs")
    logger.info(f"🔌 Socket.IO enabled for real-time communication")
    
    socketio.run(
        app,
        host=host,
        port=port,
        debug=app.config.get('DEBUG', True),
        use_reloader=False,  # Disable auto-reload to prevent crashes
        allow_unsafe_werkzeug=True
    )
