"""
Channel Routes - Channel management
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.channel import Channel
from models.message import Message
from utils.validators import validate_channel_name
from utils.auth import token_required

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
    def get(self, current_user):
        """List user's channels"""
        try:
            db = current_app.db
            channel_model = Channel(db)

            # Optimized: Use aggregation to get channels with last messages in single query
            try:
                from bson.objectid import ObjectId
                pipeline = [
                    # Stage 1: Get user's channel memberships
                    {
                        '$match': {
                            'user_id': ObjectId(current_user['user_id'])
                        }
                    },
                    # Stage 2: Join with channels
                    {
                        '$lookup': {
                            'from': 'channels',
                            'localField': 'channel_id',
                            'foreignField': '_id',
                            'as': 'channel'
                        }
                    },
                    {
                        '$unwind': '$channel'
                    },
                    # Stage 3: Filter out DM channels and deleted channels
                    {
                        '$match': {
                            'channel.is_deleted': False,
                            'channel.name': {'$not': {'$regex': '^dm_'}}
                        }
                    },
                    # Stage 4: Get last message for each channel
                    {
                        '$lookup': {
                            'from': 'messages',
                            'let': {'channel_id': '$channel_id'},
                            'pipeline': [
                                {
                                    '$match': {
                                        '$expr': {'$eq': ['$channel_id', '$$channel_id']},
                                        'is_deleted': False
                                    }
                                },
                                {'$sort': {'created_at': -1}},
                                {'$limit': 1},
                                {
                                    '$project': {
                                        'content': 1,
                                        'created_at': 1
                                    }
                                }
                            ],
                            'as': 'last_msg'
                        }
                    },
                    # Stage 5: Get read status for unread count
                    {
                        '$lookup': {
                            'from': 'user_channel_reads',
                            'let': {
                                'channel_id': '$channel_id',
                                'user_id': ObjectId(current_user['user_id'])
                            },
                            'pipeline': [
                                {
                                    '$match': {
                                        '$expr': {
                                            '$and': [
                                                {'$eq': ['$channel_id', '$$channel_id']},
                                                {'$eq': ['$user_id', '$$user_id']}
                                            ]
                                        }
                                    }
                                },
                                {
                                    '$project': {
                                        'last_read_at': 1
                                    }
                                }
                            ],
                            'as': 'read_status'
                        }
                    },
                    # Stage 6: Count unread messages
                    {
                        '$lookup': {
                            'from': 'messages',
                            'let': {
                                'channel_id': '$channel_id',
                                'last_read_at': {
                                    '$ifNull': [
                                        {'$arrayElemAt': ['$read_status.last_read_at', 0]},
                                        None
                                    ]
                                }
                            },
                            'pipeline': [
                                {
                                    '$match': {
                                        '$expr': {
                                            '$and': [
                                                {'$eq': ['$channel_id', '$$channel_id']},
                                                {'$eq': ['$is_deleted', False]},
                                                {
                                                    '$cond': {
                                                        'if': {'$ne': ['$$last_read_at', None]},
                                                        'then': {'$gt': ['$created_at', '$$last_read_at']},
                                                        'else': True
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {'$count': 'count'}
                            ],
                            'as': 'unread'
                        }
                    },
                    # Stage 7: Format output
                    {
                        '$project': {
                            '_id': 0,
                            'id': {'$toString': '$channel._id'},
                            'name': '$channel.name',
                            'description': '$channel.description',
                            'type': '$channel.type',
                            'created_by': {'$toString': '$channel.created_by'},
                            'created_at': {
                                '$dateToString': {
                                    'format': '%Y-%m-%dT%H:%M:%S.%LZ',
                                    'date': '$channel.created_at'
                                }
                            },
                            'member_role': '$role',
                            'last_message': {
                                '$cond': {
                                    'if': {'$gt': [{'$size': '$last_msg'}, 0]},
                                    'then': {'$arrayElemAt': ['$last_msg.content', 0]},
                                    'else': None
                                }
                            },
                            'last_message_at': {
                                '$cond': {
                                    'if': {'$gt': [{'$size': '$last_msg'}, 0]},
                                    'then': {
                                        '$dateToString': {
                                            'format': '%Y-%m-%dT%H:%M:%S.%LZ',
                                            'date': {'$arrayElemAt': ['$last_msg.created_at', 0]}
                                        }
                                    },
                                    'else': {
                                        '$dateToString': {
                                            'format': '%Y-%m-%dT%H:%M:%S.%LZ',
                                            'date': '$channel.created_at'
                                        }
                                    }
                                }
                            },
                            'unreadCount': {
                                '$ifNull': [
                                    {'$arrayElemAt': ['$unread.count', 0]},
                                    0
                                ]
                            }
                        }
                    },
                    # Stage 8: Sort by most recent activity
                    {
                        '$sort': {'last_message_at': -1}
                    }
                ]
                
                channels = list(db['channel_members'].aggregate(pipeline))
                return {'channels': channels}, 200
                
            except Exception as e:
                current_app.logger.error(f"Error in channels aggregation: {str(e)}")
                import traceback
                current_app.logger.error(traceback.format_exc())
                return {'error': 'Failed to list channels'}, 500
            
        except Exception as e:
            current_app.logger.error(f"Error: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to list channels'}, 500
    
    @channels_ns.expect(create_channel_model)
    @channels_ns.doc(security='Bearer')
    @token_required
    def post(self, current_user):
        """Create a new channel"""
        try:
            data = request.get_json()

            # Validate required fields
            name = data.get('name', '').strip()
            if not name:
                return {'error': 'Channel name is required'}, 400

            description = data.get('description')
            channel_type = data.get('type', 'public')

            # Validate channel name
            validation_result = validate_channel_name(name)
            if validation_result is not True:
                return {'error': validation_result}, 400

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
    def get(self, channel_id, current_user):
        """Get channel details"""
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
    def post(self, channel_id, current_user):
        """Join a channel"""
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
    def post(self, channel_id, user_id, current_user):
        """Add a member to a channel"""
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
    def delete(self, channel_id, user_id, current_user):
        """Remove a member from a channel"""
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
    def post(self, channel_id, current_user):
        """Add a member to a channel"""
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
    def delete(self, channel_id, user_id, current_user):
        """Remove a member from a channel"""
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
    def get(self, channel_id, current_user):
        """Get list of users currently typing in channel"""
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
    def post(self, channel_id, current_user):
        """Update user's typing status in channel"""
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
    def post(self, channel_id, current_user):
        """Mark channel messages as read"""
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
    def get(self, current_user):
        """Get all channels (admin only)"""
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
