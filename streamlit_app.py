"""
Slack Multi-Agent Chatbot UI
A modern chatbot interface for interacting with Slack channel data.
"""

import streamlit as st
import requests
import json
from datetime import datetime
import re

# Configuration
API_URL = "http://localhost:8006/api/orchestrate"
STREAM_API_URL = "http://localhost:8006/api/orchestrate/stream"

# Page configuration
st.set_page_config(
    page_title="Slack Agent Chat",
    page_icon="💬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for chat interface
st.markdown("""
<style>
    /* Main container */
    .main .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
        max-width: 1200px;
    }
    
    /* Chat messages */
    .user-message {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 18px;
        border-radius: 18px 18px 4px 18px;
        margin: 8px 0;
        max-width: 80%;
        margin-left: auto;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
    
    .assistant-message {
        background: #f0f2f6;
        color: #1f2937;
        padding: 12px 18px;
        border-radius: 18px 18px 18px 4px;
        margin: 8px 0;
        max-width: 80%;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    /* Progress indicator */
    .progress-item {
        background: #e8f4f8;
        border-left: 3px solid #0ea5e9;
        padding: 8px 12px;
        margin: 4px 0;
        border-radius: 0 8px 8px 0;
        font-size: 0.9em;
    }
    
    /* Meeting card */
    .meeting-card {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 16px;
        border-radius: 12px;
        margin: 10px 0;
    }
    
    /* Expert card */
    .expert-card {
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 12px;
        margin: 6px 0;
        border-radius: 0 8px 8px 0;
    }
    
    /* Summary section */
    .summary-section {
        background: #f0fdf4;
        border: 1px solid #86efac;
        padding: 16px;
        border-radius: 12px;
        margin: 10px 0;
    }
    
    /* Header styling */
    .chat-header {
        background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 20px;
        text-align: center;
    }
    
    /* Sidebar styling */
    .sidebar-section {
        background: #f8fafc;
        padding: 12px;
        border-radius: 8px;
        margin: 8px 0;
    }
    
    /* Input styling */
    .stTextInput > div > div > input {
        border-radius: 25px;
        border: 2px solid #e2e8f0;
        padding: 12px 20px;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
    }
    
    /* Button styling */
    .stButton > button {
        border-radius: 25px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 10px 24px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    
    /* Typing indicator */
    .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 12px 18px;
        background: #f0f2f6;
        border-radius: 18px;
        width: fit-content;
    }
    
    .typing-dot {
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
        animation: typing 1.4s infinite;
    }
    
    @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
    }
</style>
""", unsafe_allow_html=True)

# Sample users for the sidebar
SAMPLE_USERS = {
    "Alice Smith": "758494dd-09f7-4c8e-908a-6366388ad540",
    "Bob Johnson": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "Carol Williams": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
}

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "selected_user" not in st.session_state:
    st.session_state.selected_user = "Alice Smith"
if "user_id" not in st.session_state:
    st.session_state.user_id = SAMPLE_USERS["Alice Smith"]

def format_response(response_data):
    """Format the API response for display."""
    formatted = []
    
    # Check if response contains meeting details
    if "meeting_details" in response_data:
        meeting = response_data["meeting_details"]
        formatted.append(f"""
<div class="meeting-card">
    <h4>📅 Meeting Scheduled!</h4>
    <p><strong>Topic:</strong> {meeting.get('topic', 'N/A')}</p>
    <p><strong>Start:</strong> {meeting.get('start_time', 'N/A')}</p>
    <p><strong>Duration:</strong> {meeting.get('duration', 30)} minutes</p>
    <p><strong>Join URL:</strong> <a href="{meeting.get('join_url', '#')}" target="_blank" style="color: #a7f3d0;">{meeting.get('join_url', 'N/A')}</a></p>
    <p><strong>Meeting ID:</strong> {meeting.get('id', 'N/A')}</p>
</div>
""")
    
    # Check if response contains experts
    if "experts" in response_data and response_data["experts"]:
        formatted.append("<h4>👥 Experts Found:</h4>")
        for expert in response_data["experts"]:
            name = expert.get("name", "Unknown")
            email = expert.get("email", "N/A")
            score = expert.get("score", 0)
            sample = expert.get("sample_message", "")[:100] + "..." if expert.get("sample_message", "") else ""
            formatted.append(f"""
<div class="expert-card">
    <strong>{name}</strong> ({email})<br/>
    <small>Relevance: {score:.2f}</small>
    {f'<br/><em>"{sample}"</em>' if sample else ''}
</div>
""")
    
    # Check if response contains channel summaries
    if "channel_summaries" in response_data:
        formatted.append("<h4>📊 Channel Summaries:</h4>")
        for summary in response_data["channel_summaries"]:
            channel = summary.get("channel", "Unknown")
            msg_count = summary.get("message_count", 0)
            text = summary.get("summary", "No summary available")
            formatted.append(f"""
<div class="summary-section">
    <strong>#{channel}</strong> ({msg_count} messages)<br/>
    {text}
</div>
""")
    
    # Check for progress updates
    if "progress" in response_data and response_data["progress"]:
        formatted.append("<h4>⏳ Progress:</h4>")
        for step in response_data["progress"]:
            formatted.append(f'<div class="progress-item">✓ {step}</div>')
    
    # Check for search results
    if "search_results" in response_data and response_data["search_results"]:
        formatted.append("<h4>🔍 Search Results:</h4>")
        for result in response_data["search_results"][:5]:  # Limit to 5 results
            text = result.get("text", "")[:200] + "..." if len(result.get("text", "")) > 200 else result.get("text", "")
            channel = result.get("channel", "Unknown")
            author = result.get("author", "Unknown")
            formatted.append(f"""
<div class="summary-section">
    <strong>#{channel}</strong> - {author}<br/>
    <em>{text}</em>
</div>
""")
    
    # Add main response text
    if "response" in response_data:
        formatted.append(f"<p>{response_data['response']}</p>")
    elif "result" in response_data:
        formatted.append(f"<p>{response_data['result']}</p>")
    elif "summary" in response_data:
        formatted.append(f"""
<div class="summary-section">
    {response_data['summary']}
</div>
""")
    
    # Execution time
    if "execution_time" in response_data:
        formatted.append(f"<small style='color: #6b7280;'>⏱️ Executed in {response_data['execution_time']:.2f}s</small>")
    
    return "\n".join(formatted) if formatted else str(response_data)

def send_message(query: str, user_id: str, user_name: str) -> dict:
    """Send a message to the API and return the response."""
    try:
        payload = {
            "query": query,
            "user_id": user_id,
            "username": user_name
        }
        
        response = requests.post(
            API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"API Error: {response.status_code}", "details": response.text}
    
    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to the API. Make sure the server is running on port 8006."}
    except requests.exceptions.Timeout:
        return {"error": "Request timed out. The operation took too long."}
    except Exception as e:
        return {"error": f"An error occurred: {str(e)}"}


def is_all_channels_query(query: str) -> bool:
    """Check if the query is asking for all channels summary."""
    query_lower = query.lower()
    patterns = [
        r'\ball\s+(my\s+)?channels?\b',
        r'\ball\s+(the\s+)?slack\s+channels?\b',
        r'\bevery\s+channel\b',
        r'\ball\s+of\s+(my\s+)?channels?\b',
    ]
    return any(re.search(p, query_lower) for p in patterns)


def send_message_streaming(query: str, user_id: str, user_name: str, progress_container):
    """
    Send a message using the streaming endpoint for real-time updates.
    Returns the final response data.
    """
    try:
        payload = {
            "query": query,
            "user_id": user_id,
            "username": user_name
        }
        
        final_response = None
        progress_messages = []
        
        with requests.post(
            STREAM_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            stream=True,
            timeout=120
        ) as response:
            if response.status_code != 200:
                return {"error": f"API Error: {response.status_code}", "details": response.text}
            
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        data_str = line_str[6:]  # Remove 'data: ' prefix
                        try:
                            event = json.loads(data_str)
                            event_type = event.get("type", "")
                            
                            if event_type == "status":
                                msg = event.get("message", "")
                                progress_messages.append(msg)
                                # Update the progress display
                                with progress_container:
                                    st.empty()
                                    for pm in progress_messages:
                                        st.markdown(f"<div class='progress-item'>{pm}</div>", unsafe_allow_html=True)
                            
                            elif event_type == "channel_fetched":
                                msg = event.get("message", "")
                                progress_messages.append(msg)
                                with progress_container:
                                    st.empty()
                                    for pm in progress_messages:
                                        st.markdown(f"<div class='progress-item'>{pm}</div>", unsafe_allow_html=True)
                            
                            elif event_type == "complete":
                                final_response = event.get("data", {})
                                if "intent" in event:
                                    final_response["intent"] = event["intent"]
                                if "execution_time" in event:
                                    final_response["execution_time"] = event["execution_time"]
                            
                            elif event_type == "error":
                                final_response = {"error": event.get("message", "Unknown error")}
                            
                            elif event_type == "done":
                                if "execution_time" in event and final_response:
                                    final_response["execution_time"] = event["execution_time"]
                                break
                        
                        except json.JSONDecodeError:
                            continue
        
        return final_response or {"error": "No response received"}
    
    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to the API. Make sure the server is running on port 8006."}
    except requests.exceptions.Timeout:
        return {"error": "Request timed out. The operation took too long."}
    except Exception as e:
        return {"error": f"An error occurred: {str(e)}"}

# Sidebar
with st.sidebar:
    st.markdown("### 👤 User Selection")
    selected_user = st.selectbox(
        "Select User",
        options=list(SAMPLE_USERS.keys()),
        index=list(SAMPLE_USERS.keys()).index(st.session_state.selected_user)
    )
    
    if selected_user != st.session_state.selected_user:
        st.session_state.selected_user = selected_user
        st.session_state.user_id = SAMPLE_USERS[selected_user]
        st.rerun()
    
    st.markdown(f"""
    <div class="sidebar-section">
        <strong>Current User:</strong> {st.session_state.selected_user}<br/>
        <small style="color: #6b7280;">ID: {st.session_state.user_id[:8]}...</small>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    st.markdown("### 💡 Quick Actions")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("📊 All Summaries", use_container_width=True):
            st.session_state.quick_action = "give me summary of all channels for the past 24 hours"
    with col2:
        if st.button("👥 Find Experts", use_container_width=True):
            st.session_state.quick_action = "who are the experts on machine learning?"
    
    col3, col4 = st.columns(2)
    with col3:
        if st.button("📅 Schedule Meet", use_container_width=True):
            st.session_state.quick_action = "schedule a meeting with the engineering team"
    with col4:
        if st.button("🔍 Search", use_container_width=True):
            st.session_state.quick_action = "search for discussions about API design"
    
    st.markdown("---")
    
    st.markdown("### 📋 Example Queries")
    st.markdown("""
    - "Summarize #engineering channel"
    - "Who knows about Python?"
    - "Search for budget discussions"
    - "Schedule a standup meeting tomorrow at 10am"
    - "What was discussed in sales yesterday?"
    """)
    
    st.markdown("---")
    
    if st.button("🗑️ Clear Chat History", use_container_width=True):
        st.session_state.messages = []
        st.rerun()
    
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; color: #6b7280; font-size: 0.8em;">
        <p>Slack Agent v1.0</p>
        <p>Powered by LLM + MongoDB</p>
    </div>
    """, unsafe_allow_html=True)

# Main chat area
st.markdown("""
<div class="chat-header">
    <h1>💬 Slack Agent Chat</h1>
    <p>Ask questions about your Slack channels, find experts, schedule meetings, and more!</p>
</div>
""", unsafe_allow_html=True)

# Display chat messages
chat_container = st.container()
with chat_container:
    for message in st.session_state.messages:
        if message["role"] == "user":
            st.markdown(f"""
            <div style="display: flex; justify-content: flex-end;">
                <div class="user-message">
                    {message["content"]}
                </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div style="display: flex; justify-content: flex-start;">
                <div class="assistant-message">
                    {message["content"]}
                </div>
            </div>
            """, unsafe_allow_html=True)

# Handle quick actions
if "quick_action" in st.session_state and st.session_state.quick_action:
    query = st.session_state.quick_action
    st.session_state.quick_action = None
    
    # Add user message
    st.session_state.messages.append({"role": "user", "content": query})
    
    # Check if this is an all-channels query (use streaming)
    if is_all_channels_query(query):
        # Create a placeholder for progress updates
        progress_placeholder = st.empty()
        with progress_placeholder.container():
            st.markdown("**🔄 Processing...**")
            progress_container = st.container()
            response = send_message_streaming(query, st.session_state.user_id, st.session_state.selected_user, progress_container)
        progress_placeholder.empty()  # Clear progress after done
    else:
        with st.spinner("🤔 Thinking..."):
            response = send_message(query, st.session_state.user_id, st.session_state.selected_user)
    
    # Format and add assistant message
    formatted_response = format_response(response)
    st.session_state.messages.append({"role": "assistant", "content": formatted_response})
    
    st.rerun()

# Chat input
st.markdown("<br/>", unsafe_allow_html=True)
col1, col2 = st.columns([6, 1])

with col1:
    user_input = st.text_input(
        "Message",
        placeholder="Ask me anything about your Slack channels...",
        key="user_input",
        label_visibility="collapsed"
    )

with col2:
    send_button = st.button("Send ➤", use_container_width=True)

# Process input
if send_button and user_input:
    # Add user message
    st.session_state.messages.append({"role": "user", "content": user_input})
    
    # Check if this is an all-channels query (use streaming)
    if is_all_channels_query(user_input):
        # Create a placeholder for progress updates
        progress_placeholder = st.empty()
        with progress_placeholder.container():
            st.markdown("**🔄 Processing with live updates...**")
            progress_container = st.container()
            response = send_message_streaming(user_input, st.session_state.user_id, st.session_state.selected_user, progress_container)
        progress_placeholder.empty()  # Clear progress after done
    else:
        with st.spinner("🤔 Thinking..."):
            response = send_message(user_input, st.session_state.user_id, st.session_state.selected_user)
    
    # Format and add assistant message
    formatted_response = format_response(response)
    st.session_state.messages.append({"role": "assistant", "content": formatted_response})
    
    st.rerun()

# Also handle Enter key submission
if user_input and not send_button:
    # Check if this is a new input (not already processed)
    if not st.session_state.messages or st.session_state.messages[-1].get("content") != user_input:
        pass  # Will be handled by the button click
