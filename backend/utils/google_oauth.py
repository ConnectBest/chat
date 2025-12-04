"""
Google OAuth Utility Module

This module handles Google OAuth 2.0 authentication flow.
Provides functions for generating authorization URLs and validating tokens.
"""

import os
import requests
from typing import Dict, Optional
from urllib.parse import urlencode


class GoogleOAuth:
    """Google OAuth 2.0 helper class"""
    
    def __init__(self):
        """Initialize with Google OAuth credentials"""
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5001/api/auth/google/callback')
        
        # Google OAuth URLs
        self.auth_url = 'https://accounts.google.com/o/oauth2/v2/auth'
        self.token_url = 'https://oauth2.googleapis.com/token'
        self.userinfo_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        
        # OAuth scopes
        self.scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ]
    
    def get_authorization_url(self, state: str = None) -> str:
        """
        Generate Google OAuth authorization URL
        
        Args:
            state (str): Random state for CSRF protection
        
        Returns:
            str: Authorization URL to redirect user to
        """
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(self.scopes),
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        if state:
            params['state'] = state
        
        # Build query string with proper URL encoding
        query_string = urlencode(params)
        return f"{self.auth_url}?{query_string}"
    
    def exchange_code_for_token(self, code: str) -> Optional[Dict]:
        """
        Exchange authorization code for access token
        
        Args:
            code (str): Authorization code from callback
        
        Returns:
            dict: Token response with access_token, id_token, etc.
            None: If exchange fails
        """
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri
        }
        
        try:
            response = requests.post(self.token_url, data=data, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error exchanging code for token: {e}")
            return None
    
    def get_user_info(self, access_token: str) -> Optional[Dict]:
        """
        Get user information from Google
        
        Args:
            access_token (str): Access token from token exchange
        
        Returns:
            dict: User info with email, name, picture, etc.
            None: If request fails
        """
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        try:
            response = requests.get(self.userinfo_url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error getting user info: {e}")
            return None
    
    def verify_id_token(self, id_token: str) -> Optional[Dict]:
        """
        Verify Google ID token
        
        Args:
            id_token (str): ID token from token response
        
        Returns:
            dict: Decoded token payload
            None: If verification fails
        """
        try:
            # Use Google's tokeninfo endpoint for verification
            url = f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}'
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            token_info = response.json()
            
            # Verify audience matches our client ID
            if token_info.get('aud') != self.client_id:
                print("Invalid audience in ID token")
                return None
            
            return token_info
        except requests.exceptions.RequestException as e:
            print(f"Error verifying ID token: {e}")
            return None


def validate_google_credentials() -> bool:
    """
    Check if Google OAuth credentials are configured
    
    Returns:
        bool: True if credentials are set, False otherwise
    """
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        return False
    
    if client_id == 'your_google_client_id_here' or client_secret == 'your_google_client_secret_here':
        return False
    
    return True


def create_google_oauth_instance() -> Optional[GoogleOAuth]:
    """
    Create GoogleOAuth instance if credentials are configured
    
    Returns:
        GoogleOAuth: Instance if credentials valid
        None: If credentials not configured
    """
    if not validate_google_credentials():
        print("⚠️  Google OAuth credentials not configured")
        print("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file")
        return None
    
    return GoogleOAuth()
