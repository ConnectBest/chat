#!/usr/bin/env python3
"""
Realistic Flask API Tests - Matching Next.js Frontend Request Patterns

This test suite validates Flask endpoints using the EXACT request patterns
that the Next.js frontend sends, including:
1. Custom headers (X-User-ID, X-User-Email, X-User-Role) from Next.js API routes
2. Authorization Bearer tokens from client-side requests
3. JSON request/response formats
4. Error response structures

This ensures the backend-frontend contract is properly validated.
"""

import sys
import os

# Set up test environment
os.environ['MONGODB_URI'] = 'mongodb://localhost:27017'
os.environ['MONGODB_DB_NAME'] = 'test'
os.environ['JWT_SECRET_KEY'] = 'test_secret_key_12345'
os.environ['SECRET_KEY'] = 'test_flask_secret'
os.environ['NEXTAUTH_SECRET'] = 'test_nextauth'
os.environ['FLASK_ENV'] = 'testing'

sys.path.insert(0, '/home/runner/work/chat/chat/backend')

import unittest
from unittest.mock import Mock, patch, MagicMock
import json


class TestNextJSRequestPatterns(unittest.TestCase):
    """Test Flask endpoints with Next.js request patterns"""
    
    def setUp(self):
        """Set up Flask test client"""
        # Patch MongoDB before importing app
        self.mongo_patcher = patch('pymongo.MongoClient')
        self.mock_mongo = self.mongo_patcher.start()
        
        # Mock MongoDB client and database
        mock_client = MagicMock()
        mock_db = MagicMock()
        mock_client.__getitem__.return_value = mock_db
        mock_client.server_info.return_value = {'version': '5.0.0'}
        mock_db.list_collection_names.return_value = ['users', 'channels', 'messages']
        self.mock_mongo.return_value = mock_client
        
        # Now import and create app
        from app import create_app
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
    def tearDown(self):
        """Clean up"""
        self.mongo_patcher.stop()
    
    def test_protected_endpoint_with_nextjs_headers(self):
        """
        Test protected endpoint with X-User-* headers (Next.js API route pattern)
        
        This matches how Next.js API routes proxy requests to Flask:
        - Next.js verifies the session
        - Sends user info via custom headers
        - Flask decorator extracts user from headers
        """
        headers = {
            'Content-Type': 'application/json',
            'X-User-ID': 'user_12345',
            'X-User-Email': 'user@example.com',
            'X-User-Role': 'user'
        }
        
        # Mock the database user lookup
        with patch('models.user.User.find_by_id') as mock_find:
            mock_find.return_value = {
                '_id': 'user_12345',
                'id': 'user_12345',
                'email': 'user@example.com',
                'username': 'testuser',
                'name': 'Test User',
                'role': 'user',
                'avatar': None,
                'created_at': '2024-01-01T00:00:00Z'
            }
            
            response = self.client.get('/api/auth/me', headers=headers)
            
            # Should return 200 with user data
            self.assertEqual(response.status_code, 200,
                           f"Expected 200, got {response.status_code}: {response.get_json()}")
            
            data = response.get_json()
            self.assertIsInstance(data, dict, "Response should be a dict")
            self.assertIn('user', data, "Response should contain 'user' key")
            
            print(f"✅ Next.js header auth: {response.status_code} - {type(data).__name__}")
    
    def test_protected_endpoint_with_bearer_token(self):
        """
        Test protected endpoint with Authorization: Bearer <token>
        
        This matches how client-side code makes direct API calls:
        - Frontend gets JWT from localStorage
        - Sends Authorization: Bearer <token> header
        - Flask decorator validates JWT
        """
        # Use a valid-looking JWT token (won't be validated in test)
        headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlcl8xMjM0NSIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIn0.test'
        }
        
        # Mock JWT verification and user lookup
        with patch('utils.auth.verify_nextauth_token') as mock_verify, \
             patch('models.user.User.find_by_id') as mock_find:
            
            mock_verify.return_value = {
                'user_id': 'user_12345',
                'email': 'user@example.com',
                'role': 'user'
            }
            
            mock_find.return_value = {
                '_id': 'user_12345',
                'id': 'user_12345',
                'email': 'user@example.com',
                'username': 'testuser',
                'name': 'Test User',
                'role': 'user',
                'created_at': '2024-01-01T00:00:00Z'
            }
            
            response = self.client.get('/api/auth/me', headers=headers)
            
            self.assertEqual(response.status_code, 200,
                           f"Expected 200, got {response.status_code}: {response.get_json()}")
            
            data = response.get_json()
            self.assertIsInstance(data, dict)
            
            print(f"✅ Bearer token auth: {response.status_code} - {type(data).__name__}")
    
    def test_missing_auth_returns_json_error(self):
        """
        Test that missing authentication returns proper JSON error
        
        This validates the fix we made - decorators must return (dict, int)
        """
        response = self.client.get('/api/auth/me')
        
        # Should return 401 Unauthorized
        self.assertEqual(response.status_code, 401,
                       f"Expected 401, got {response.status_code}")
        
        # Response should be JSON
        data = response.get_json()
        self.assertIsNotNone(data, "Response should be JSON-parseable")
        self.assertIsInstance(data, dict, "Response should be a dict")
        
        # Should have error key
        self.assertIn('error', data, "Error response should have 'error' key")
        
        print(f"✅ Missing auth returns JSON: {response.status_code} - {data}")
    
    def test_invalid_bearer_token_returns_json_error(self):
        """Test that invalid JWT returns proper JSON error"""
        headers = {
            'Authorization': 'Bearer invalid_token_xyz'
        }
        
        with patch('utils.auth.verify_nextauth_token') as mock_verify:
            mock_verify.return_value = None  # Invalid token
            
            response = self.client.get('/api/auth/me', headers=headers)
            
            self.assertEqual(response.status_code, 401)
            
            data = response.get_json()
            self.assertIsInstance(data, dict)
            self.assertIn('error', data)
            
            print(f"✅ Invalid token returns JSON: {response.status_code} - {data}")
    
    def test_admin_endpoint_with_regular_user(self):
        """Test admin endpoint rejects regular user with proper JSON error"""
        headers = {
            'X-User-ID': 'user_12345',
            'X-User-Email': 'user@example.com',
            'X-User-Role': 'user'  # Not admin
        }
        
        # Try to access an admin endpoint (if any exist)
        # For now, test the admin_required decorator logic
        from utils.auth import admin_required
        from flask import Flask
        
        @admin_required
        def admin_only_endpoint(current_user=None):
            return {'data': 'admin_data'}, 200
        
        with self.app.test_request_context(headers=headers):
            result = admin_only_endpoint()
            
            # Should return 403 Forbidden
            self.assertIsInstance(result, tuple)
            self.assertEqual(len(result), 2)
            self.assertIsInstance(result[0], dict)
            self.assertEqual(result[1], 403)
            self.assertIn('error', result[0])
            
            print(f"✅ Admin check returns JSON: {result[1]} - {result[0]}")
    
    def test_post_request_with_json_body(self):
        """
        Test POST request with JSON body (matching frontend pattern)
        
        Frontend uses: client.post('/endpoint', { data }, { headers })
        """
        headers = {
            'Content-Type': 'application/json',
            'X-User-ID': 'user_12345',
            'X-User-Email': 'user@example.com',
            'X-User-Role': 'user'
        }
        
        request_data = {
            'content': 'Test message content',
            'attachments': []
        }
        
        # Mock database operations
        with patch('models.channel.Channel.find_by_id') as mock_channel, \
             patch('models.message.Message.create') as mock_create:
            
            mock_channel.return_value = {
                '_id': 'channel_123',
                'id': 'channel_123',
                'name': 'general',
                'members': ['user_12345']
            }
            
            mock_create.return_value = 'message_789'
            
            response = self.client.post(
                '/api/chat/channels/channel_123/messages/send',
                data=json.dumps(request_data),
                headers=headers
            )
            
            # Check response is JSON
            if response.status_code == 200:
                data = response.get_json()
                self.assertIsInstance(data, dict)
                print(f"✅ POST with JSON body: {response.status_code} - {type(data).__name__}")
            else:
                # Even errors should be JSON
                data = response.get_json()
                self.assertIsInstance(data, dict, 
                                    f"Error response should be JSON: {data}")
                print(f"✅ POST error is JSON: {response.status_code} - {data}")


