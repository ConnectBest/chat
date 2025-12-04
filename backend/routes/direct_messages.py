"""
Direct Message Routes - One-on-one messaging
"""

from flask import request, current_app
from flask_restx import Namespace, Resource, fields
from models.message import Message
from models.channel import Channel
from bson.objectid import ObjectId
from datetime import datetime

dm_ns = Namespace('dm', description='Direct messaging operations')

dm_attachment_model = dm_ns.model('DMAttachment', {
    'name': fields.String(required=True, description='File name'),
    'size': fields.Integer(required=True, description='File size in bytes'),
    'type': fields.String(required=True, description='MIME type'),
    'url': fields.String(required=True, description='File URL')
})

send_dm_model = dm_ns.model('SendDM', {
    'content': fields.String(required=True, description='Message content', example='Hi there!'),
    'attachments': fields.List(fields.Nested(dm_attachment_model), description='File attachments')
})


@dm_ns.route('/users/<string:recipient_id>/messages')
class DMMessageList(Resource):
    @dm_ns.doc(security='Bearer')
    def get(self, recipient_id):
        """Get direct messages with a specific user"""
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
            sender_id = payload['user_id']
            
            # Find or create DM channel between these two users
            dm_channel_id = self._get_or_create_dm_channel(db, sender_id, recipient_id)
            
            if not dm_channel_id:
                return {'error': 'Failed to create DM channel'}, 500
            
            # Get messages from this DM channel
            message_model = Message(db)
            messages = message_model.list_channel_messages(dm_channel_id, limit=100)
            
            return {'messages': messages, 'dm_channel_id': dm_channel_id}, 200
            
        except Exception as e:
            current_app.logger.error(f"Error getting DMs: {str(e)}")
            return {'error': 'Failed to get messages'}, 500
    
    @dm_ns.expect(send_dm_model)
    @dm_ns.doc(security='Bearer')
    def post(self, recipient_id):
        """Send a direct message to a specific user"""
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
            content = data.get('content', '').strip()
            attachments = data.get('attachments', [])
            
            if not content:
                return {'error': 'Message content is required'}, 400
            
            db = current_app.db
            sender_id = payload['user_id']
            
            # Validate recipient exists
            recipient = db.users.find_one({'_id': ObjectId(recipient_id)})
            if not recipient:
                return {'error': 'Recipient not found'}, 404
            
            # Find or create DM channel between these two users
            dm_channel_id = self._get_or_create_dm_channel(db, sender_id, recipient_id)
            
            if not dm_channel_id:
                return {'error': 'Failed to create DM channel'}, 500
            
            # Send message
            message_model = Message(db)
            message = message_model.create(
                channel_id=dm_channel_id,
                user_id=sender_id,
                content=content,
                attachments=attachments
            )
            
            return {'message': message, 'dm_channel_id': dm_channel_id}, 201
            
        except Exception as e:
            current_app.logger.error(f"Error sending DM: {str(e)}")
            return {'error': 'Failed to send message'}, 500
    
    def _get_or_create_dm_channel(self, db, user1_id: str, user2_id: str) -> str:
        """
        Get or create a DM channel between two users.
        DM channels are private channels with exactly 2 members.
        Channel name format: dm_{smaller_id}_{larger_id} for consistency
        """
        try:
            # Sort IDs to ensure consistent channel naming
            ids = sorted([user1_id, user2_id])
            dm_channel_name = f"dm_{ids[0]}_{ids[1]}"
            
            # Check if DM channel already exists
            channel_model = Channel(db)
            existing_channel = channel_model.find_by_name(dm_channel_name)
            
            if existing_channel:
                return existing_channel['id']
            
            # Create new DM channel
            new_channel = channel_model.create(
                name=dm_channel_name,
                created_by=user1_id,
                description=f"Direct message between users",
                channel_type='private'
            )
            
            # Add second user as member
            channel_model.add_member(new_channel['id'], user2_id, role='member')
            
            return new_channel['id']
            
        except Exception as e:
            current_app.logger.error(f"Error in DM channel creation: {str(e)}")
            return None


