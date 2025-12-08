"""
Channel Routes - Channel management
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.channel import Channel
from models.message import Message
from utils.validators import validate_channel_name
from utils.auth import token_required, get_current_user

channels_ns = Namespace('channels', description='Channel operations')

create_channel_model = channels_ns.model('CreateChannel', {
    'name': fields.String(required=True, description='Channel name', example='general'),
    'description': fields.String(description='Channel description'),
    'type': fields.String(description='Channel type', enum=['public', 'private'], example='public')
})


@channels_ns.route('')
class ChannelList(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def get(self):
        """List user's channels - optimized for performance"""
        current_user = get_current_user()
        try:
            db = current_app.db

            # OPTIMIZATION: Simple approach - get user's channels first, then supplement with minimal data
            from bson.objectid import ObjectId
            user_id = ObjectId(current_user['user_id'])

            # Step 1: Get user's channel memberships (fast query with index)
            channel_memberships = list(db['channel_members'].find(
                {'user_id': user_id},
                {'channel_id': 1, 'role': 1}
            ))

            if not channel_memberships:
                return {'channels': []}, 200

            channel_ids = [m['channel_id'] for m in channel_memberships]

            # Step 2: Get channel details (fast query with _id index)
            channels = list(db['channels'].find(
                {
                    '_id': {'$in': channel_ids},
                    'is_deleted': False,
                    'name': {'$not': {'$regex': '^dm_'}}
                },
                {
                    'name': 1,
                    'description': 1,
                    'type': 1,
                    'created_by': 1,
                    'created_at': 1
                }
            ))

            # Step 3: Build response with minimal processing
            result_channels = []
            for channel in channels:
                result_channels.append({
                    'id': str(channel['_id']),
                    'name': channel.get('name', ''),
                    'description': channel.get('description', ''),
                    'type': channel.get('type', 'public'),
                    'created_by': str(channel.get('created_by', '')),
                    'created_at': channel.get('created_at', '').isoformat() if hasattr(channel.get('created_at', ''), 'isoformat') else str(channel.get('created_at', '')),
                    'member_role': next((m['role'] for m in channel_memberships if m['channel_id'] == channel['_id']), 'member'),
                    'last_message': None,  # Skip expensive message lookups for performance
                    'last_message_at': channel.get('created_at', '').isoformat() if hasattr(channel.get('created_at', ''), 'isoformat') else str(channel.get('created_at', '')),
                    'unreadCount': 0  # Skip expensive unread count for performance
                })

            # Sort by name for consistent ordering
            result_channels.sort(key=lambda x: x['name'].lower())

            return {'channels': result_channels}, 200

        except Exception as e:
            current_app.logger.error(f"Error listing channels: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to list channels'}, 500
    
    @channels_ns.expect(create_channel_model)
    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self):
        """Create a new channel"""
        current_user = get_current_user()
        try:
            data = request.get_json()

            # Validate required fields
            name = data.get('name', '').strip()
            if not name:
                return {'error': 'Channel name is required'}, 400

            description = data.get('description')
            channel_type = data.get('type', 'public')

            # Validate channel name
            is_valid, error_message = validate_channel_name(name)
            if not is_valid:
                return {'error': error_message}, 400

            db = current_app.db
            channel_model = Channel(db)

            # Check if channel with this name already exists
            existing = channel_model.find_by_name(name)
            if existing:
                return {'error': 'Channel with this name already exists'}, 409

            # Create the channel
            channel = channel_model.create(
                name=name,
                created_by=current_user['user_id'],
                description=description,
                channel_type=channel_type
            )

            return {'channel': channel}, 201

        except ValueError as e:
            return {'error': str(e)}, 409
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to create channel'}, 500


@channels_ns.route('/<string:channel_id>')
class ChannelDetail(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def get(self, channel_id):
        """Get channel details"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            channel = channel_model.find_by_id(channel_id)
            if not channel:
                return {'error': 'Channel not found'}, 404

            members = channel_model.get_members(channel_id)
            # Ensure all ObjectIds in members are converted to strings
            for member in members:
                if '_id' in member:
                    member['_id'] = str(member['_id'])
            channel['members'] = members

            return {'channel': channel}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to get channel'}, 500


@channels_ns.route('/<string:channel_id>/join')
class JoinChannel(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id):
        """Join a channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)
            channel = channel_model.find_by_id(channel_id)

            if not channel:
                return {'error': 'Channel not found'}, 404

            if channel['type'] == 'private':
                return {'error': 'Cannot join private channel'}, 403

            success = channel_model.add_member(channel_id, current_user['user_id'])

            if not success:
                return {'error': 'Already a member'}, 400

            return {'message': 'Joined channel successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to join channel'}, 500


