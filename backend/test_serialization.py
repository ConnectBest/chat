"""
Test suite to verify Flask backend returns JSON-serializable responses.

This test ensures that:
1. All decorators return (dict, int) tuples, not Response objects
2. All error paths return proper JSON-serializable dicts
3. No jsonify() is used in decorators (which breaks Flask-RESTX)
"""

import unittest
from unittest.mock import Mock, patch
import sys
import os

# Set up environment before importing Flask
os.environ['MONGODB_URI'] = 'mongodb://localhost:27017'
os.environ['MONGODB_DB_NAME'] = 'test'
os.environ['JWT_SECRET_KEY'] = 'test_secret_key_12345'
os.environ['SECRET_KEY'] = 'test_flask_secret'
os.environ['NEXTAUTH_SECRET'] = 'test_nextauth_secret'
os.environ['FLASK_ENV'] = 'testing'

sys.path.insert(0, '.')


class TestAuthDecoratorReturns(unittest.TestCase):
    """Test that auth decorators return JSON-serializable tuples"""
    
    def setUp(self):
        """Set up Flask test context"""
        # Import here to avoid issues
        from flask import Flask
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['JWT_SECRET_KEY'] = 'test_secret'
        self.app.config['NEXTAUTH_SECRET'] = 'test_secret'
        
    def test_token_required_missing_auth_returns_dict_tuple(self):
        """Test token_required with missing auth returns (dict, int)"""
        from utils.auth import token_required
        
        @token_required
        def protected_endpoint(current_user=None):
            return {'data': 'success'}, 200
        
        with self.app.test_request_context(headers={}):
            result = protected_endpoint()
            
            # Verify it's a tuple
            self.assertIsInstance(result, tuple, 
                                f"Expected tuple, got {type(result)}")
            
            # Verify tuple structure: (dict, int)
            self.assertEqual(len(result), 2,
                           f"Expected 2-element tuple, got {len(result)} elements")
            
            self.assertIsInstance(result[0], dict,
                                f"Expected dict as first element, got {type(result[0])}")
            
            self.assertIsInstance(result[1], int,
                                f"Expected int status code, got {type(result[1])}")
            
            # Verify 401 Unauthorized
            self.assertEqual(result[1], 401)
            
            # Verify error structure
            self.assertIn('error', result[0])
            
            print("✅ token_required returns (dict, int) for missing auth")
    
    def test_token_required_invalid_header_format_returns_dict_tuple(self):
        """Test token_required with invalid header format returns (dict, int)"""
        from utils.auth import token_required
        
        @token_required
        def protected_endpoint(current_user=None):
            return {'data': 'success'}, 200
        
        # Test with invalid format (no "Bearer" prefix)
        with self.app.test_request_context(headers={'Authorization': 'invalid_token'}):
            result = protected_endpoint()
            
            self.assertIsInstance(result, tuple)
            self.assertEqual(len(result), 2)
            self.assertIsInstance(result[0], dict)
            self.assertIsInstance(result[1], int)
            self.assertEqual(result[1], 401)
            self.assertIn('error', result[0])
            
            print("✅ token_required returns (dict, int) for invalid header format")
    
    def test_admin_required_missing_auth_returns_dict_tuple(self):
        """Test admin_required with missing auth returns (dict, int)"""
        from utils.auth import admin_required
        
        @admin_required
        def admin_endpoint(current_user=None):
            return {'data': 'admin_only'}, 200
        
        with self.app.test_request_context(headers={}):
            result = admin_endpoint()
            
            self.assertIsInstance(result, tuple)
            self.assertEqual(len(result), 2)
            self.assertIsInstance(result[0], dict)
            self.assertIsInstance(result[1], int)
            self.assertEqual(result[1], 401)
            self.assertIn('error', result[0])
            
            print("✅ admin_required returns (dict, int) for missing auth")
    
    def test_admin_required_non_admin_user_returns_dict_tuple(self):
        """Test admin_required with non-admin user returns 403 (dict, int)"""
        from utils.auth import admin_required
        
        @admin_required  
        def admin_endpoint(current_user=None):
            return {'data': 'admin_only'}, 200
        
        # Simulate regular user (not admin)
        with self.app.test_request_context(
            headers={
                'X-User-ID': 'user123',
                'X-User-Email': 'user@example.com',
                'X-User-Role': 'user'  # Not admin
            }
        ):
            result = admin_endpoint()
            
            self.assertIsInstance(result, tuple)
            self.assertEqual(len(result), 2)
            self.assertIsInstance(result[0], dict)
            self.assertIsInstance(result[1], int)
            self.assertEqual(result[1], 403)  # Forbidden
            self.assertIn('error', result[0])
            
            print("✅ admin_required returns (dict, int) for non-admin user")


class TestReturnTypeValidation(unittest.TestCase):
    """Test that routes don't use problematic return patterns"""
    
    def test_no_jsonify_in_decorators(self):
        """Ensure decorators don't import or use jsonify"""
        with open('utils/auth.py', 'r') as f:
            content = f.read()
        
        # Check import statement
        import_lines = [line for line in content.split('\n') 
                       if 'from flask import' in line and 'import' in line]
        
        for line in import_lines:
            if 'jsonify' in line:
                # Make sure it's not commented out
                if not line.strip().startswith('#'):
                    self.fail(f"jsonify should not be imported in utils/auth.py: {line}")
        
        print("✅ utils/auth.py does not import jsonify")
    
    def test_routes_follow_standards(self):
        """Check that route files have proper return format documentation"""
        route_files = [
            'routes/auth.py',
            'routes/google_oauth.py'
        ]
        
        for filepath in route_files:
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Check for documentation about return formats
            self.assertIn('RETURN FORMAT', content.upper(),
                        f"{filepath} should document return format standards")
            
        print("✅ Route files document return format standards")


if __name__ == '__main__':
    # Run tests with verbose output
    suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*70)
    if result.wasSuccessful():
        print("🎉 All serialization tests PASSED!")
        print("✅ Decorators return JSON-serializable (dict, int) tuples")
        print("✅ No jsonify() usage in decorators")
        print("✅ Route files follow documentation standards")
    else:
        print("❌ Some tests FAILED")
        print(f"Failures: {len(result.failures)}")
        print(f"Errors: {len(result.errors)}")
    print("="*70)
    
    sys.exit(0 if result.wasSuccessful() else 1)
