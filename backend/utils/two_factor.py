"""
Two-Factor Authentication (2FA) Utilities

This module provides functionality for TOTP-based 2FA using pyotp.
TOTP = Time-based One-Time Password (like Google Authenticator)

LEARNING NOTE:
- TOTP generates a 6-digit code that changes every 30 seconds
- Based on a secret key shared between server and authenticator app
- More secure than SMS-based 2FA (can't be intercepted)
- Works offline once set up
"""

import pyotp
import qrcode
import io
import base64
from typing import Tuple, Optional


def generate_secret() -> str:
    """
    Generate a new secret key for 2FA.
    
    Returns:
        str: Base32-encoded secret key (32 characters)
    
    LEARNING NOTE:
    - Secret is randomly generated and must be kept secure
    - User's authenticator app uses this to generate codes
    - If secret is compromised, attacker can generate valid codes
    """
    return pyotp.random_base32()


def generate_qr_code(secret: str, email: str, issuer: str = "ConnectBest Chat") -> str:
    """
    Generate QR code for 2FA setup.
    
    Args:
        secret: The TOTP secret key
        email: User's email address (for authenticator app label)
        issuer: Application name (shown in authenticator app)
    
    Returns:
        str: Base64-encoded PNG image of QR code
    
    LEARNING NOTE:
    - QR code encodes the provisioning URI for the authenticator app
    - User scans this with Google Authenticator, Authy, etc.
    - Format: otpauth://totp/Issuer:email?secret=SECRET&issuer=Issuer
    """
    # Create TOTP URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=email,
        issuer_name=issuer
    )
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 string
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"


def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    """
    Verify a TOTP code against the secret.
    
    Args:
        secret: The TOTP secret key
        code: 6-digit code from authenticator app
        window: Number of time windows to check (allows for clock drift)
    
    Returns:
        bool: True if code is valid, False otherwise
    
    LEARNING NOTE:
    - window=1 means we check current time ±30 seconds
    - Allows for slight time differences between server and user's device
    - Codes expire after 30 seconds for security
    """
    if not code or not secret:
        return False
    
    try:
        totp = pyotp.TOTP(secret)
        # Verify with time window tolerance
        return totp.verify(code, valid_window=window)
    except Exception:
        return False


def get_backup_codes(count: int = 8) -> list:
    """
    Generate backup codes for 2FA recovery.
    
    Args:
        count: Number of backup codes to generate
    
    Returns:
        list: List of backup codes (8 digits each)
    
    LEARNING NOTE:
    - Backup codes are for emergency access if user loses authenticator
    - Each code can only be used once
    - Should be stored securely (hashed like passwords)
    - User should save these in a safe place
    """
    backup_codes = []
    for _ in range(count):
        # Generate 8-digit backup code
        code = pyotp.random_base32()[:8].upper()
        backup_codes.append(code)
    return backup_codes


def format_secret_for_display(secret: str) -> str:
    """
    Format secret key for manual entry (in case QR code doesn't work).
    
    Args:
        secret: The TOTP secret key
    
    Returns:
        str: Formatted secret (e.g., "ABCD EFGH IJKL MNOP")
    
    LEARNING NOTE:
    - Some users prefer manual entry over QR scanning
    - Spaces make the key easier to read and type
    - Most authenticator apps accept either format
    """
    # Add space every 4 characters for readability
    return ' '.join([secret[i:i+4] for i in range(0, len(secret), 4)])


def validate_totp_setup(secret: str, initial_code: str) -> Tuple[bool, Optional[str]]:
    """
    Validate 2FA setup by checking the initial code.
    
    Args:
        secret: The TOTP secret key
        initial_code: First code from user's authenticator app
    
    Returns:
        tuple: (success: bool, error_message: Optional[str])
    
    LEARNING NOTE:
    - Users must verify their setup by entering a code
    - Prevents issues from incorrect QR scans or time sync problems
    - If this fails, user should try scanning again
    """
    if not initial_code:
        return False, "Verification code is required"
    
    if len(initial_code) != 6:
        return False, "Code must be 6 digits"
    
    if not initial_code.isdigit():
        return False, "Code must contain only numbers"
    
    if not verify_totp_code(secret, initial_code):
        return False, "Invalid code. Please check your authenticator app and try again"
    
    return True, None


def is_2fa_enabled(user_doc: dict) -> bool:
    """
    Check if 2FA is enabled for a user.
    
    Args:
        user_doc: User document from MongoDB
    
    Returns:
        bool: True if 2FA is enabled and configured
    """
    return (
        user_doc.get('two_factor_enabled', False) and 
        user_doc.get('two_factor_secret') is not None
    )
