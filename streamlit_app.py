"""
ConnectBest Chat Platform - Streamlit Frontend

A beautiful and intuitive frontend for all platform features:
- Semantic Search
- Message Summarization
- User Lookup
- Meeting Scheduler
"""

import streamlit as st
import requests
import os
from datetime import datetime, timedelta
import pandas as pd
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="ConnectBest Chat Platform",
    page_icon="💬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# API Endpoints
SEMANTIC_SEARCH_URL = os.getenv("SEMANTIC_SEARCH_URL", "http://localhost:8001")
SUMMARIZER_URL = os.getenv("SUMMARIZER_URL", "http://localhost:8005")
EXPERT_FINDER_URL = os.getenv("EXPERT_FINDER_URL", "http://localhost:8003")
JARGON_BUSTER_URL = os.getenv("JARGON_BUSTER_URL", "http://localhost:8004")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8006")
USER_LOOKUP_URL = os.getenv("USER_LOOKUP_URL", "http://localhost:8002")
MEETING_SCHEDULER_URL = os.getenv("MEETING_SCHEDULER_URL", "http://localhost:8000")

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .feature-card {
        padding: 1.5rem;
        border-radius: 10px;
        background-color: #f0f2f6;
        margin-bottom: 1rem;
    }
    .success-box {
        padding: 1rem;
        border-radius: 5px;
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
    }
    .error-box {
        padding: 1rem;
        border-radius: 5px;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
    }
    .info-box {
        padding: 1rem;
        border-radius: 5px;
        background-color: #d1ecf1;
        border: 1px solid #bee5eb;
        color: #0c5460;
    }
