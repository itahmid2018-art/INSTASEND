import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Server, 
  Database, 
  Activity, 
  Radio, 
  Key, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Copy, 
  Check, 
  FileText, 
  Terminal, 
  Cpu, 
  HardDrive, 
  Lock, 
  UserPlus, 
  Sparkles,
  ArrowLeft,
  Crown
} from 'lucide-react';
import { UserProfile } from '../types.ts';
import { formatBytes } from '../services/device.ts';

interface AdminPortalProps {
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onClose: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  onLogin,
  onClose
}) => {
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Stats & User management data
  const [overview, setOverview] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [seedSql, setSeedSql] = useState<string>('');
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'users' | 'lan' | 'sql'>('system');
  const [copiedSql, setCopiedSql] = useState(false);

  // New user form modal state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('TestPass2026!');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserPlan, setNewUserPlan] = useState<'free' | 'pro'>('pro');
  const [addUserError, setAddUserError] = useState<string | null>(null);

  const isAdminAuthenticated = currentUser?.role === 'admin' || currentUser?.email === 'admin';

  // Load telemetry & users if admin is logged in
  const fetchAdminData = async () => {
    setIsLoadingStats(true);
    try {
      const [ovRes, usrRes, sqlRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/users'),
        fetch('/api/admin/seed-sql')
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        if (ovData.success) setOverview(ovData.stats);
      }

      if (usrRes.ok) {
        const usrData = await usrRes.json();
        if (usrData.success) setUsersList(usrData.users);
      }

      if (sqlRes.ok) {
        const sqlText = await sqlRes.text();
        setSeedSql(sqlText);
      }
    } catch (err) {
      console.error('Error fetching admin telemetry:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchAdminData();
      const interval = setInterval(fetchAdminData, 5000);
      return () => clearInterval(interval);
    }
  }, [isAdminAuthenticated]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      setAuthError('Please enter both username/email and password.');
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminUsername.trim(),
          password: adminPassword,
          deviceName: 'Admin Operations Console'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid admin credentials');
      }

      if (data.token) {
        localStorage.setItem('instasend_token', data.token);
      }
      onLogin(data.user);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      setAddUserError('Name, email/username, and password are required.');
      return;
    }

    try {
      setAddUserError(null);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
          plan: newUserPlan
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create user');
      }

      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      fetchAdminData();
    } catch (err: any) {
      setAddUserError(err.message || 'Error creating user');
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user account "${email}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(seedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // 1. Unauthenticated Admin View
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white border border-[#dadce0] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 google-card-shadow relative overflow-hidden">
          {/* Top 4-Color Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 flex">
            <div className="flex-1 bg-[#4285F4]" />
            <div className="flex-1 bg-[#EA4335]" />
            <div className="flex-1 bg-[#FBBC05]" />
            <div className="flex-1 bg-[#34A853]" />
          </div>

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-[#1a73e8] border border-blue-100 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-[#202124]">Admin Portal Authentication</h2>
            <p className="text-xs text-[#5f6368]">
              Sign in with administrative credentials to manage user accounts, system telemetry, and SQLite database.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#d93025]">
              {authError}
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">
                Admin Username or Email
              </label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-white border border-[#dadce0] rounded-xl px-3.5 py-2.5 text-xs text-[#202124] font-mono focus:outline-none focus:border-[#1a73e8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="1@3$5^7*9"
                className="w-full bg-white border border-[#dadce0] rounded-xl px-3.5 py-2.5 text-xs text-[#202124] font-mono focus:outline-none focus:border-[#1a73e8]"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In to Admin Console</span>
                </>
              )}
            </button>
          </form>

          {/* Preset hint */}
          <div className="p-3 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] text-xs space-y-1">
            <p className="font-semibold text-[#202124]">Default Administrator Credentials:</p>
            <p className="font-mono text-[11px] text-[#1a73e8]">Username: admin</p>
            <p className="font-mono text-[11px] text-[#1a73e8]">Password: 1@3$5^7*9</p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-[#5f6368] hover:text-[#202124] flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Application</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Authenticated Admin Dashboard
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-[#dadce0] google-card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1a73e8] border border-blue-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#202124]">InstaSend Administration Console</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fbbc05]/20 text-[#b06000] border border-[#fbbc05]/40 flex items-center gap-1">
                <Crown className="w-3 h-3 fill-current" /> ADMIN ROLE
              </span>
            </div>
            <p className="text-xs text-[#5f6368]">
              Logged in as <strong>{currentUser?.name || 'Administrator'}</strong> ({currentUser?.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            disabled={isLoadingStats}
            className="p-2.5 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs font-medium transition-colors cursor-pointer"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin text-[#1a73e8]' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Exit Console
          </button>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-full bg-[#f8f9fa] border border-[#dadce0] text-xs font-medium">
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'system'
                ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>System & Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lan')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'lan'
                ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Connected LAN Systems ({overview?.activePeersCount || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                : 'text-[#5f6368] hover:text-[#202124]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Seed File</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SYSTEM & TELEMETRY */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-2">
              <div className="flex items-center justify-between text-[#5f6368]">
                <span className="text-xs font-semibold">Active WebRTC Peers</span>
                <Radio className="w-4 h-4 text-[#34A853] animate-pulse" />
              </div>
              <p className="text-3xl font-bold font-mono text-[#202124]">
                {overview?.activePeersCount || 0}
              </p>
              <p className="text-[11px] text-[#70757a]">Connected signaling clients</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-2">
              <div className="flex items-center justify-between text-[#5f6368]">
                <span className="text-xs font-semibold">Active Transfer Rooms</span>
                <Activity className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <p className="text-3xl font-bold font-mono text-[#1a73e8]">
                {overview?.activeRoomsCount || 0}
              </p>
              <p className="text-[11px] text-[#70757a]">Open P2P DataChannels</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-2">
              <div className="flex items-center justify-between text-[#5f6368]">
                <span className="text-xs font-semibold">Registered Users</span>
                <Users className="w-4 h-4 text-[#EA4335]" />
              </div>
              <p className="text-3xl font-bold font-mono text-[#202124]">
                {overview?.sqlite?.userCount || usersList.length || 0}
              </p>
              <p className="text-[11px] text-[#70757a]">Stored in SQLite3 WAL</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-2">
              <div className="flex items-center justify-between text-[#5f6368]">
                <span className="text-xs font-semibold">Database File Size</span>
                <Database className="w-4 h-4 text-[#FBBC05]" />
              </div>
              <p className="text-2xl font-bold font-mono text-[#202124]">
                {overview?.sqlite?.fileSizeFormatted || '80.0 KB'}
              </p>
              <p className="text-[11px] text-[#70757a]">instasend.db (WAL Mode)</p>
            </div>
          </div>

          {/* SQLite & Server Runtime Specs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-4">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2 border-b border-[#dadce0] pb-3">
                <Database className="w-4 h-4 text-[#1a73e8]" />
                <span>SQLite Database Health & Storage</span>
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Database File:</span>
                  <span className="text-[#202124] font-semibold truncate max-w-[240px]">
                    {overview?.sqlite?.databaseFile || '/data/instasend.db'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Database Engine:</span>
                  <span className="text-[#34A853] font-bold">Node.js Native (node:sqlite)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Journal Mode:</span>
                  <span className="text-[#1a73e8] font-bold">WAL (Write-Ahead Logging)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Active User Accounts:</span>
                  <span className="text-[#202124] font-bold">{overview?.sqlite?.userCount || 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#5f6368]">Active Device Sessions:</span>
                  <span className="text-[#202124] font-bold">{overview?.sqlite?.activeSessionCount || 0}</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-[#dadce0] google-card-shadow space-y-4">
              <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2 border-b border-[#dadce0] pb-3">
                <Cpu className="w-4 h-4 text-[#EA4335]" />
                <span>Server Node.js Runtime & Memory</span>
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Node.js Runtime:</span>
                  <span className="text-[#202124] font-semibold">{overview?.nodeVersion || process.version}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Process Uptime:</span>
                  <span className="text-[#1a73e8] font-bold">{overview?.uptimeSeconds || 0} seconds</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Memory RSS:</span>
                  <span className="text-[#202124]">{overview?.memoryUsage?.rss || '45 MB'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f1f3f4]">
                  <span className="text-[#5f6368]">Heap Total:</span>
                  <span className="text-[#202124]">{overview?.memoryUsage?.heapTotal || '30 MB'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#5f6368]">Heap Used:</span>
                  <span className="text-[#34A853] font-bold">{overview?.memoryUsage?.heapUsed || '18 MB'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER ACCOUNTS MATRIX */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#202124]">Registered User Accounts</h3>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create User Account</span>
            </button>
          </div>

          <div className="bg-white border border-[#dadce0] rounded-3xl overflow-hidden google-card-shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fa] border-b border-[#dadce0] text-[#5f6368] font-semibold">
                    <th className="p-3.5">User / Avatar</th>
                    <th className="p-3.5">Email / Username</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Uploads</th>
                    <th className="p-3.5">Data Sent</th>
                    <th className="p-3.5">Data Received</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f3f4]">
                  {usersList.map((user) => (
                    <tr key={user.id} className="hover:bg-[#f8f9fa] transition-colors">
                      <td className="p-3.5 flex items-center gap-2.5 font-medium text-[#202124]">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-[#dadce0] shrink-0">
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        </div>
                        <span>{user.name}</span>
                      </td>
                      <td className="p-3.5 font-mono text-[#1a73e8]">{user.email}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.role === 'admin' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {user.role?.toUpperCase() || 'USER'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.plan === 'pro' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {user.plan?.toUpperCase() || 'FREE'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono">{user.totalUploads || 0}</td>
                      <td className="p-3.5 font-mono text-[#1a73e8]">{formatBytes(user.totalBytesSent || 0)}</td>
                      <td className="p-3.5 font-mono text-[#34A853]">{formatBytes(user.totalBytesReceived || 0)}</td>
                      <td className="p-3.5 text-right">
                        {user.email !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#d93025] hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAN & CONNECTED SYSTEMS */}
      {activeTab === 'lan' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#202124]">Active Mesh Peers & LAN Nodes</h3>
          
          <div className="bg-white border border-[#dadce0] rounded-3xl overflow-hidden google-card-shadow">
            {(!overview?.activePeers || overview.activePeers.length === 0) ? (
              <div className="p-8 text-center text-xs text-[#5f6368] space-y-2">
                <Radio className="w-6 h-6 text-[#1a73e8] animate-pulse mx-auto" />
                <p className="font-medium">No external peers currently connected to WebRTC signaling server.</p>
                <p className="text-[11px] text-[#70757a]">Open another browser tab or device to see local LAN peers populate live.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#dadce0] text-[#5f6368] font-semibold">
                      <th className="p-3.5">Peer ID</th>
                      <th className="p-3.5">Device Name</th>
                      <th className="p-3.5">Browser & OS</th>
                      <th className="p-3.5">Device Type</th>
                      <th className="p-3.5">Current Room</th>
                      <th className="p-3.5">Active Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f3f4]">
                    {overview.activePeers.map((peer: any) => (
                      <tr key={peer.id} className="hover:bg-[#f8f9fa] transition-colors font-mono">
                        <td className="p-3.5 font-bold text-[#1a73e8]">{peer.id}</td>
                        <td className="p-3.5 font-sans font-medium text-[#202124]">{peer.deviceInfo?.name}</td>
                        <td className="p-3.5">{peer.deviceInfo?.browser} ({peer.deviceInfo?.os})</td>
                        <td className="p-3.5 uppercase text-[10px] font-bold text-[#5f6368]">{peer.deviceInfo?.type}</td>
                        <td className="p-3.5 font-bold text-[#34A853]">{peer.roomCode || 'Radar Available'}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            peer.role === 'sender' 
                              ? 'bg-blue-50 text-blue-700' 
                              : peer.role === 'receiver' 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {peer.role?.toUpperCase() || 'RADAR DISCOVERY'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SQL SEED FILE & EXPORT */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#202124]">SQL Seed & Migration File</h3>
              <p className="text-xs text-[#5f6368]">
                Contains DDL table definitions and pre-encrypted scrypt credentials for <code className="text-[#1a73e8]">admin / 1@3$5^7*9</code>
              </p>
            </div>
            <button
              onClick={copySqlToClipboard}
              className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-[#f8f9fa] border border-[#dadce0] text-xs space-y-2">
            <p className="font-semibold text-[#202124] flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-[#1a73e8]" />
              How to Import via Command Line:
            </p>
            <pre className="bg-[#202124] text-[#81c995] p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
              sqlite3 data/instasend.db &lt; docs/admin_and_test_users.sql
            </pre>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-3xl bg-[#202124] text-[#e8eaed] text-xs font-mono max-h-96 overflow-y-auto border border-[#dadce0] leading-relaxed">
              {seedSql || '-- Loading SQL content...'}
            </pre>
          </div>
        </div>
      )}

      {/* CREATE NEW USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#dadce0] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <h3 className="text-base font-bold text-[#202124] border-b border-[#dadce0] pb-2">
              Create User Account (Admin)
            </h3>

            {addUserError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#d93025]">
                {addUserError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#202124] mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Test Engineer"
                  className="w-full bg-white border border-[#dadce0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#202124] mb-1">Email or Username</label>
                <input
                  type="text"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="tester@instasend.io"
                  className="w-full bg-white border border-[#dadce0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#202124] mb-1">Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-white border border-[#dadce0] rounded-xl px-3 py-2 text-xs text-[#202124] focus:outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#202124] mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e: any) => setNewUserRole(e.target.value)}
                    className="w-full bg-white border border-[#dadce0] rounded-xl p-2 text-xs text-[#202124]"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202124] mb-1">Plan</label>
                  <select
                    value={newUserPlan}
                    onChange={(e: any) => setNewUserPlan(e.target.value)}
                    className="w-full bg-white border border-[#dadce0] rounded-xl p-2 text-xs text-[#202124]"
                  >
                    <option value="pro">Pro (Unlimited)</option>
                    <option value="free">Free</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs shadow-xs cursor-pointer"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2.5 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
