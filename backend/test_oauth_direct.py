#!/usr/bin/env python3
"""
Direct test of Google OAuth configuration without Flask
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_oauth_config():
    """Test Google OAuth configuration"""
    print("=" * 60)
    print("GOOGLE OAUTH CONFIGURATION TEST")
    print("=" * 60)
    
    # Get environment variables
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    redirect_uri = os.getenv('GOOGLE_REDIRECT_URI')
    
    print("\n1. Environment Variables:")
    print(f"   CLIENT_ID exists: {client_id is not None}")
    print(f"   CLIENT_SECRET exists: {client_secret is not None}")
    print(f"   REDIRECT_URI exists: {redirect_uri is not None}")
    
    if client_id:
        print(f"\n2. CLIENT_ID Details:")
        print(f"   Length: {len(client_id)}")
        print(f"   First 20 chars: {client_id[:20]}")
        print(f"   Last 20 chars: {client_id[-20:]}")
        has_quotes = client_id.startswith('"') or client_id.startswith("'")
        print(f"   Has quotes: {has_quotes}")
        print(f"   Repr: {repr(client_id[:30])}...")
        
        # Check for common issues
        if '.apps.googleusercontent.com' in client_id:
            count = client_id.count('.apps.googleusercontent.com')
            print(f"   ✓ Contains .apps.googleusercontent.com ({count} time(s))")
            if count > 1:
                print("   ⚠️  WARNING: Domain appears multiple times!")
        else:
            print("   ⚠️  WARNING: Doesn't end with .apps.googleusercontent.com")
    
    if client_secret:
        print(f"\n3. CLIENT_SECRET Details:")
        print(f"   Length: {len(client_secret)}")
        print(f"   First 10 chars: {client_secret[:10]}")
        has_quotes = client_secret.startswith('"') or client_secret.startswith("'")
        print(f"   Has quotes: {has_quotes}")
    
    if redirect_uri:
        print(f"\n4. REDIRECT_URI:")
        print(f"   Value: {redirect_uri}")
    
    # Test GoogleOAuth class
    print("\n5. Testing GoogleOAuth Class:")
    try:
        from utils.google_oauth import GoogleOAuth
        oauth = GoogleOAuth()
        
        print(f"   ✓ GoogleOAuth initialized")
        print(f"   Client ID matches: {oauth.client_id == client_id}")
        print(f"   Client Secret matches: {oauth.client_secret == client_secret}")
        
        # Generate auth URL
        print("\n6. Testing URL Generation:")
        auth_url = oauth.get_authorization_url(state="test_state_123")
        print(f"   ✓ Auth URL generated")
        print(f"   URL length: {len(auth_url)}")
        
        # Extract client_id from URL
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(auth_url)
        params = parse_qs(parsed.query)
        url_client_id = params.get('client_id', ['NOT FOUND'])[0]
        
        print(f"\n7. Client ID in Generated URL:")
        print(f"   Value: {url_client_id}")
        print(f"   Matches original: {url_client_id == client_id}")
        print(f"   Length: {len(url_client_id)}")
        
        if url_client_id != client_id:
            print("\n   ⚠️  MISMATCH DETECTED!")
            print(f"   Expected: {client_id}")
            print(f"   Got:      {url_client_id}")
            print(f"   Diff:     {set(client_id) - set(url_client_id)}")
        
        print(f"\n8. Full Authorization URL:")
        print(f"   {auth_url}")
        
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    test_oauth_config()
