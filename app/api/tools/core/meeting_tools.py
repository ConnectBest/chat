"""
Meeting Tools - Zoom meeting scheduling with Gmail invitations

Simplified and optimized:
- Clean Zoom API integration
- Gmail OAuth for invitations
- No redundant user lookups
"""

from typing import List, Dict, Optional
from datetime import datetime
import os
import base64
import requests
import re
from email.message import EmailMessage

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from dotenv import load_dotenv

from .data_tools import find_users
from .db import db_instance

load_dotenv()

# Gmail OAuth
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "cortona93@gmail.com")
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")

# Zoom Server-to-Server OAuth
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET")
ZOOM_ACCOUNT_ID = os.getenv("ZOOM_ACCOUNT_ID")
ZOOM_USER_ID = os.getenv("ZOOM_USER_ID", "me")


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return False
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email.strip()))


def get_user_email(user_id: str) -> Optional[str]:
    """Get user email from database"""
    db = db_instance.get_db()
    if db is None:
        return None
    user = db.users.find_one({"id": user_id}, {"email": 1})
    return user.get("email") if user else None


def _get_zoom_token() -> str:
    """Get Zoom access token"""
    if not all([ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID]):
        raise ValueError("Zoom credentials not configured")
    
    credentials = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}"
    b64_creds = base64.b64encode(credentials.encode()).decode()
    
    resp = requests.post(
        "https://zoom.us/oauth/token",
        headers={"Authorization": f"Basic {b64_creds}"},
        data={"grant_type": "account_credentials", "account_id": ZOOM_ACCOUNT_ID}
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _get_gmail_service():
    """Get authenticated Gmail service"""
    if not all([GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN]):
        raise ValueError("Gmail credentials not configured")
    
    creds = Credentials(
        token=None,
        refresh_token=GMAIL_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GMAIL_CLIENT_ID,
        client_secret=GMAIL_CLIENT_SECRET,
        scopes=["https://www.googleapis.com/auth/gmail.send"]
    )
    creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)


def _create_zoom_meeting(topic: str, start_time: datetime, duration: int) -> Dict:
    """Create Zoom meeting"""
    token = _get_zoom_token()
    
    resp = requests.post(
        f"https://api.zoom.us/v2/users/{ZOOM_USER_ID}/meetings",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "topic": topic,
            "type": 2,
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "timezone": "UTC",
            "settings": {
                "host_video": True,
                "participant_video": True,
                "join_before_host": True,
                "waiting_room": False
            }
        }
    )
    resp.raise_for_status()
    data = resp.json()
    
    return {
        "meeting_id": str(data["id"]),
        "password": data.get("password", ""),
        "join_url": data["join_url"],
        "topic": data["topic"],
        "start_time": data["start_time"],
        "duration": duration
    }


def _send_invitations(meeting: Dict, emails: List[str]) -> Dict:
    """Send meeting invitations via Gmail"""
    try:
        service = _get_gmail_service()
    except Exception as e:
        return {"successful": 0, "failed": len(emails), "error": str(e)}
    
    start_dt = datetime.fromisoformat(meeting['start_time'].replace('Z', '+00:00'))
    formatted_time = start_dt.strftime("%A, %B %d, %Y at %I:%M %p")
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2 style="color: #2D8CFF;">Zoom Meeting: {meeting['topic']}</h2>
        <p><strong>📅 When:</strong> {formatted_time}</p>
        <p><strong>⏱️ Duration:</strong> {meeting['duration']} minutes</p>
        <p><strong>🔢 Meeting ID:</strong> {meeting['meeting_id']}</p>
        <p><strong>🔐 Password:</strong> {meeting.get('password', 'N/A')}</p>
        <p><a href="{meeting['join_url']}" style="background-color: #2D8CFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Join Meeting</a></p>
    </body>
    </html>
    """
    
    success = 0
    for email in emails:
        try:
            msg = EmailMessage()
            msg["To"] = email
            msg["From"] = SENDER_EMAIL
            msg["Subject"] = f"Zoom Meeting: {meeting['topic']}"
            msg.set_content(html_body, subtype='html')
            
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service.users().messages().send(userId="me", body={"raw": raw}).execute()
            success += 1
        except Exception as e:
            print(f"Failed to send to {email}: {e}")
    
    return {"successful": success, "failed": len(emails) - success}


def schedule_meeting_tool(
    topic: str,
    start_time: str,
    duration_minutes: int,
    requesting_user_id: str,
    participant_emails: List[str] = [],
    participant_names: List[str] = [],
    host_email: str = None
) -> Dict:
    """
    Schedule a Zoom meeting and send invitations.
    """
    try:
        start_dt = datetime.fromisoformat(start_time)
        
        # Resolve names to emails
        resolved = []
        for name in participant_names:
            result = find_users(name, limit=1)
            if result.get("users"):
                email = result["users"][0].get("email")
                if email:
                    resolved.append(email)
        
        # Combine emails
        all_emails = list(set(participant_emails + resolved))
        
        # Add requesting user
        user_email = get_user_email(requesting_user_id)
        if user_email and user_email not in all_emails:
            all_emails.append(user_email)
        
        # Validate emails
        valid_emails = [e for e in all_emails if validate_email(e)]
        
        if not valid_emails:
            return {"success": False, "message": "No valid email addresses"}
        
        # Create meeting
        meeting = _create_zoom_meeting(topic, start_dt, duration_minutes)
        
        # Send invitations
        email_result = _send_invitations(meeting, valid_emails)
        
        return {
            "success": True,
            "meeting": meeting,
            "email_status": email_result,
            "participants": valid_emails,
            "host_email": user_email if user_email else "",
            "message": f"Meeting scheduled. Invitations sent to {email_result['successful']} people."
        }
    
    except Exception as e:
        return {"success": False, "message": f"Failed to schedule meeting: {str(e)}"}