class TestResponseSerializability(unittest.TestCase):
    """Test that all responses are JSON-serializable"""
    
    def test_decorator_returns_are_serializable(self):
        """Verify decorator returns can be serialized to JSON"""
        from utils.auth import token_required
        from flask import Flask
        
        app = Flask(__name__)
        app.config['JWT_SECRET_KEY'] = 'test'
        
        @token_required
        def test_endpoint(current_user=None):
            return {'data': 'test'}, 200
        
        with app.test_request_context(headers={}):
            result = test_endpoint()
            
            # Should be a tuple
            self.assertIsInstance(result, tuple)
            
            # First element should be JSON-serializable
            response_data = result[0]
            try:
                json_str = json.dumps(response_data)
                self.assertIsInstance(json_str, str)
                print(f"✅ Decorator return is JSON-serializable: {response_data}")
            except (TypeError, ValueError) as e:
                self.fail(f"Response not JSON-serializable: {e}")


def main():
    """Run all tests"""
    print("=" * 80)
    print("Testing Flask API with Next.js Request Patterns")
    print("=" * 80)
    print()
    print("This validates that Flask responses match what Next.js expects:")
    print("  1. Custom headers (X-User-ID, X-User-Email, X-User-Role)")
    print("  2. Authorization: Bearer <token> headers")
    print("  3. JSON request bodies")
    print("  4. JSON response format")
    print()
    
    # Run tests
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestNextJSRequestPatterns))
    suite.addTests(loader.loadTestsFromTestCase(TestResponseSerializability))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print()
    print("=" * 80)
    if result.wasSuccessful():
        print("🎉 All Next.js request pattern tests PASSED!")
        print("✅ Flask backend correctly handles Next.js authentication patterns")
        print("✅ All responses are JSON-serializable")
        print("✅ Error responses follow proper format")
    else:
        print("❌ Some tests FAILED")
        print(f"Failures: {len(result.failures)}")
        print(f"Errors: {len(result.errors)}")
    print("=" * 80)
    
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(main())
