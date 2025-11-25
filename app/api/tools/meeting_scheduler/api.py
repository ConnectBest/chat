"""
Meeting Scheduler API

A production-ready FastAPI microservice for scheduling Zoom meetings and sending
Gmail invitations with optional user lookup integration.

Features:
- Zoom meeting creation via Server-to-Server OAuth
- Gmail invitation sending via OAuth 2.0
- User lookup integration for name-based participant resolution
- Email validation and status tracking
- Comprehensive error handling
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Optional
from datetime import datetime
import os
import json
import requests
import base64
from email.message import EmailMessage
import re
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import httpx
from dotenv import load_dotenv

load_dotenv()

# Gmail OAuth Configuration
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "cortona93@gmail.com")
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

# Zoom Server-to-Server OAuth Configuration
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET")
ZOOM_ACCOUNT_ID = os.getenv("ZOOM_ACCOUNT_ID")
ZOOM_USER_ID = os.getenv("ZOOM_USER_ID", "me")

# Request/Response Models
class MeetingRequest(BaseModel):
    topic: str = Field(..., description="Meeting topic/title")
    participant_emails: Optional[List[EmailStr]] = Field(default=[], description="List of participant email addresses")
    participant_names: Optional[List[str]] = Field(default=[], description="List of participant names to lookup")
    requesting_user_id: str = Field(..., description="ID of the user making the request (for scope check)")
    host_email: EmailStr = Field(..., description="Host email address (sender)")
    start_time: datetime = Field(..., description="Meeting start time (ISO 8601 format)")
    duration_minutes: int = Field(60, ge=1, le=1440, description="Meeting duration in minutes (1-1440)")

class MeetingDetails(BaseModel):
    platform: str
    topic: str
    meeting_id: str
    password: str
    join_url: str
    start_time: str
    duration: int
    host_email: Optional[str]
    timezone: str

class EmailStatus(BaseModel):
    total: int
    successful: int
    failed: int
    failed_emails: List[str]

class MeetingResponse(BaseModel):
    success: bool
    meeting: Optional[MeetingDetails]
    email_status: Optional[EmailStatus]
    valid_emails: List[str]
    invalid_emails: List[str]
    message: str

# Helper Functions
def get_gmail_creds(host_email: str = None):
    """
    Get Gmail API credentials using OAuth 2.0.
    
    Args:
        host_email: Optional host email for logging purposes
    
    Returns:
        Credentials object for Gmail API
    """
    token_path = os.path.join(os.path.dirname(__file__), "token.json")
    client_secret_path = os.path.join(os.path.dirname(__file__), "client_secret.json")
    
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        if creds and creds.valid:
            return creds
        if creds and creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            with open(token_path, "w") as f:
                f.write(creds.to_json())
            return creds
    
    if not os.path.exists(client_secret_path):
        raise FileNotFoundError(
            "client_secret.json not found! "
            "Please download OAuth 2.0 credentials from Google Cloud Console"
        )
    
    flow = InstalledAppFlow.from_client_secrets_file(
        client_secret_path, 
        SCOPES,
        redirect_uri='http://localhost:8080/'
    )
    
    creds = flow.run_local_server(
        port=8080,
        access_type='offline',
        prompt='consent'
    )
    
    with open(token_path, "w") as f:
        f.write(creds.to_json())
    
    return creds


def validate_email(email: str) -> bool:
    """Validate email address format."""
    if not email or not isinstance(email, str):
        return False
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_regex, email))


def validate_email_list(emails: List[str]) -> tuple:
    """Validate a list of email addresses. Returns (valid_emails, invalid_emails)"""
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
        raise ValueError("Zoom credentials not configured. Please set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_ACCOUNT_ID")
    
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


async def resolve_participants(names: List[str], requesting_user_id: str) -> List[str]:
    """
    Resolve participant names to emails using User Lookup Agent.
    """
    resolved_emails = []
    user_lookup_url = os.getenv("USER_LOOKUP_URL", "http://localhost:8002")
    
    async with httpx.AsyncClient() as client:
        for name in names:
            try:
                resp = await client.post(
                    f"{user_lookup_url}/api/user-lookup",
                    json={"query": name, "requesting_user_id": requesting_user_id}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data["users"]:
                        # Just take the first match for now
                        # In a real app, we might ask for clarification if multiple matches
                        resolved_emails.append(data["users"][0]["email"])
                    else:
                        print(f"⚠️ No user found for name: {name}")
                else:
                    print(f"❌ User Lookup failed for {name}: {resp.text}")
            except Exception as e:
                print(f"❌ Error calling User Lookup for {name}: {e}")
                
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
    except requests.exceptions.HTTPError as e:
        raise Exception(f"Failed to create Zoom meeting: {str(e)}")
    except Exception as e:
        raise Exception(f"Error creating Zoom meeting: {str(e)}")


def send_meeting_invitation(meeting_details: Dict, recipient_emails: List[str], host_email: str = None) -> Dict:
    """Send meeting invitation emails to multiple recipients using Gmail OAuth."""
    sender_email = host_email or SENDER_EMAIL
    platform = meeting_details['platform']
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
    <head></head>
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
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; 
                        font-size: 12px; color: #7f8c8d;">
                <p>This is an automated meeting invitation. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        creds = get_gmail_creds(sender_email)
        service = build("gmail", "v1", credentials=creds)
    except Exception as e:
        print(f"❌ Failed to authenticate with Gmail: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
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
            print(f"❌ Failed to send email to {recipient}: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            failed_emails.append(recipient)
    
    return {
        "total": len(recipient_emails),
        "successful": success_count,
        "failed": len(failed_emails),
        "failed_emails": failed_emails
    }


def schedule_zoom_meeting(
    topic: str,
    participant_emails: List[str],
    start_time: datetime,
    duration_minutes: int = 60,
    host_email: str = None
) -> Dict:
    """Schedule a Zoom meeting and send invitations via Gmail OAuth."""
    valid_emails, invalid_emails = validate_email_list(participant_emails)
    
    if not valid_emails:
        raise ValueError("No valid email addresses provided")
    
    meeting = create_zoom_meeting(topic, start_time, duration_minutes)
    email_result = send_meeting_invitation(meeting, valid_emails, host_email)
    
    return {
        "meeting": meeting,
        "email_status": email_result,
        "valid_emails": valid_emails,
        "invalid_emails": invalid_emails
    }


# FastAPI App
app = FastAPI(
    title="Meeting Scheduler API",
    description="API for scheduling Zoom meetings and sending Gmail invitations",
    version="1.0.0"
)

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {
        "service": "Meeting Scheduler API",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.post("/schedule", response_model=MeetingResponse)
async def schedule_meeting(request: MeetingRequest):
    """
    Schedule a Zoom meeting and send email invitations.
    """
    try:
        # Resolve names to emails
        resolved_emails = []
        if request.participant_names:
            resolved_emails = await resolve_participants(request.participant_names, request.requesting_user_id)
            
        # Combine provided emails and resolved emails
        all_emails = list(set(request.participant_emails + resolved_emails))
        
        if not all_emails:
             raise HTTPException(status_code=400, detail="No valid participants found (emails or names)")

        result = schedule_zoom_meeting(
            topic=request.topic,
            participant_emails=all_emails,
            start_time=request.start_time,
            duration_minutes=request.duration_minutes,
            host_email=request.host_email
        )
        
        return MeetingResponse(
            success=True,
            meeting=MeetingDetails(**result["meeting"]),
            email_status=EmailStatus(**result["email_status"]),
            valid_emails=result["valid_emails"],
            invalid_emails=result["invalid_emails"],
            message="Meeting scheduled successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to schedule meeting: {str(e)}")

@app.get("/health")
def health_check():
    """Check service health and configuration."""
    config_status = {
        "gmail_configured": bool(SENDER_EMAIL),
        "zoom_configured": all([ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID]),
        "client_secret_exists": os.path.exists(os.path.join(os.path.dirname(__file__), "client_secret.json")),
        "token_exists": os.path.exists(os.path.join(os.path.dirname(__file__), "token.json"))
    }
    
    return {
        "status": "healthy",
        "configuration": config_status
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
