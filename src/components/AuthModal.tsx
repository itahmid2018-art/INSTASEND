import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Mail, 
  X, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  LogOut, 
  Smartphone,
  Crown
} from 'lucide-react';
import { UserProfile } from '../types.ts';
import { formatBytes } from '../services/device.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout
}) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ status: string; engine: string } | null>(null);

  // Fetch SQLite database status on modal open
  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/db/status')
        .then(r => r.json())
        .then(data => {
          if (data?.sqlite) setDbStatus(data.sqlite);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password, 
          deviceName: navigator.userAgent.substring(0, 40) 
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please verify credentials.');
      }

      if (data.token) {
        localStorage.setItem('instasend_token', data.token);
      }
      onLogin(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim(), 
          password 
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not create account.');
      }

      if (data.token) {
        localStorage.setItem('instasend_token', data.token);
      }
      onLogin(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sign up failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alex.rivera@instasend.io',
          password: 'InstaSend2026!',
          deviceName: 'Demo Trusted Device'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Demo sign-in failed');
      }

      if (data.token) {
        localStorage.setItem('instasend_token', data.token);
      }
      onLogin(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#dadce0] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Google 4-Color Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#dadce0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-[#1a73e8] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202124]">
                {currentUser ? 'Your Account' : 'Sign In'}
              </h3>
              <p className="text-xs text-[#5f6368]">
                {currentUser ? 'Manage your transfers and device session' : 'Sign in to access advanced features'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentUser ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-[#dadce0]">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-[#1a73e8] m-auto" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#202124]">{currentUser.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1a73e8] border border-[#d2e3fc]">
                      {currentUser.plan.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-[#5f6368] mt-0.5">{currentUser.email}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
                <p className="text-xs text-[#5f6368]">Files</p>
                <p className="text-base font-bold text-[#202124] mt-1">{currentUser.totalUploads}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
                <p className="text-xs text-[#5f6368]">Total Sent</p>
                <p className="text-xs font-mono font-bold text-[#1a73e8] mt-1">{formatBytes(currentUser.totalBytesSent)}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0]">
                <p className="text-xs text-[#5f6368]">Total Received</p>
                <p className="text-xs font-mono font-bold text-[#34A853] mt-1">{formatBytes(currentUser.totalBytesReceived)}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#5f6368]">
                <Smartphone className="w-4 h-4 text-[#1a73e8]" />
                <span>Trusted Device Token</span>
              </div>
              <span className="font-mono text-[10px] text-[#70757a]">
                {currentUser.deviceToken.slice(0, 10)}... (Active)
              </span>
            </div>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-2.5 rounded-full bg-[#f8f9fa] hover:bg-red-50 text-[#d93025] border border-[#dadce0] font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of this Device</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex p-1 bg-[#f8f9fa] rounded-full border border-[#dadce0] text-xs font-medium">
              <button
                type="button"
                onClick={() => { setTab('signin'); setError(null); }}
                className={`flex-1 py-1.5 rounded-full transition-all ${
                  tab === 'signin'
                    ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                    : 'text-[#5f6368] hover:text-[#202124]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('signup'); setError(null); }}
                className={`flex-1 py-1.5 rounded-full transition-all ${
                  tab === 'signup'
                    ? 'bg-white text-[#1a73e8] shadow-xs font-semibold'
                    : 'text-[#5f6368] hover:text-[#202124]'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#d93025]">
                {error}
              </div>
            )}

            <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
              {tab === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#202124] mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#5f6368] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-white border border-[#dadce0] rounded-xl pl-9 pr-3 py-2 text-xs text-[#202124] placeholder-[#70757a] focus:outline-none focus:border-[#1a73e8]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#202124] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5f6368] absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-white border border-[#dadce0] rounded-xl pl-9 pr-3 py-2 text-xs text-[#202124] placeholder-[#70757a] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#202124] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5f6368] absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-[#dadce0] rounded-xl pl-9 pr-3 py-2 text-xs text-[#202124] placeholder-[#70757a] focus:outline-none focus:border-[#1a73e8]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember-device"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="rounded border-[#dadce0] text-[#1a73e8] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="remember-device" className="text-xs text-[#5f6368] cursor-pointer select-none">
                  Trust this device (keep logged in)
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{tab === 'signin' ? 'Sign In' : 'Create Account'}</span>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-[#dadce0]">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleDemoSignIn}
                className="w-full py-2 rounded-full bg-[#f8f9fa] hover:bg-[#f1f3f4] disabled:opacity-50 border border-[#dadce0] text-[#1a73e8] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick One-Click Demo Sign-In (Alex Rivera)</span>
              </button>
            </div>

            {/* SQLite Database Status Pill */}
            <div className="p-2.5 rounded-xl bg-[#f8f9fa] border border-[#dadce0] flex items-center justify-between text-[11px] text-[#5f6368]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
                <span className="font-medium text-[#202124]">SQLite Database</span>
              </div>
              <span className="font-mono text-[10px] text-[#1a73e8]">
                {dbStatus?.engine || 'SQLite3'} • scrypt secured
              </span>
            </div>

            <p className="text-[11px] text-[#70757a] text-center">
              InstaSend stores user credentials securely in server SQLite with scrypt hashing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
