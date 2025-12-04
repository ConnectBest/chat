#!/usr/bin/env python3
"""Test script to verify Google OAuth URL generation"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get credentials
client_id = os.getenv('GOOGLE_CLIENT_ID')
client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')

print("=" * 80)
print("Google OAuth Configuration Test")
print("=" * 80)
print(f"\n✓ Client ID: {client_id}")
print(f"✓ Client Secret: {client_secret[:20]}..." if client_secret else "✗ Client Secret: NOT SET")
print(f"✓ Redirect URI: {redirect_uri}")

# Test URL generation
from utils.google_oauth import create_google_oauth_instance

google_oauth = create_google_oauth_instance()

if google_oauth:
    auth_url = google_oauth.get_authorization_url(state="test_state_123")
    print(f"\n✓ OAuth Authorization URL Generated:")
    print(f"\n{auth_url}\n")
    
    # Verify URL components
    if client_id in auth_url:
        print("✓ Client ID is in URL")
    else:
        print("✗ Client ID is MISSING from URL")
    
    if redirect_uri in auth_url:
        print("✓ Redirect URI is in URL")
    else:
        print("✗ Redirect URI is MISSING from URL")
        
    print("\n" + "=" * 80)
    print("Next steps:")
    print("=" * 80)
    print("\n1. Copy the URL above and paste it in your browser")
    print("2. If you get 'Access blocked', check Google Cloud Console:")
    print("   - Is the OAuth consent screen configured?")
    print("   - Is your email added as a test user?")
    print("   - Are the redirect URIs correctly set?")
    print("\n" + "=" * 80)
else:
    print("\n✗ Failed to create Google OAuth instance")
    print("Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set correctly")
