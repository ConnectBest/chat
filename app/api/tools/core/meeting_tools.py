from typing import List, Dict, Optional
from datetime import datetime
import os
import base64
import requests
import re
from email.message import EmailMessage
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from dotenv import load_dotenv
from .data_tools import find_users, get_user_scope

load_dotenv()

# Gmail OAuth Configuration
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "cortona93@gmail.com")
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")

# Zoom Server-to-Server OAuth Configuration
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET")
ZOOM_ACCOUNT_ID = os.getenv("ZOOM_ACCOUNT_ID")
ZOOM_USER_ID = os.getenv("ZOOM_USER_ID", "me")

def get_gmail_creds(host_email: str = None):
    """Get Gmail API credentials using OAuth 2.0."""
    if not all([GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN]):
        raise ValueError("Gmail OAuth credentials not configured.")
    
    creds = Credentials(
        token=None,
        refresh_token=GMAIL_REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GMAIL_CLIENT_ID,
        client_secret=GMAIL_CLIENT_SECRET,
        scopes=SCOPES
    )
    
    from google.auth.transport.requests import Request
    creds.refresh(Request())
    return creds

def validate_email(email: str) -> bool:
    """Validate email address format."""
    if not email or not isinstance(email, str):
        return False
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_regex, email))

def validate_email_list(emails: List[str]) -> tuple:
    """Validate a list of email addresses."""
    valid = []
    invalid = []
    for email in emails:
        email = email.strip()
        if validate_email(email):
            valid.append(email)
        else:
            invalid.append(email)
    return valid, invalid

def get_zoom_access_token() -> str:
    """Get Zoom access token using Server-to-Server OAuth."""
    if not all([ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID]):
        raise ValueError("Zoom credentials not configured.")
    
    credentials = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}"
    b64_credentials = base64.b64encode(credentials.encode()).decode()
    
    token_resp = requests.post(
        "https://zoom.us/oauth/token",
        headers={"Authorization": f"Basic {b64_credentials}"},
        data={
            "grant_type": "account_credentials",
            "account_id": ZOOM_ACCOUNT_ID
        }
    )
    token_resp.raise_for_status()
    return token_resp.json()["access_token"]

def resolve_participants(names: List[str], requesting_user_id: str) -> List[str]:
    """Resolve participant names to emails using local data tools."""
    resolved_emails = []
    
    # Get user scope for lookup
    scope = get_user_scope(requesting_user_id)
    scope_user_ids = scope.get("user_ids", [])
    
    for name in names:
        # Use find_users from data_tools
        result = find_users(search_term=name, scope_user_ids=scope_user_ids)
        users = result.get("users", [])
        
        if users:
            # Take the first match
            email = users[0].get("email")
            if email:
                resolved_emails.append(email)
                print(f"✅ Resolved {name} -> {email}")
            else:
                print(f"⚠️ User found for {name} but no email")
        else:
            print(f"⚠️ No user found for name: {name}")
                
    return resolved_emails

def create_zoom_meeting(topic: str, start_time: datetime, duration_minutes: int = 60) -> Dict:
    """Create a real Zoom meeting using Zoom API."""
    try:
        access_token = get_zoom_access_token()
        start_time_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
        
        create_resp = requests.post(
            f"https://api.zoom.us/v2/users/{ZOOM_USER_ID}/meetings",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={
                "topic": topic,
                "type": 2,  # Scheduled meeting
                "start_time": start_time_str,
                "timezone": "UTC",
                "agenda": f"Meeting scheduled for {topic}",
                "settings": {
                    "host_video": True,
                    "participant_video": True,
                    "join_before_host": True,
                    "mute_upon_entry": True,
                    "watermark": False,
                    "use_pmi": False,
                    "approval_type": 2,
                    "audio": "both",
                    "auto_recording": "none",
                    "waiting_room": False
                }
            }
        )
        create_resp.raise_for_status()
        meeting_data = create_resp.json()
        
        return {
            "platform": "Zoom",
            "topic": meeting_data["topic"],
            "meeting_id": str(meeting_data["id"]),
            "password": meeting_data.get("password", ""),
            "join_url": meeting_data["join_url"],
            "start_time": meeting_data["start_time"],
            "duration": meeting_data.get("duration", 0),
            "host_email": meeting_data.get("host_email", ""),
            "timezone": meeting_data.get("timezone", "UTC")
        }
    except Exception as e:
        raise Exception(f"Error creating Zoom meeting: {str(e)}")

