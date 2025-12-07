"""
Message Routes - Messaging operations
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.message import Message
from models.channel import Channel
from utils.validators import validate_message_content
from utils.auth import token_required, get_current_user

messages_ns = Namespace('messages', description='Messaging operations')

attachment_model = messages_ns.model('Attachment', {
    'name': fields.String(required=True, description='File name'),
    'size': fields.Integer(required=True, description='File size in bytes'),
    'type': fields.String(required=True, description='MIME type'),
    'url': fields.String(required=True, description='File URL')
})

send_message_model = messages_ns.model('SendMessage', {
    'content': fields.String(required=True, description='Message content', example='Hello, world!'),
    'parent_message_id': fields.String(description='Parent message ID for threads'),
    'attachments': fields.List(fields.Nested(attachment_model), description='File attachments')
})

add_reaction_model = messages_ns.model('AddReaction', {
    'emoji': fields.String(required=True, description='Unicode emoji', example='👍')
})


@messages_ns.route('/channels/<string:channel_id>/messages')
class MessageList(Resource):
    @messages_ns.doc(security='Bearer', params={'limit': 'Max messages (default 50)', 'before': 'Message ID for pagination'})
    @token_required
    def get(self, channel_id):
        """Get messages in a channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            limit = int(request.args.get('limit', 50))
            before = request.args.get('before')

            message_model = Message(db)
            messages = message_model.list_channel_messages(channel_id, limit, before)

            return {'messages': messages}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to get messages'}, 500


