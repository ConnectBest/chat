"""
Performance Analysis Script
Identifies exact bottlenecks in the chat application
"""

import re
from collections import defaultdict
from datetime import datetime

# Parse backend log
log_file = "/Users/spartan/Desktop/Project frontend copy/chat-backend/backend.log"

# Store timing data
endpoint_times = defaultdict(list)
endpoint_counts = defaultdict(int)

print("=" * 80)
print("CHAT APPLICATION PERFORMANCE ANALYSIS")
print("=" * 80)

try:
    with open(log_file, 'r') as f:
        lines = f.readlines()
        
    # Parse log lines for timing information
    # Format: 127.0.0.1 - - [timestamp] "GET /api/endpoint HTTP/1.1" status size time_in_seconds
    pattern = r'"(GET|POST|PUT|DELETE) ([^ ]+) HTTP.*?" \d+ \d+ ([\d\.]+)'
    
    for line in lines:
        match = re.search(pattern, line)
        if match:
            method = match.group(1)
            endpoint = match.group(2)
            time_seconds = float(match.group(3))
            time_ms = time_seconds * 1000
            
            endpoint_times[endpoint].append(time_ms)
            endpoint_counts[endpoint] += 1
    
    # Calculate statistics
    print("\n📊 ENDPOINT PERFORMANCE STATISTICS")
    print("-" * 80)
    print(f"{'Endpoint':<50} {'Calls':<8} {'Avg(ms)':<10} {'Max(ms)':<10} {'Total(s)':<10}")
    print("-" * 80)
    
    total_time = 0
    slow_endpoints = []
    
    for endpoint in sorted(endpoint_times.keys(), key=lambda x: sum(endpoint_times[x]), reverse=True):
        times = endpoint_times[endpoint]
        avg = sum(times) / len(times)
        max_time = max(times)
        total = sum(times) / 1000  # Convert to seconds
        count = endpoint_counts[endpoint]
        
        total_time += total
        
        # Flag slow endpoints (avg > 500ms)
        if avg > 500:
            slow_endpoints.append((endpoint, avg, max_time, count))
        
        print(f"{endpoint:<50} {count:<8} {avg:<10.0f} {max_time:<10.0f} {total:<10.1f}")
    
    print("-" * 80)
    print(f"{'TOTAL':<50} {sum(endpoint_counts.values()):<8} {'':<10} {'':<10} {total_time:<10.1f}")
    
    # Critical bottlenecks
    print("\n\n🔴 CRITICAL BOTTLENECKS (Avg > 500ms)")
    print("-" * 80)
    if slow_endpoints:
        for endpoint, avg, max_time, count in slow_endpoints:
            print(f"❌ {endpoint}")
            print(f"   Average: {avg:.0f}ms | Max: {max_time:.0f}ms | Calls: {count}")
            print()
    else:
        print("✅ No critical bottlenecks found (all endpoints < 500ms avg)")
    
    # Most called endpoints
    print("\n📈 MOST FREQUENTLY CALLED ENDPOINTS")
    print("-" * 80)
    sorted_by_calls = sorted(endpoint_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    for endpoint, count in sorted_by_calls:
        avg = sum(endpoint_times[endpoint]) / len(endpoint_times[endpoint])
        print(f"{endpoint:<50} {count:>5} calls (avg {avg:.0f}ms)")
    
    # Identify polling issues
    print("\n\n⚠️  POLLING ANALYSIS")
    print("-" * 80)
    
    typing_calls = endpoint_counts.get('/api/chat/channels/dm-692cf1a8e2f0b5c994eedf5e/typing', 0)
    channel_calls = endpoint_counts.get('/api/chat/channels', 0)
    dm_calls = endpoint_counts.get('/api/dm/conversations', 0)
    
    print(f"Typing endpoint:        {typing_calls} calls")
    print(f"Channels endpoint:      {channel_calls} calls")
    print(f"DM conversations:       {dm_calls} calls")
    
    if typing_calls > 50:
        print(f"\n⚠️  WARNING: Typing endpoint called {typing_calls} times!")
        print("   Recommendation: Increase polling interval or use WebSocket")
    
    if channel_calls > 30:
        print(f"\n⚠️  WARNING: Channels endpoint called {channel_calls} times!")
        print("   Recommendation: Cache channel list on frontend")
    
    if dm_calls > 30:
        print(f"\n⚠️  WARNING: DM conversations called {dm_calls} times!")
        print("   Recommendation: Cache DM list on frontend")

except FileNotFoundError:
    print(f"❌ Log file not found: {log_file}")
except Exception as e:
    print(f"❌ Error analyzing logs: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