@dm_ns.route('/conversations')
class DMConversationList(Resource):
    @dm_ns.doc(security='Bearer')
    def get(self):
        """Get all DM conversations for the current user"""
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'error': 'Unauthorized'}, 401
        
        try:
            # Handle both "Bearer token" and just "token" formats
            token_parts = auth_header.split()
            token = token_parts[1] if len(token_parts) > 1 else token_parts[0]
            
            from utils.auth import verify_token
            payload = verify_token(token)
            if not payload:
                return {'error': 'Invalid token'}, 401
            
            db = current_app.db
            user_id = payload['user_id']
            
            # Optimized: Single aggregation pipeline instead of N+1 queries
            # This replaces the old loop that was making 2 queries per DM channel
            try:
                pipeline = [
                    # Stage 1: Get all channels where user is a member
                    {
                        '$match': {
                            'user_id': ObjectId(user_id)
                        }
                    },
                    # Stage 2: Group by channel_id to eliminate duplicates
                    {
                        '$group': {
                            '_id': '$channel_id',
                            'channel_id': {'$first': '$channel_id'},
                            'role': {'$first': '$role'},
                            'joined_at': {'$first': '$joined_at'}
                        }
                    },
                    # Stage 3: Join with channels to get channel details
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
                    # Stage 4: Filter for DM channels only
                    {
                        '$match': {
                            'channel.name': {'$regex': '^dm_'},
                            'channel.is_deleted': False
                        }
                    },
                    # Stage 5: Get all members of each channel
                    {
                        '$lookup': {
                            'from': 'channel_members',
                            'localField': 'channel_id',
                            'foreignField': 'channel_id',
                            'as': 'all_members'
                        }
                    },
                    # Stage 5: Get all members of each channel
                    {
                        '$lookup': {
                            'from': 'channel_members',
                            'localField': 'channel_id',
                            'foreignField': 'channel_id',
                            'as': 'all_members'
                        }
                    },
                    # Stage 6: Filter to get only the OTHER user (not current user)
                    {
                        '$addFields': {
                            'other_member': {
                                '$arrayElemAt': [
                                    {
                                        '$filter': {
                                            'input': '$all_members',
                                            'as': 'member',
                                            'cond': {'$ne': ['$$member.user_id', ObjectId(user_id)]}
                                        }
                                    },
                                    0
                                ]
                            }
                        }
                    },
                    # Stage 7: Join with users collection to get other user's details
                    {
                        '$lookup': {
                            'from': 'users',
                            'localField': 'other_member.user_id',
                            'foreignField': '_id',
                            'as': 'other_user'
                        }
                    },
                    {
                        '$unwind': {'path': '$other_user', 'preserveNullAndEmptyArrays': False}
                    },
                    # Filter out any DMs where the other user doesn't exist
                    {
                        '$match': {
                            'other_user._id': {'$exists': True, '$ne': None}
                        }
                    },
                    # Stage 8: Get last message for each channel
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
                    # Stage 9: Get read status for unread count
                    {
                        '$lookup': {
                            'from': 'user_channel_reads',
                            'let': {
                                'channel_id': '$channel_id',
                                'user_id': ObjectId(user_id)
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
                    # Stage 10: Count unread messages
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
                    # Stage 11: Format the output
                    {
                        '$project': {
                            '_id': 0,
                            'dm_channel_id': {'$toString': '$channel_id'},
                            'user_id': {'$toString': '$other_user._id'},
                            'user_name': {
                                '$ifNull': [
                                    '$other_user.name',
                                    {'$ifNull': ['$other_user.username', {'$arrayElemAt': [{'$split': ['$other_user.email', '@']}, 0]}]}
                                ]
                            },
                            'user_email': '$other_user.email',
                            'user_avatar': '$other_user.avatar',
                            'user_status': {'$ifNull': ['$other_user.status', 'offline']},
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
                    # Stage 12: Sort by most recent
                    {
                        '$sort': {'last_message_at': -1}
                    }
                ]
                
                dm_conversations = list(db['channel_members'].aggregate(pipeline))
                return {'conversations': dm_conversations}, 200
                
            except Exception as e:
                current_app.logger.error(f"Error in DM aggregation: {str(e)}")
                import traceback
                current_app.logger.error(traceback.format_exc())
                return {'error': 'Failed to get conversations'}, 500
            
        except Exception as e:
            current_app.logger.error(f"Error getting DM conversations: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to get conversations'}, 500


@dm_ns.route('/channels/<string:dm_channel_id>/read')
class DMRead(Resource):
    @dm_ns.doc(security='Bearer')
    def post(self, dm_channel_id):
        """Mark DM messages as read"""
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
            channel_model = Channel(db)
            
            # Verify user is member of DM channel
            if not channel_model.is_member(dm_channel_id, payload['user_id']):
                return {'error': 'Not a member of this conversation'}, 403
            
            # Mark as read
            from models.user_channel_read import UserChannelRead
            read_tracker = UserChannelRead(db)
            result = read_tracker.mark_as_read(payload['user_id'], dm_channel_id)
            
            current_app.logger.info(f"✅ Marked DM channel {dm_channel_id} as read for user {payload['user_id']}")
            return {'message': 'Marked as read', 'data': result}, 200
        except Exception as e:
            current_app.logger.error(f"Error marking DM as read: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return {'error': 'Failed to mark as read'}, 500