@channels_ns.route('/<string:channel_id>/members/<string:user_id>')
class ChannelMemberManagement(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id, user_id):
        """Add a member to a channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Check if requester is a member or admin
            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not authorized to add members'}, 403

            # Check if channel exists
            channel = channel_model.find_by_id(channel_id)
            if not channel:
                return {'error': 'Channel not found'}, 404

            # Add the member
            success = channel_model.add_member(channel_id, user_id)

            if not success:
                return {'error': 'User is already a member'}, 400

            return {'message': 'Member added successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to add member'}, 500

    @channels_ns.doc(security='Bearer')
    @token_required
    def delete(self, channel_id, user_id):
        """Remove a member from a channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Check if requester is admin or removing themselves
            is_admin = channel_model.is_admin(channel_id, current_user['user_id'])
            is_self = current_user['user_id'] == user_id

            if not is_admin and not is_self:
                return {'error': 'Not authorized to remove members'}, 403

            # Remove the member
            success = channel_model.remove_member(channel_id, user_id)

            if not success:
                return {'error': 'Failed to remove member'}, 400

            return {'message': 'Member removed successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            return {'error': 'Failed to remove member'}, 500


@channels_ns.route('/<string:channel_id>/members')
class ChannelMembers(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id):
        """Add a member to a channel"""
        current_user = get_current_user()
        try:
            data = request.get_json()
            user_id = data.get('user_id')

            if not user_id:
                return {'error': 'user_id is required'}, 400

            db = current_app.db
            channel_model = Channel(db)

            # Check if requester is a member
            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            channel = channel_model.find_by_id(channel_id)
            if not channel:
                return {'error': 'Channel not found'}, 404

            # Add the new member
            success = channel_model.add_member(channel_id, user_id)

            if not success:
                return {'error': 'User is already a member'}, 400

            return {'message': 'Member added successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Error adding member: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to add member'}, 500


@channels_ns.route('/<string:channel_id>/members/<string:user_id>')
class ChannelMemberDetail(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def delete(self, channel_id, user_id):
        """Remove a member from a channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Check if requester is admin or removing themselves
            is_admin = channel_model.is_admin(channel_id, current_user['user_id'])
            is_self = current_user['user_id'] == user_id

            if not is_admin and not is_self:
                return {'error': 'Only admins can remove other members'}, 403

            channel = channel_model.find_by_id(channel_id)
            if not channel:
                return {'error': 'Channel not found'}, 404

            success = channel_model.remove_member(channel_id, user_id)

            if not success:
                return {'error': 'User is not a member'}, 400

            return {'message': 'Member removed successfully'}, 200
        except Exception as e:
            current_app.logger.error(f"Error removing member: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to remove member'}, 500


@channels_ns.route('/<string:channel_id>/typing')
class ChannelTyping(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def get(self, channel_id):
        """Get list of users currently typing in channel"""
        current_user = get_current_user()
        try:
            db = current_app.db
            from datetime import datetime, timedelta

            # Get typing users from last 5 seconds, excluding current user
            cutoff_time = datetime.utcnow() - timedelta(seconds=5)
            typing_docs = list(db.typing_status.find({
                'channel_id': channel_id,
                'last_typing': {'$gte': cutoff_time},
                'user_id': {'$ne': current_user['user_id']}
            }))

            # Get user names
            from models.user import User
            user_model = User(db)
            typing_users = []
            for doc in typing_docs:
                user = user_model.find_by_id(doc['user_id'])
                if user:
                    name = user.get('full_name') or user.get('username') or user.get('email', '').split('@')[0]
                    typing_users.append(name)

            return {'typing_users': typing_users}, 200
        except Exception as e:
            current_app.logger.error(f"Error getting typing status: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to get typing status'}, 500

    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id):
        """Update user's typing status in channel"""
        current_user = get_current_user()
        try:
            data = request.get_json()
            is_typing = data.get('typing', False)

            db = current_app.db
            from datetime import datetime

            if is_typing:
                # Update or insert typing status
                db.typing_status.update_one(
                    {
                        'channel_id': channel_id,
                        'user_id': current_user['user_id']
                    },
                    {
                        '$set': {
                            'last_typing': datetime.utcnow()
                        }
                    },
                    upsert=True
                )
            else:
                # Remove typing status
                db.typing_status.delete_one({
                    'channel_id': channel_id,
                    'user_id': current_user['user_id']
                })

            return {'message': 'Typing status updated'}, 200
        except Exception as e:
            current_app.logger.error(f"Error updating typing status: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to update typing status'}, 500


@channels_ns.route('/<string:channel_id>/read')
class ChannelRead(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self, channel_id):
        """Mark channel messages as read"""
        current_user = get_current_user()
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Verify user is member of channel
            if not channel_model.is_member(channel_id, current_user['user_id']):
                return {'error': 'Not a member of this channel'}, 403

            # Mark as read
            from models.user_channel_read import UserChannelRead
            read_tracker = UserChannelRead(db)
            result = read_tracker.mark_as_read(current_user['user_id'], channel_id)

            current_app.logger.info(f"✅ Marked channel {channel_id} as read for user {current_user['user_id']}")
            return {'message': 'Marked as read', 'data': result}, 200
        except Exception as e:
            current_app.logger.error(f"Error marking channel as read: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to mark as read'}, 500


@channels_ns.route('/all')
class AllChannels(Resource):
    @channels_ns.doc(security='Bearer')
    @token_required
    def get(self):
        """Get all channels (admin only)"""
        current_user = get_current_user()
        try:
            # Check if user is admin
            db = current_app.db
            from models.user import User
            user_model = User(db)
            user = user_model.find_by_id(current_user['user_id'])
            if not user or user.get('role') != 'admin':
                return {'error': 'Admin access required'}, 403

            # Get all channels with member counts
            pipeline = [
                {
                    '$lookup': {
                        'from': 'channel_members',
                        'localField': '_id',
                        'foreignField': 'channel_id',
                        'as': 'members'
                    }
                },
                {
                    '$project': {
                        '_id': 0,
                        'id': {'$toString': '$_id'},
                        'name': 1,
                        'description': {'$ifNull': ['$description', '']},
                        'type': {'$ifNull': ['$type', 'public']},
                        'memberCount': {'$size': '$members'},
                        'createdAt': {
                            '$cond': {
                                'if': {'$ne': ['$created_at', None]},
                                'then': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S.%LZ', 'date': '$created_at'}},
                                'else': ''
                            }
                        }
                    }
                },
                {
                    '$sort': {'name': 1}
                }
            ]

            channels = list(db.channels.aggregate(pipeline))

            return {'channels': channels, 'total': len(channels)}, 200
        except Exception as e:
            current_app.logger.error(f"Error fetching all channels: {str(e)}")
            return {'error': str(e)}, 500
