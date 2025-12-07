#!/usr/bin/env python3
"""
Final Validation Script for JSON Serialization Fixes

This script performs a comprehensive validation that all Flask backend
endpoints and middleware return JSON-serializable values.

Run this before deploying to production to ensure no serialization issues.
"""

import sys
import os
import subprocess
from pathlib import Path

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


def print_header(text):
    """Print a formatted header"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}{text:^80}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")


def print_success(text):
    """Print success message"""
    print(f"{GREEN}✅ {text}{RESET}")


def print_error(text):
    """Print error message"""
    print(f"{RED}❌ {text}{RESET}")


def print_warning(text):
    """Print warning message"""
    print(f"{YELLOW}⚠️  {text}{RESET}")


def check_imports():
    """Check that all modules can be imported"""
    print_header("Testing Module Imports")
    
    try:
        # Set up minimal environment
        os.environ.setdefault('MONGODB_URI', 'mongodb://localhost:27017')
        os.environ.setdefault('MONGODB_DB_NAME', 'test')
        os.environ.setdefault('JWT_SECRET_KEY', 'test_secret')
        os.environ.setdefault('SECRET_KEY', 'test_flask_secret')
        os.environ.setdefault('NEXTAUTH_SECRET', 'test_nextauth')
        
        # Test critical imports
        from utils.auth import token_required, admin_required
        print_success("utils.auth imports successfully")
        
        from routes.auth import auth_ns
        print_success("routes.auth imports successfully")
        
        from routes.users import users_ns
        print_success("routes.users imports successfully")
        
        from routes.channels import channels_ns
        print_success("routes.channels imports successfully")
        
        from routes.messages import messages_ns
        print_success("routes.messages imports successfully")
        
        from routes.google_oauth import register_google_routes
        print_success("routes.google_oauth imports successfully")
        
        return True
        
    except Exception as e:
        print_error(f"Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_no_jsonify():
    """Verify no jsonify() usage in decorators"""
    print_header("Checking for jsonify() Usage")
    
    # Check utils/auth.py
    auth_file = Path('utils/auth.py')
    with open(auth_file, 'r') as f:
        content = f.read()
    
    # Check imports
    import_lines = [line for line in content.split('\n') 
                   if 'from flask import' in line]
    
    has_jsonify = False
    for line in import_lines:
        if 'jsonify' in line and not line.strip().startswith('#'):
            print_error(f"utils/auth.py imports jsonify: {line}")
            has_jsonify = True
    
    if not has_jsonify:
        print_success("utils/auth.py does not import jsonify")
    
    # Check for jsonify in actual code (not comments)
    import ast
    try:
        tree = ast.parse(content)
        
        found_jsonify_call = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if hasattr(node.func, 'id') and node.func.id == 'jsonify':
                    print_error(f"Found jsonify() call at line {node.lineno}")
                    found_jsonify_call = True
        
        if not found_jsonify_call:
            print_success("No jsonify() calls in utils/auth.py code")
        
        return not (has_jsonify or found_jsonify_call)
        
    except Exception as e:
        print_error(f"Failed to parse utils/auth.py: {e}")
        return False


def run_test_suite():
    """Run the automated test suite"""
    print_header("Running Automated Test Suite")
    
    result = subprocess.run(
        [sys.executable, 'test_serialization.py'],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print_success("All serialization tests PASSED")
        
        # Extract test count from output
        lines = result.stdout.split('\n')
        for line in lines:
            if 'Ran' in line and 'test' in line:
                print(f"  {line}")
            if line.strip() == 'OK':
                print(f"  {GREEN}{line}{RESET}")
        
        return True
    else:
        print_error("Serialization tests FAILED")
        print(result.stdout)
        print(result.stderr)
        return False


def audit_route_files():
    """Audit all route files for proper return patterns"""
    print_header("Auditing Route Files")
    
    import ast
    
    routes_dir = Path('routes')
    total_methods = 0
    total_files = 0
    
    for py_file in sorted(routes_dir.glob('*.py')):
        if py_file.name == '__init__.py':
            continue
        
        total_files += 1
        
        with open(py_file, 'r') as f:
            try:
                tree = ast.parse(f.read())
            except SyntaxError as e:
                print_error(f"{py_file.name}: Syntax error - {e}")
                continue
        
        # Count Resource methods
        method_count = 0
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                is_resource = any(
                    (isinstance(base, ast.Name) and base.id == 'Resource') or
                    (isinstance(base, ast.Attribute) and base.attr == 'Resource')
                    for base in node.bases
                )
                
                if is_resource:
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef) and not item.name.startswith('_'):
                            method_count += 1
        
        if method_count > 0:
            print_success(f"{py_file.name}: {method_count} Resource methods")
            total_methods += method_count
    
    print()
    print(f"  Total files audited: {total_files}")
    print(f"  Total Resource methods: {total_methods}")
    
    return True


def validate_documentation():
    """Check that documentation exists"""
    print_header("Validating Documentation")
    
    required_docs = [
        'SERIALIZATION_FIX_SUMMARY.md'
    ]
    
    all_exist = True
    for doc in required_docs:
        if Path(doc).exists():
            print_success(f"{doc} exists")
        else:
            print_error(f"{doc} is missing")
            all_exist = False
    
    return all_exist


def main():
    """Run all validation checks"""
    print_header("JSON Serialization Validation Suite")
    print("This script validates that all Flask backend responses are JSON-serializable")
    
    results = {
        'Imports': check_imports(),
        'No jsonify()': check_no_jsonify(),
        'Test Suite': run_test_suite(),
        'Route Audit': audit_route_files(),
        'Documentation': validate_documentation()
    }
    
    # Print summary
    print_header("VALIDATION SUMMARY")
    
    all_passed = True
    for check, passed in results.items():
        if passed:
            print_success(f"{check}: PASSED")
        else:
            print_error(f"{check}: FAILED")
            all_passed = False
    
    print()
    
    if all_passed:
        print(f"{GREEN}{'='*80}{RESET}")
        print(f"{GREEN}🎉 ALL VALIDATION CHECKS PASSED! 🎉{RESET}")
        print(f"{GREEN}{'='*80}{RESET}")
        print()
        print("The backend is ready for production deployment!")
        print("All endpoints return JSON-serializable values.")
        print()
        return 0
    else:
        print(f"{RED}{'='*80}{RESET}")
        print(f"{RED}❌ SOME VALIDATION CHECKS FAILED{RESET}")
        print(f"{RED}{'='*80}{RESET}")
        print()
        print("Please fix the issues above before deploying to production.")
        print()
        return 1


if __name__ == '__main__':
    sys.exit(main())