def send_meeting_invitation(meeting_details: Dict, recipient_emails: List[str], host_email: str = None) -> Dict:
    """Send meeting invitation emails to multiple recipients using Gmail OAuth."""
    sender_email = host_email or SENDER_EMAIL
    topic = meeting_details['topic']
    meeting_id = meeting_details['meeting_id']
    password = meeting_details.get('password', '')
    join_url = meeting_details['join_url']
    start_time = meeting_details['start_time']
    duration = meeting_details['duration']
    
    start_dt = datetime.fromisoformat(start_time)
    formatted_time = start_dt.strftime("%A, %B %d, %Y at %I:%M %p")
    
    subject = f"Zoom Meeting Invitation: {topic}"
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #2c3e50; border-bottom: 2px solid #2D8CFF; padding-bottom: 10px;">
                You're Invited to a Zoom Meeting
            </h2>
            <div style="margin: 20px 0;">
                <h3 style="color: #34495e;">{topic}</h3>
            </div>
            <table style="width: 100%; margin: 20px 0;">
                <tr>
                    <td style="padding: 10px 0;"><strong>📅 Date & Time:</strong></td>
                    <td style="padding: 10px 0;">{formatted_time}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0;"><strong>⏱️ Duration:</strong></td>
                    <td style="padding: 10px 0;">{duration} minutes</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0;"><strong>🔢 Meeting ID:</strong></td>
                    <td style="padding: 10px 0;">{meeting_id}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0;"><strong>🔐 Password:</strong></td>
                    <td style="padding: 10px 0;">{password}</td>
                </tr>
            </table>
            <div style="margin: 30px 0; text-align: center;">
                <a href="{join_url}" 
                   style="display: inline-block; padding: 15px 30px; background-color: #2D8CFF; 
                          color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Join Zoom Meeting
                </a>
            </div>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #2D8CFF;">
                <strong>Meeting Link:</strong><br>
                <a href="{join_url}" style="color: #2D8CFF; word-break: break-all;">{join_url}</a>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        creds = get_gmail_creds(sender_email)
        service = build("gmail", "v1", credentials=creds)
    except Exception as e:
        print(f"❌ Failed to authenticate with Gmail: {str(e)}")
        return {
            "total": len(recipient_emails),
            "successful": 0,
            "failed": len(recipient_emails),
            "failed_emails": recipient_emails
        }
    
    success_count = 0
    failed_emails = []
    
    for recipient in recipient_emails:
        try:
            msg = EmailMessage()
            msg["To"] = recipient
            msg["From"] = sender_email
            msg["Subject"] = subject
            msg.set_content(html_body, subtype='html')
            
            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service.users().messages().send(
                userId="me",
                body={"raw": raw}
            ).execute()
            success_count += 1
        except Exception as e:
            print(f"❌ Failed to send email to {recipient}: {str(e)}")
            failed_emails.append(recipient)
    
    return {
        "total": len(recipient_emails),
        "successful": success_count,
        "failed": len(failed_emails),
        "failed_emails": failed_emails
    }

def get_user_email(user_id: str) -> Optional[str]:
    """Get user's email from database by user_id."""
    from .db import db_instance
    db = db_instance.get_db()
    if db is None:
        return None
    
    user = db.users.find_one({"id": user_id})
    if user:
        return user.get("email")
    return None


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
    Tool to schedule a Zoom meeting and send invitations.
    start_time should be ISO 8601 string.
    
    IMPORTANT: The requesting user is ALWAYS added as a participant and becomes the host.
    """
    try:
        # Parse start time
        start_dt = datetime.fromisoformat(start_time)
        
        # Get requesting user's email - they are ALWAYS a participant and the host
        requesting_user_email = get_user_email(requesting_user_id)
        if requesting_user_email:
            print(f"✅ Adding requesting user as participant and host: {requesting_user_email}")
            # Set requesting user as host
            if not host_email:
                host_email = requesting_user_email
        else:
            print(f"⚠️ Could not find email for requesting user: {requesting_user_id}")
        
        # Resolve names to emails
        resolved_emails = []
        if participant_names:
            resolved_emails = resolve_participants(participant_names, requesting_user_id)
            
        # Combine provided emails, resolved emails, AND requesting user's email
        all_emails = list(set(participant_emails + resolved_emails))
        
        # Add requesting user to participants if they have an email
        if requesting_user_email and requesting_user_email not in all_emails:
            all_emails.append(requesting_user_email)
            print(f"✅ Requesting user {requesting_user_email} added to participants list")
        
        if not all_emails:
             return {"success": False, "message": "No valid participants found (emails or names)"}

        valid_emails, invalid_emails = validate_email_list(all_emails)
        
        if not valid_emails:
            return {"success": False, "message": "No valid email addresses provided"}
        
        meeting = create_zoom_meeting(topic, start_dt, duration_minutes)
        
        # Override Zoom's host_email with our actual host (requesting user)
        # Zoom returns the account owner's email, but we want to show our host
        meeting["host_email"] = host_email or meeting.get("host_email")
        
        email_result = send_meeting_invitation(meeting, valid_emails, host_email)
        
        return {
            "success": True,
            "meeting": meeting,
            "email_status": email_result,
            "participants": valid_emails,
            "invalid_emails": invalid_emails if invalid_emails else None,
            "message": f"Meeting '{topic}' scheduled successfully. Invitations sent to {len(valid_emails)} participants."
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to schedule meeting: {str(e)}"}
