"""
Test: Verify reactions collection name consistency

This test ensures that all parts of the codebase are using the same
collection name for message reactions.
"""

import os


def test_collection_names_in_files():
    """Test that all Python files use the correct collection name."""
    
    backend_dir = os.path.dirname(__file__)
    
    # Files to check
    files_to_check = {
        'models/reaction.py': "COLLECTION = 'reactions'",
        'models/message.py': "REACTIONS_COLLECTION = 'reactions'",
        'init_db.py': "db['reactions']",
    }
    
    print("Checking collection names in Python files...")
    print()
    
    all_passed = True
    
    for file_path, expected_pattern in files_to_check.items():
        full_path = os.path.join(backend_dir, file_path)
        
        with open(full_path, 'r') as f:
            content = f.read()
        
        if expected_pattern in content:
            print(f"✅ {file_path}: Found '{expected_pattern}'")
        else:
            print(f"❌ {file_path}: Expected '{expected_pattern}' not found")
            all_passed = False
    
    print()
    
    # Check that old name is NOT used (except in migration script and comments)
    old_patterns = ["COLLECTION = 'message_reactions'", "REACTIONS_COLLECTION = 'message_reactions'"]
    
    for file_path in ['models/reaction.py', 'models/message.py', 'init_db.py']:
        full_path = os.path.join(backend_dir, file_path)
        
        with open(full_path, 'r') as f:
            content = f.read()
        
        for old_pattern in old_patterns:
            if old_pattern in content:
                print(f"❌ {file_path}: Still contains old pattern '{old_pattern}'")
                all_passed = False
    
    return all_passed


if __name__ == '__main__':
    print("=" * 70)
    print("  TESTING: Reactions Collection Name Consistency")
    print("=" * 70)
    print()
    
    if test_collection_names_in_files():
        print()
        print("=" * 70)
        print("✅ ALL TESTS PASSED")
        print("=" * 70)
        exit(0)
    else:
        print()
        print("=" * 70)
        print("❌ SOME TESTS FAILED")
        print("=" * 70)
        exit(1)