</style>
""", unsafe_allow_html=True)

# Title
st.markdown('<div class="main-header">💬 ConnectBest Chat Platform</div>', unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    st.title("🎯 Features")
    
    page = st.radio(
        "Select a feature:",
        ["🏠 Home", "🔍 Semantic Search", "📊 Summarization", "🧑 Expert Finder", "📖 Jargon Buster", "🤖 AI Orchestrator", "👥 User Lookup", "📅 Meeting Scheduler", "🔧 System Status"]
    )
    
    st.markdown("---")
    st.markdown("### 📚 Documentation")
    st.markdown("[API Docs](http://localhost:8000/docs)")
    st.markdown("[GitHub](https://github.com/ConnectBest/chat)")

# Helper functions
def check_service_health(url: str) -> tuple:
    """Check if a service is healthy"""
    try:
        response = requests.get(f"{url}/health", timeout=5)
        if response.status_code == 200:
            return True, "Healthy"
        else:
            return False, f"Status {response.status_code}"
    except Exception as e:
        return False, str(e)

# Home Page
if page == "🏠 Home":
    st.markdown("## Welcome to ConnectBest Chat Platform")
    
    st.markdown("""
    ### 🚀 Platform Features
    
    A comprehensive suite of AI-powered tools for team collaboration and communication.
    """)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### 🔍 Semantic Search")
        st.info("AI-powered message search using natural language queries")
        
        st.markdown("#### 📊 Message Summarization")
        st.info("Generate intelligent summaries of channel conversations")
        
        st.markdown("#### 👤 Expert Finder")
        st.info("Find experts in your organization based on skills and expertise")
    
    with col2:
        st.markdown("#### 📖 Jargon Buster")
        st.info("Explain complex enterprise jargon using AI-powered RAG")
        
        st.markdown("#### 🤖 AI Orchestrator")
        st.info("Intelligent agent that routes queries to specialized services")
        
        st.markdown("#### 📅 Meeting Scheduler")
        st.info("Schedule Zoom meetings with automatic Gmail invitations")
    
    st.markdown("---")
    st.markdown("### 🎯 Quick Start")
    st.markdown("""
    1. Select a feature from the sidebar
    2. Configure your search or action
    3. View results in real-time
    4. Export or share as needed
    """)

# Semantic Search Page
elif page == "🔍 Semantic Search":
    st.markdown("## 🔍 Semantic Search")
    st.markdown("Search through messages using natural language queries")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        query = st.text_input("Enter your search query:", placeholder="e.g., project updates and deadlines")
    
    with col2:
        top_k = st.number_input("Results to show:", min_value=1, max_value=20, value=5)
    
    username = st.text_input("Your Username:", value="user", help="Enter your Slack username")
    
    if st.button("🔍 Search", type="primary"):
        if query and username:
            with st.spinner("Searching..."):
                try:
                    response = requests.post(
                        f"{SEMANTIC_SEARCH_URL}/api/semantic-search",
                        json={"query": query, "top_k": top_k, "username": username},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        results = response.json()
                        
                        st.success(f"✅ Found {len(results['results'])} results (searched {results.get('total_messages_searched', 0)} messages across {results.get('accessible_channels', 0)} channels)")
                        
                        for i, result in enumerate(results['results'], 1):
                            with st.expander(f"📝 Result {i} - #{result['channel_name']} by {result['author_name']} ({result['similarity_score']:.2%})"):
                                st.markdown(f"**Channel:** #{result['channel_name']}")
                                st.markdown(f"**Author:** {result['author_name']}")
                                st.markdown(f"**Similarity:** {result['similarity_score']:.2%}")
                                st.markdown(f"**Time:** {result['created_at']}")
                                st.markdown(f"**Message:**")
                                st.text(result['text'])
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please enter a search query")

# Summarization Page
elif page == "📊 Summarization":
    st.markdown("## 📊 Message Summarization")
    st.markdown("Generate AI-powered summaries of channel conversations")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        channel_id = st.text_input("Channel ID:", value="C12345", help="Enter the Slack channel ID")
    
    with col2:
        limit = st.number_input("Messages to analyze:", min_value=10, max_value=200, value=50)
    
    user_id = st.text_input("Your User ID:", value="U12345")
    thread_ts = st.text_input("Thread Timestamp (optional):", value="", help="Leave empty to summarize whole channel")
    
    if st.button("📊 Generate Summary", type="primary"):
        if channel_id and user_id:
            with st.spinner("Generating summary..."):
                try:
                    payload = {
                        "channel_id": channel_id,
                        "requesting_user_id": user_id,
                        "limit": limit
                    }
                    if thread_ts:
                        payload["thread_ts"] = thread_ts
                    
                    response = requests.post(
                        f"{SUMMARIZER_URL}/api/summarize",
                        json=payload,
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        summary = result.get('summary', '')
                        message_count = result.get('message_count', 0)
                        
                        st.success("✅ Summary generated successfully!")
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Channel ID", channel_id)
                        with col2:
                            st.metric("Messages", message_count)
                        
                        st.markdown("### 📝 Summary")
                        st.markdown(summary)
                        
                        # Download button
                        st.download_button(
                            "📥 Download Summary",
                            summary,
                            file_name=f"summary_{channel_id}_{datetime.now().strftime('%Y%m%d')}.txt"
                        )
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please fill in all required fields")

# Expert Finder Page
elif page == "🧑 Expert Finder":
    st.markdown("## 🧑 Expert Finder")
    st.markdown("Find experts in your organization based on skills and past contributions")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        skill_query = st.text_input("What expertise are you looking for?", placeholder="e.g., Python, Machine Learning, DevOps")
    
    with col2:
        top_k = st.number_input("Results:", min_value=1, max_value=10, value=3)
    
    user_id = st.text_input("Your User ID:", value="U12345")
    
    if st.button("🔍 Find Experts", type="primary"):
        if skill_query and user_id:
            with st.spinner("Finding experts..."):
                try:
                    response = requests.post(
                        f"{EXPERT_FINDER_URL}/api/expert-finder",
                        json={
                            "query": skill_query,
                            "requesting_user_id": user_id,
                            "top_k": top_k
                        },
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        experts = result.get('experts', [])
                        
                        st.success(f"✅ Found {len(experts)} expert(s)")
                        
                        if experts:
                            for i, expert in enumerate(experts, 1):
                                with st.expander(f"👤 {expert.get('display_name', 'Unknown')} - Score: {expert.get('relevance_score', 0):.2f}"):
                                    col1, col2 = st.columns(2)
                                    with col1:
                                        st.markdown(f"**Name:** {expert.get('display_name', 'N/A')}")
                                        st.markdown(f"**Email:** {expert.get('email', 'N/A')}")
                                    with col2:
                                        st.markdown(f"**Score:** {expert.get('relevance_score', 0):.2f}")
                                        st.markdown(f"**User ID:** {expert.get('user_id', 'N/A')}")
                                    
                                    if expert.get('relevant_messages'):
                                        st.markdown("**Sample Messages:**")
                                        for msg in expert.get('relevant_messages', []):
                                            st.text(f"• {msg[:100]}...")
                        else:
                            st.info("ℹ️ No experts found. Try a different query or check if you have access to relevant channels.")
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please enter a skill or expertise to search for")

# Jargon Buster Page
elif page == "📖 Jargon Buster":
    st.markdown("## 📖 Jargon Buster")
    st.markdown("Get clear explanations of enterprise jargon and technical terms")
    
    jargon_term = st.text_input("Enter a term to explain:", placeholder="e.g., API Gateway, Kubernetes, Scrum")
    
    if st.button("💡 Explain Term", type="primary"):
        if jargon_term:
            with st.spinner("Looking up definition..."):
                try:
                    response = requests.post(
                        f"{JARGON_BUSTER_URL}/api/jargon-buster",
                        json={"term": jargon_term},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        st.success("✅ Definition found!")
                        
                        st.markdown(f"### 📚 {jargon_term}")
                        st.markdown(result.get('explanation', 'No explanation available'))
                        
                        if result.get('related_context'):
                            with st.expander("📎 Related Context from Your Organization"):
                                for ctx in result.get('related_context', []):
                                    st.markdown(f"**Channel:** #{ctx.get('channel', 'N/A')}")
                                    st.text(ctx.get('text', ''))
                                    st.markdown("---")
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please enter a term to explain")

# AI Orchestrator Page
elif page == "🤖 AI Orchestrator":
    st.markdown("## 🤖 AI Orchestrator")
    st.markdown("Ask anything and let AI route your query to the right service")
    
    st.info("💡 The orchestrator automatically determines which service to use based on your query!")
    
    user_query = st.text_area("What would you like to do?", placeholder="e.g., Find someone who knows about Docker\nExplain what API means\nSummarize the engineering channel", height=100)
    
    col1, col2 = st.columns(2)
    with col1:
        user_id = st.text_input("Your User ID:", value="U12345")
    with col2:
        username = st.text_input("Your Username:", value="user")
    
    if st.button("🚀 Execute Query", type="primary"):
        if user_query:
            with st.spinner("Processing your request..."):
                try:
                    response = requests.post(
                        f"{ORCHESTRATOR_URL}/api/orchestrate",
                        json={
                            "query": user_query,
                            "user_id": user_id,
                            "username": username,
                            "context": {}
                        },
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        st.success(f"✅ Query processed using: **{result.get('agent_used', 'Unknown')}**")
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Intent Detected", result.get('intent', 'Unknown'))
                        with col2:
                            st.metric("Service Used", result.get('agent_used', 'Unknown'))
                        
                        st.markdown("### 📋 Response")
                        response_data = result.get('response', {})
                        
                        if isinstance(response_data, dict):
                            st.json(response_data)
                        else:
                            st.markdown(str(response_data))
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please enter a query")

# User Lookup Page
elif page == "👥 User Lookup":
    st.markdown("## 👥 User Lookup")
    st.markdown("Find team members with intelligent search")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        user_query = st.text_input("Search for user:", placeholder="e.g., John Smith")
    
    with col2:
        requesting_user_id = st.text_input("Your User ID:", value="U12345")
    
    if st.button("👥 Search Users", type="primary"):
        if user_query:
            with st.spinner("Searching users..."):
                try:
                    response = requests.post(
                        f"{USER_LOOKUP_URL}/api/user-lookup",
                        json={
                            "query": user_query,
                            "requesting_user_id": requesting_user_id
                        },
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        st.success(f"✅ Found {result['count']} user(s)")
                        
                        if result['users']:
                            df = pd.DataFrame(result['users'])
                            
                            # Display as cards
                            for user in result['users']:
                                with st.expander(f"👤 {user['display_name']} ({user['email']})"):
                                    col1, col2, col3 = st.columns(3)
                                    with col1:
                                        st.markdown(f"**Email:** {user['email']}")
                                    with col2:
                                        st.markdown(f"**Admin:** {'Yes' if user.get('is_admin') else 'No'}")
                                    with col3:
                                        st.markdown(f"**Bot:** {'Yes' if user.get('is_bot') else 'No'}")
                                    
                                    if user.get('status'):
                                        st.markdown(f"**Status:** {user['status']}")
                        else:
                            st.info("ℹ️ No users found matching the query")
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please enter a search query")

# Meeting Scheduler Page
elif page == "📅 Meeting Scheduler":
    st.markdown("## 📅 Meeting Scheduler")
    st.markdown("Schedule Zoom meetings with automatic Gmail invitations")
    
    with st.form("meeting_form"):
        col1, col2 = st.columns(2)
        
        with col1:
            topic = st.text_input("Meeting Topic:", placeholder="e.g., Team Standup")
            host_email = st.text_input("Host Email:", value="cortona93@gmail.com")
            
            # Date and time
            meeting_date = st.date_input("Meeting Date:", value=datetime.now() + timedelta(days=1))
            meeting_time = st.time_input("Meeting Time:", value=datetime.now().time())
        
        with col2:
            requesting_user_id = st.text_input("Your User ID:", value="U12345")
            duration = st.number_input("Duration (minutes):", min_value=15, max_value=480, value=60, step=15)
            
            # Participants
            st.markdown("**Participants:**")
            participant_emails = st.text_area(
                "Email addresses (one per line):",
                placeholder="user1@example.com\nuser2@example.com"
            )
        
        submit = st.form_submit_button("📅 Schedule Meeting", type="primary")
    
    if submit:
        if topic and host_email and participant_emails:
            # Parse emails
            emails = [email.strip() for email in participant_emails.split('\n') if email.strip()]
            
            # Combine date and time
            start_datetime = datetime.combine(meeting_date, meeting_time)
            
            with st.spinner("Scheduling meeting..."):
                try:
                    response = requests.post(
                        f"{MEETING_SCHEDULER_URL}/schedule",
                        json={
                            "topic": topic,
                            "participant_emails": emails,
                            "requesting_user_id": requesting_user_id,
                            "host_email": host_email,
                            "start_time": start_datetime.isoformat(),
                            "duration_minutes": duration
                        },
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        if result['success']:
                            meeting = result['meeting']
                            email_status = result['email_status']
                            
                            st.success("✅ Meeting scheduled successfully!")
                            
                            # Meeting details
                            st.markdown("### 📋 Meeting Details")
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Meeting ID", meeting['meeting_id'])
                            with col2:
                                st.metric("Password", meeting['password'])
                            with col3:
                                st.metric("Duration", f"{meeting['duration']} min")
                            
                            st.markdown(f"**Join URL:** [{meeting['join_url']}]({meeting['join_url']})")
                            
                            # Email status
                            st.markdown("### 📧 Email Status")
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Total", email_status['total'])
                            with col2:
                                st.metric("Successful", email_status['successful'], delta_color="normal")
                            with col3:
                                st.metric("Failed", email_status['failed'], delta_color="inverse")
                            
                            if email_status['failed_emails']:
                                st.warning(f"⚠️ Failed to send to: {', '.join(email_status['failed_emails'])}")
                        else:
                            st.error(f"❌ {result.get('message', 'Unknown error')}")
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        st.code(response.text)
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
        else:
            st.warning("⚠️ Please fill in all required fields")

# System Status Page
elif page == "🔧 System Status":
    st.markdown("## 🔧 System Status")
    st.markdown("Check the health of all services")
    
    if st.button("🔄 Refresh Status"):
        st.rerun()
    
    st.markdown("---")
    
    services = [
        (SEMANTIC_SEARCH_URL, "Semantic Search", "🔍"),
        (SUMMARIZER_URL, "Message Summarization", "📊"),
        (EXPERT_FINDER_URL, "Expert Finder", "🧑"),
        (JARGON_BUSTER_URL, "Jargon Buster", "📖"),
        (ORCHESTRATOR_URL, "AI Orchestrator", "🤖"),
        (USER_LOOKUP_URL, "User Lookup", "👥"),
        (MEETING_SCHEDULER_URL, "Meeting Scheduler", "📅")
    ]
    
    col1, col2 = st.columns(2)
    
    for i, (url, name, icon) in enumerate(services):
        with col1 if i % 2 == 0 else col2:
            with st.container():
                healthy, status = check_service_health(url)
                
                if healthy:
                    st.success(f"{icon} **{name}**\n\n✅ {status}")
                else:
                    st.error(f"{icon} **{name}**\n\n❌ {status}")
                
                st.caption(f"URL: {url}")
    
    st.markdown("---")
    st.markdown("### 📊 Service URLs")
    
    df = pd.DataFrame([
        {"Service": "Semantic Search", "URL": SEMANTIC_SEARCH_URL, "Docs": f"{SEMANTIC_SEARCH_URL}/docs"},
        {"Service": "Summarization", "URL": SUMMARIZER_URL, "Docs": f"{SUMMARIZER_URL}/docs"},
        {"Service": "Expert Finder", "URL": EXPERT_FINDER_URL, "Docs": f"{EXPERT_FINDER_URL}/docs"},
        {"Service": "Jargon Buster", "URL": JARGON_BUSTER_URL, "Docs": f"{JARGON_BUSTER_URL}/docs"},
        {"Service": "AI Orchestrator", "URL": ORCHESTRATOR_URL, "Docs": f"{ORCHESTRATOR_URL}/docs"},
        {"Service": "User Lookup", "URL": USER_LOOKUP_URL, "Docs": f"{USER_LOOKUP_URL}/docs"},
        {"Service": "Meeting Scheduler", "URL": MEETING_SCHEDULER_URL, "Docs": f"{MEETING_SCHEDULER_URL}/docs"}
    ])
    
    st.dataframe(df, use_container_width=True)

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #666;'>
    <p>ConnectBest Chat Platform © 2025 | Built with Streamlit</p>
</div>
""", unsafe_allow_html=True)
