"""
Input Validation Utilities

This module provides functions to validate user input.

LEARNING NOTE:
- Always validate user input before processing
- Never trust client-side validation alone
- Use regex patterns for format validation
- Provide clear error messages
"""

import re
from typing import Tuple


def validate_email(email: str) -> Tuple[bool, str]:
    """
    Validate email address format.
    
    LEARNING NOTE:
    - Uses regex pattern to check email format
    - Pattern checks: username@domain.tld
    - Returns tuple: (is_valid, error_message)
    
    Args:
        email: Email address to validate
    
    Returns:
        tuple: (bool: is_valid, str: error_message)
    """
    
    if not email or not isinstance(email, str):
        return False, "Email is required"
    
    # Email regex pattern
    # Explanation:
    # ^[a-zA-Z0-9._%+-]+ : Username part (letters, numbers, special chars)
    # @ : Must have @ symbol
    # [a-zA-Z0-9.-]+ : Domain name
    # \. : Must have dot
    # [a-zA-Z]{2,}$ : Domain extension (at least 2 letters)
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(email_pattern, email):
        return False, "Invalid email format"
    
    if len(email) > 254:  # Email max length per RFC 5321
        return False, "Email is too long"
    
    return True, ""


def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validate password strength.
    
    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    
    Args:
        password: Password to validate
    
    Returns:
        tuple: (bool: is_valid, str: error_message)
    """
    
    if not password or not isinstance(password, str):
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if len(password) > 128:
        return False, "Password is too long (max 128 characters)"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    
    return True, ""


def validate_name(name: str) -> Tuple[bool, str]:
    """
    Validate user name.
    
    Args:
        name: Name to validate
    
    Returns:
        tuple: (bool: is_valid, str: error_message)
    """
    
    if not name or not isinstance(name, str):
        return False, "Name is required"
    
    name = name.strip()
    
    if len(name) < 2:
        return False, "Name must be at least 2 characters long"
    
    if len(name) > 100:
        return False, "Name is too long (max 100 characters)"
    
    # Check for valid characters (letters, spaces, hyphens, apostrophes)
    if not re.match(r"^[a-zA-Z\s\-']+$", name):
        return False, "Name contains invalid characters"
    
    return True, ""


def validate_channel_name(name: str) -> Tuple[bool, str]:
    """
    Validate channel name.
    
    Requirements:
    - 2-50 characters
    - Lowercase letters, numbers, hyphens only
    - Must start with letter
    
    Args:
        name: Channel name to validate
    
    Returns:
        tuple: (bool: is_valid, str: error_message)
    """
    
    if not name or not isinstance(name, str):
        return False, "Channel name is required"
    
    name = name.strip().lower()
    
    if len(name) < 2:
        return False, "Channel name must be at least 2 characters long"
    
    if len(name) > 50:
        return False, "Channel name is too long (max 50 characters)"
    
    # Must start with letter, contain only letters, numbers, hyphens
    if not re.match(r'^[a-z][a-z0-9\-]*$', name):
        return False, "Channel name must start with a letter and contain only lowercase letters, numbers, and hyphens"
    
    return True, ""


def validate_message_content(content: str) -> Tuple[bool, str]:
    """
    Validate message content.
    
    Args:
        content: Message content to validate
    
    Returns:
        tuple: (bool: is_valid, str: error_message)
    """
    
    if not content or not isinstance(content, str):
        return False, "Message content is required"
    
    content = content.strip()
    
    if len(content) == 0:
        return False, "Message cannot be empty"
    
    if len(content) > 5000:  # Max message length
        return False, "Message is too long (max 5000 characters)"
    
    return True, ""


def validate_phone(phone: str) -> Tuple[bool, str]:
    """
    Validate phone number (basic validation).
    
    Args:
        phone: Phone number to validate
    
    Returns:
        tuple: (bool: is_valid, str: error_message)
    """
    
    if not phone:
        return True, ""  # Phone is optional
    
    if not isinstance(phone, str):
        return False, "Invalid phone format"
    
    # Remove common formatting characters
    cleaned = re.sub(r'[\s\-\(\)\+]', '', phone)
    
    # Check if contains only digits
    if not cleaned.isdigit():
        return False, "Phone number must contain only digits"
    
    # Check length (international numbers: 10-15 digits)
    if len(cleaned) < 10 or len(cleaned) > 15:
        return False, "Phone number must be between 10 and 15 digits"
    
    return True, ""


def sanitize_string(text: str, max_length: int = 1000) -> str:
    """
    Sanitize user input string.
    
    LEARNING NOTE:
    - Removes leading/trailing whitespace
    - Limits length
    - Can be extended to remove dangerous characters
    
    Args:
        text: String to sanitize
        max_length: Maximum allowed length
    
    Returns:
        str: Sanitized string
    """
    
    if not text or not isinstance(text, str):
        return ""
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Limit length
    if len(text) > max_length:
        text = text[:max_length]
    
    return text