@messages_ns.route('/channels/<string:channel_id>/messages/send')
class SendMessage(Resource):
    @messages_ns.expect(send_message_model)
    @messages_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id):
        """Send a message in a channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            data = request.get_json()
            content = data.get('content', '')
            parent_message_id = data.get('parent_message_id')
            attachments = data.get('attachments', [])

            is_valid, error = validate_message_content(content)
            if not is_valid:
                return {'error': error}, 400

            message_model = Message(db)
            message = message_model.create(
                channel_id=channel_id,
                user_id=current_user['user_id'],
                content=content,
                parent_message_id=parent_message_id,
                attachments=attachments
            )

            return {'message': message}, 201
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to send message'}, 500


@messages_ns.route('/messages/<string:message_id>')
class MessageDetail(Resource):
    @messages_ns.doc(security='Bearer')
    @token_required
    def get(self, message_id):
        """Get a specific message"""
        current_user = get_current_user()
        try:
            db = current_app.db
            message_model = Message(db)
            message = message_model.find_by_id(message_id)

            if not message:
                return {'error': 'Message not found'}, 404

            return {'message': message}, 200
        except Exception as e:
            return {'error': str(e)}, 500

    @messages_ns.expect(send_message_model)
    @messages_ns.doc(security='Bearer')
    @token_required
    def put(self, message_id):
        """Edit a message"""
        current_user = get_current_user()
        try:
            data = request.get_json()
            content = data.get('content', '')

            is_valid, error = validate_message_content(content)
            if not is_valid:
                return {'error': error}, 400

            db = current_app.db
            message_model = Message(db)
            message = message_model.update(message_id, content, current_user['user_id'])

            if not message:
                return {'error': 'Message not found or unauthorized'}, 404

            return {'message': message}, 200
        except Exception as e:
            return {'error': str(e)}, 500

    @messages_ns.doc(security='Bearer')
    @token_required
    def delete(self, message_id):
        """Delete a message"""
        current_user = get_current_user()
        try:
            db = current_app.db
            message_model = Message(db)
            success = message_model.delete(message_id, current_user['user_id'])

            if not success:
                return {'error': 'Message not found or unauthorized'}, 404

            return {'message': 'Message deleted successfully'}, 200
        except Exception as e:
            return {'error': str(e)}, 500


@messages_ns.route('/messages/<string:message_id>/bookmark')
class MessageBookmark(Resource):
    @messages_ns.doc(security='Bearer')
    @token_required
    def post(self, message_id):
        """Toggle bookmark/star on a message"""
        current_user = get_current_user()
        try:
            db = current_app.db
            message_model = Message(db)
            result = message_model.toggle_bookmark(message_id, current_user['user_id'])

            if not result:
                return {'error': 'Message not found'}, 404

            return {'bookmarked': result['bookmarked']}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to toggle bookmark'}, 500


@messages_ns.route('/messages/<string:message_id>/replies')
class ThreadReplies(Resource):
    @messages_ns.doc(security='Bearer')
    @token_required
    def get(self, message_id):
        """Get all replies to a message (thread)"""
        current_user = get_current_user()
        try:
            db = current_app.db
            message_model = Message(db)
            replies = message_model.get_thread_replies(message_id)

            return {'replies': replies}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to get thread replies'}, 500

    @messages_ns.expect(send_message_model)
    @messages_ns.doc(security='Bearer')
    @token_required
    def post(self, message_id):
        """Post a reply to a message (thread)"""
        current_user = get_current_user()
        try:
            data = request.get_json()
            content = data.get('content', '')

            is_valid, error = validate_message_content(content)
            if not is_valid:
                return {'error': error}, 400

            # First get the parent message to find its channel
            db = current_app.db
            message_model = Message(db)
            parent_message = message_model.find_by_id(message_id)

            if not parent_message:
                return {'error': 'Parent message not found'}, 404

            # Check if user is member of the channel
            channel_model = Channel(db)
            if not channel_model.is_member(parent_message['channel_id'], current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            # Create reply message
            reply = message_model.create(
                channel_id=parent_message['channel_id'],
                user_id=current_user['user_id'],
                content=content,
                parent_message_id=message_id
            )

            return {'reply': reply}, 201
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to post reply'}, 500


@messages_ns.route('/channels/<string:channel_id>/messages/<string:message_id>/reactions')
class MessageReactions(Resource):
    @messages_ns.expect(add_reaction_model)
    @messages_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id, message_id):
        """Add reaction to a message"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Verify user is member of channel (skip for DM channels)
            if not channel_id.startswith('dm-'):
                if not channel_model.is_member(channel_id, current_user['user_id']):
                    return {'error': 'Not a member of this channel'}, 403

            data = request.get_json()
            emoji = data.get('emoji', '')

            if not emoji:
                return {'error': 'Emoji is required'}, 400

            # Validate emoji (basic check for max length)
            if len(emoji) > 10:
                return {'error': 'Invalid emoji'}, 400

            message_model = Message(db)

            # Verify message exists and belongs to channel
            message = message_model.find_by_id(message_id)
            if not message:
                return {'error': 'Message not found'}, 404

            # For DM channels, skip the channel_id check (DM messages work differently)
            if not channel_id.startswith('dm-'):
                if str(message['channel_id']) != str(channel_id):
                    return {'error': 'Message not in this channel'}, 400

            # Add or update reaction
            success = message_model.add_reaction(message_id, current_user['user_id'], emoji)

            if not success:
                return {'error': 'Failed to add reaction'}, 500

            # Get updated reactions
            reactions = message_model.get_reactions(message_id)

            # Emit Socket.IO event to notify all users in the channel
            try:
                socketio = current_app.socketio
                socketio.emit('reaction_added', {
                    'messageId': message_id,
                    'channelId': channel_id,
                    'userId': current_user['user_id'],
                    'emoji': emoji,
                    'reactions': reactions
                }, room=channel_id)
            except Exception as e:
                current_app.logger.warning(f"Failed to emit socket event: {str(e)}")

            return {
                'success': True,
                'reaction': {
                    'messageId': message_id,
                    'userId': current_user['user_id'],
                    'emoji': emoji
                },
                'reactions': reactions
            }, 200
        except Exception as e:
            current_app.logger.error(f"Error adding reaction: {str(e)}")
            return {'error': 'Failed to add reaction'}, 500

    @messages_ns.doc(security='Bearer')
    @token_required
    def delete(self, channel_id, message_id):
        """Remove reaction from a message"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Verify user is member of channel
            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            message_model = Message(db)

            # Verify message exists and belongs to channel
            message = message_model.find_by_id(message_id)
            if not message:
                return {'error': 'Message not found'}, 404

            if message['channel_id'] != channel_id:
                return {'error': 'Message not in this channel'}, 400

            # Remove reaction
            success = message_model.remove_reaction(message_id, current_user['user_id'])

            if not success:
                return {'error': 'No reaction to remove'}, 404

            # Get updated reactions
            reactions = message_model.get_reactions(message_id)

            return {
                'success': True,
                'reactions': reactions
            }, 200
        except Exception as e:
            current_app.logger.error(f"Error removing reaction: {str(e)}")
            return {'error': 'Failed to remove reaction'}, 500
