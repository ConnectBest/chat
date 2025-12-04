"""
Email Service Module

Handles sending verification emails, password reset emails, and other notifications.
Uses SMTP with proper error handling and email templates.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class EmailService:
    """Email service for sending various types of emails"""
    
    def __init__(self):
        """Initialize email service with SMTP configuration"""
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
        self.smtp_from_email = os.getenv('SMTP_FROM_EMAIL', self.smtp_user)
        self.smtp_from_name = os.getenv('SMTP_FROM_NAME', 'ConnectBest Chat')
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:8080')
        
        # Check if email is configured
        self.is_configured = bool(self.smtp_user and self.smtp_password)
    
    def send_email(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """
        Send an email using SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML version of email body
            text_body: Plain text version of email body (optional)
        
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.is_configured:
            print("⚠️  Email service not configured. Set SMTP_USER and SMTP_PASSWORD in .env")
            print(f"📧 Would have sent email to {to_email}")
            print(f"   Subject: {subject}")
            return False
        
        try:
            # Create message
            message = MIMEMultipart('alternative')
            message['From'] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
            message['To'] = to_email
            message['Subject'] = subject
            
            # Add plain text version
            if text_body:
                text_part = MIMEText(text_body, 'plain')
                message.attach(text_part)
            
            # Add HTML version
            html_part = MIMEText(html_body, 'html')
            message.attach(html_part)
            
            # Connect to SMTP server and send
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)
            
            print(f"✅ Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_verification_email(self, to_email: str, name: str, verification_token: str) -> bool:
        """
        Send email verification link to user
        
        Args:
            to_email: User's email address
            name: User's name
            verification_token: Unique verification token
        
        Returns:
            bool: True if sent successfully
        """
        verification_link = f"{self.frontend_url}/verify-email?token={verification_token}"
        
        subject = "Verify Your Email - ConnectBest Chat"
        
        # HTML email template
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .button {{
                    display: inline-block;
                    padding: 15px 30px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 12px;
                }}
                .token {{
                    background: #e0e0e0;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                    word-break: break-all;
                    margin: 10px 0;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Welcome to ConnectBest Chat! 🎉</h1>
            </div>
            <div class="content">
                <p>Hi <strong>{name}</strong>,</p>
                <p>Thank you for registering! Please verify your email address to complete your registration.</p>
                <p style="text-align: center;">
                    <a href="{verification_link}" class="button">Verify Email Address</a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <div class="token">{verification_link}</div>
                <p><strong>⏰ This link will expire in 24 hours.</strong></p>
                <p>If you didn't create an account with ConnectBest Chat, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>© 2025 ConnectBest Chat. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_body = f"""
        Welcome to ConnectBest Chat!
        
        Hi {name},
        
        Thank you for registering! Please verify your email address by clicking the link below:
        
        {verification_link}
        
        This link will expire in 24 hours.
        
        If you didn't create an account with ConnectBest Chat, please ignore this email.
        
        © 2025 ConnectBest Chat
        """
        
        return self.send_email(to_email, subject, html_body, text_body)
    
    def send_password_reset_email(self, to_email: str, name: str, reset_token: str) -> bool:
        """
        Send password reset link to user
        
        Args:
            to_email: User's email address
            name: User's name
            reset_token: Unique password reset token
        
        Returns:
            bool: True if sent successfully
        """
        reset_link = f"{self.frontend_url}/reset-password?token={reset_token}"
        
        subject = "Reset Your Password - ConnectBest Chat"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .button {{
                    display: inline-block;
                    padding: 15px 30px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Password Reset Request 🔐</h1>
            </div>
            <div class="content">
                <p>Hi <strong>{name}</strong>,</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <p style="text-align: center;">
                    <a href="{reset_link}" class="button">Reset Password</a>
                </p>
                <p><strong>⏰ This link will expire in 1 hour.</strong></p>
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
                <p>© 2025 ConnectBest Chat. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Password Reset Request
        
        Hi {name},
        
        We received a request to reset your password. Click the link below to create a new password:
        
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        
        © 2025 ConnectBest Chat
        """
        
        return self.send_email(to_email, subject, html_body, text_body)
    
    def send_welcome_email(self, to_email: str, name: str) -> bool:
        """
        Send welcome email after email verification
        
        Args:
            to_email: User's email address
            name: User's name
        
        Returns:
            bool: True if sent successfully
        """
        subject = "Welcome to ConnectBest Chat! 🎉"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }}
                .content {{
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                }}
                .button {{
                    display: inline-block;
                    padding: 15px 30px;
                    background: #667eea;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>You're All Set! 🚀</h1>
            </div>
            <div class="content">
                <p>Hi <strong>{name}</strong>,</p>
                <p>Your email has been verified successfully! You can now enjoy all features of ConnectBest Chat:</p>
                <ul>
                    <li>💬 Real-time messaging</li>
                    <li>👥 Team channels</li>
                    <li>📎 File sharing</li>
                    <li>🎥 Video calls</li>
                    <li>🔔 Notifications</li>
                </ul>
                <p style="text-align: center;">
                    <a href="{self.frontend_url}/login" class="button">Start Chatting</a>
                </p>
                <p>Need help getting started? Check out our guide or contact support.</p>
            </div>
            <div class="footer">
                <p>© 2025 ConnectBest Chat. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        You're All Set!
        
        Hi {name},
        
        Your email has been verified successfully! You can now enjoy all features of ConnectBest Chat:
        
        - Real-time messaging
        - Team channels
        - File sharing
        - Video calls
        - Notifications
        
        Start chatting: {self.frontend_url}/login
        
        © 2025 ConnectBest Chat
        """
        
        return self.send_email(to_email, subject, html_body, text_body)


# Create a global instance
email_service = EmailService()


def send_verification_email(to_email: str, name: str, verification_token: str) -> bool:
    """Helper function to send verification email"""
    return email_service.send_verification_email(to_email, name, verification_token)


def send_password_reset_email(to_email: str, name: str, reset_token: str) -> bool:
    """Helper function to send password reset email"""
    return email_service.send_password_reset_email(to_email, name, reset_token)


def send_welcome_email(to_email: str, name: str) -> bool:
    """Helper function to send welcome email"""
    return email_service.send_welcome_email(to_email, name)
