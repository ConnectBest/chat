"use client";
import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  version: string;
  timestamp: string;
}

interface Metrics {
  activeConnections: number;
  totalMessages: number;
  averageLatency: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

export default function OpsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [latencyData, setLatencyData] = useState<any[]>([]);
  const [connectionData, setConnectionData] = useState<any[]>([]);
  const [errorData, setErrorData] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchData();
    
    const interval = autoRefresh ? setInterval(fetchData, 5000) : null;
    return () => { if (interval) clearInterval(interval); };
  }, [autoRefresh]);

  async function fetchData() {
    // Mock health data
    setHealth({
      status: 'healthy',
      uptime: 99.99,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });

    // Mock metrics
    setMetrics({
      activeConnections: Math.floor(Math.random() * 100) + 50,
      totalMessages: Math.floor(Math.random() * 10000) + 5000,
      averageLatency: Math.floor(Math.random() * 50) + 20,
      errorRate: Math.random() * 2,
      cpuUsage: Math.floor(Math.random() * 30) + 20,
      memoryUsage: Math.floor(Math.random() * 40) + 40
    });

    // Mock time-series data
    const now = Date.now();
    setLatencyData(prev => {
      const newData = [...prev, {
        time: new Date(now).toLocaleTimeString(),
        latency: Math.floor(Math.random() * 50) + 20
      }];
      return newData.slice(-20); // Keep last 20 points
    });

    setConnectionData(prev => {
      const newData = [...prev, {
        time: new Date(now).toLocaleTimeString(),
        connections: Math.floor(Math.random() * 100) + 50
      }];
      return newData.slice(-20);
    });

    setErrorData(prev => {
      const newData = [...prev, {
        time: new Date(now).toLocaleTimeString(),
        errors: Math.floor(Math.random() * 5)
      }];
      return newData.slice(-20);
    });
  }

  const statusColor = health?.status === 'healthy' ? 'bg-green-500' : 
                      health?.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';

  const statusTextColor = health?.status === 'healthy' ? 'text-green-400' : 
                          health?.status === 'degraded' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Ops Dashboard</h1>
            <p className="text-white/60 text-sm md:text-base">Real-time system monitoring and observability</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-white/80">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs md:text-sm">Auto-refresh (5s)</span>
            </label>
            <button
              onClick={fetchData}
              className="px-3 md:px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition text-sm md:text-base"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Health Status */}
        {health && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${statusColor} animate-pulse`} />
                <div>
                  <h2 className={`text-2xl font-bold ${statusTextColor}`}>
                    {health.status.toUpperCase()}
                  </h2>
                  <p className="text-white/60 text-sm">System Status</p>
                </div>
              </div>
              <div className="flex gap-8">
                <div>
                  <div className="text-white/60 text-sm">Uptime</div>
                  <div className="text-white text-xl font-semibold">{health.uptime}%</div>
                </div>
                <div>
                  <div className="text-white/60 text-sm">Version</div>
                  <div className="text-white text-xl font-semibold">{health.version}</div>
                </div>
                <div>
                  <div className="text-white/60 text-sm">Last Check</div>
                  <div className="text-white text-sm">{new Date(health.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60">Active Connections</span>
                <span className="text-2xl">👥</span>
              </div>
              <div className="text-3xl font-bold text-white">{metrics.activeConnections}</div>
              <div className="text-green-400 text-sm mt-1">↗ +12% from last hour</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60">Total Messages</span>
                <span className="text-2xl">💬</span>
              </div>
              <div className="text-3xl font-bold text-white">{metrics.totalMessages.toLocaleString()}</div>
              <div className="text-green-400 text-sm mt-1">↗ +8% from yesterday</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60">Avg Latency</span>
                <span className="text-2xl">⚡</span>
              </div>
              <div className="text-3xl font-bold text-white">{metrics.averageLatency}ms</div>
              <div className="text-green-400 text-sm mt-1">↘ -5ms from average</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60">Error Rate</span>
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="text-3xl font-bold text-white">{metrics.errorRate.toFixed(2)}%</div>
              <div className="text-yellow-400 text-sm mt-1">↗ +0.3% from baseline</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60">CPU Usage</span>
                <span className="text-2xl">🖥️</span>
              </div>
              <div className="text-3xl font-bold text-white">{metrics.cpuUsage}%</div>
              <div className="text-green-400 text-sm mt-1">Normal range</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60">Memory Usage</span>
                <span className="text-2xl">💾</span>
              </div>
              <div className="text-3xl font-bold text-white">{metrics.memoryUsage}%</div>
              <div className="text-green-400 text-sm mt-1">Optimal</div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Latency Chart */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
            <h3 className="text-white font-semibold mb-4">Response Latency (ms)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="time" stroke="#ffffff60" />
                <YAxis stroke="#ffffff60" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #ffffff20', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Connections Chart */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6">
            <h3 className="text-white font-semibold mb-4">Active Connections</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={connectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="time" stroke="#ffffff60" />
                <YAxis stroke="#ffffff60" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #ffffff20', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Line type="monotone" dataKey="connections" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Chart */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Error Count (Last 20 intervals)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={errorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="time" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #ffffff20', borderRadius: '8px' }}
                labelStyle={{ color: '#ffffff' }}
              />
              <Bar dataKey="errors" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-white/40 text-xs text-center">
        </p>
      </div>
    </div>
  );
}
