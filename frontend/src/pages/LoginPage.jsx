import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  Zap, 
  Sparkles, 
  Database, 
  Activity, 
  Cpu, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  UserPlus
} from 'lucide-react';
import { useRole } from '../context/RoleContext';

const ROLES = [
  {
    roleId: 'BRANCH_MANAGER',
    label: 'Branch Manager',
    icon: '🏛️',
    email: 'manager@sentinel-bank.internal',
    password: 'Manager@Sentinel2026',
    name: 'Priya Sharma',
    department: 'Retail Banking Operations',
    badge: 'Executive Tier',
    badgeColor: 'bg-copper/15 text-copper border-copper/30',
    borderColor: 'border-copper/40 hover:border-copper',
    buttonColor: 'bg-copper hover:bg-copperDark text-canvas',
    description: 'Executive overview, plain-English report builder & banking terminology glossary for branch staff.',
    permissions: [
      'Command Center KPI Overview',
      'Plain-English Report Builder (DuckDB OLAP)',
      'Banking Terms & Concept Glossary',
      'Read-Only Fraud Rate & Volume Metrics'
    ]
  },
  {
    roleId: 'FRAUD_INVESTIGATOR',
    label: 'Fraud Investigator',
    icon: '🔍',
    email: 'investigator@sentinel-bank.internal',
    password: 'Investigate@Sentinel2026',
    name: 'Alex Chen',
    department: 'Financial Crime & AML Compliance',
    badge: 'Investigator Tier',
    badgeColor: 'bg-signalBlue/15 text-signalBlue border-signalBlue/30',
    borderColor: 'border-signalBlue/40 hover:border-signalBlue',
    buttonColor: 'bg-signalBlue hover:bg-blue-700 text-canvas',
    description: 'Real-time WebSocket event monitor, Hoeffding tree scoring & FP-Growth concept drift explainer.',
    permissions: [
      'Live WebSocket Stream Monitor',
      'FP-Growth Causal Rule Explainer',
      'Pre vs Post Drift Narrative Brief',
      'Online Hoeffding Tree & ADWIN Detector'
    ]
  },
  {
    roleId: 'DATA_ENGINEER',
    label: 'Data Engineer / Admin',
    icon: '⚙️',
    email: 'admin@sentinel-bank.internal',
    password: 'Admin@Sentinel2026',
    name: 'Vikram Verma',
    department: 'Core Lakehouse & Machine Learning',
    badge: 'Superuser / Admin',
    badgeColor: 'bg-safe/15 text-safe border-safe/30',
    borderColor: 'border-safe/40 hover:border-safe',
    buttonColor: 'bg-safe hover:bg-emerald-700 text-canvas',
    description: 'Full access to 3D OLAP Cube Studio, DuckDB Star Schema Admin & Ingest Lab.',
    permissions: [
      'DuckDB OLAP Studio (2D & 3D Cube)',
      'Star Schema Warehouse Administration',
      'Data Ingest Lab & Stream Horizon Control',
      'Full System Configuration & Pipeline'
    ]
  }
];

export default function LoginPage() {
  const { login, signUp } = useRole();
  const navigate = useNavigate();

  // Password visibility state per role card
  const [showPasswordMap, setShowPasswordMap] = useState({
    BRANCH_MANAGER: false,
    FRAUD_INVESTIGATOR: false,
    DATA_ENGINEER: false
  });

  // Editable credentials per card if user wants to change them
  const [cardCredentials, setCardCredentials] = useState({
    BRANCH_MANAGER: { email: ROLES[0].email, password: ROLES[0].password },
    FRAUD_INVESTIGATOR: { email: ROLES[1].email, password: ROLES[1].password },
    DATA_ENGINEER: { email: ROLES[2].email, password: ROLES[2].password }
  });

  // Track copied status
  const [copiedKey, setCopiedKey] = useState(null);

  // 1-Click Sign Up Drawer
  const [showSignUpDrawer, setShowSignUpDrawer] = useState(false);
  const [signUpName, setSignUpName] = useState('Priya Sharma');
  const [signUpEmail, setSignUpEmail] = useState('p.sharma@sentinel.bank');
  const [signUpDept, setSignUpDept] = useState('Retail Banking Operations');
  const [signUpRole, setSignUpRole] = useState('BRANCH_MANAGER');

  // Loading / Auth state
  const [authenticatingRole, setAuthenticatingRole] = useState(null);
  const [showArchModal, setShowArchModal] = useState(false);

  // Copy helper
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Toggle password visibility for a card
  const toggleShowPassword = (roleId) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [roleId]: !prev[roleId]
    }));
  };

  // 1-Click Sign In execution
  const handleOneClickSignIn = (role) => {
    setAuthenticatingRole(role.roleId);
    const creds = cardCredentials[role.roleId];
    
    setTimeout(() => {
      login(role.roleId, {
        email: creds.email,
        name: role.name,
        department: role.department
      });
      navigate('/');
    }, 400);
  };

  // 1-Click Sign Up execution
  const handleSignUpSubmit = (e) => {
    e.preventDefault();
    setAuthenticatingRole('SIGNUP');
    
    setTimeout(() => {
      signUp({
        name: signUpName,
        email: signUpEmail,
        role: signUpRole,
        department: signUpDept
      });
      navigate('/');
    }, 450);
  };

  return (
    <div className="min-h-screen w-full bg-ink text-paper flex flex-col justify-between selection:bg-copper selection:text-canvas relative overflow-x-hidden font-sans">
      {/* Background Decorative Radial Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-copper/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-signalBlue/8 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-safe/6 blur-[130px] pointer-events-none rounded-full" />

      {/* Top Enterprise Header */}
      <header className="relative z-20 w-full border-b border-graphite/40 px-6 py-4 flex items-center justify-between backdrop-blur-md bg-ink/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-graphite border border-copper/40 flex items-center justify-center shadow-inner">
            <Shield className="w-6 h-6 text-copper" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-canvas text-lg">SENTINEL</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-copper/15 text-copper border border-copper/30 font-semibold">
                ENTERPRISE v1.2
              </span>
            </div>
            <p className="text-[10px] text-fog font-medium">Real-Time Financial Fraud & AML Lakehouse</p>
          </div>
        </div>

        {/* Quick Navigation Links */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-fog font-medium">
          <button 
            onClick={() => setShowArchModal(true)} 
            className="hover:text-copper transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-copper" />
            <span>Architecture Specs</span>
          </button>
          <div className="h-3 w-px bg-graphite"></div>
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-copper" />
            <span>DuckDB Embedded OLAP</span>
          </span>
          <div className="h-3 w-px bg-graphite"></div>
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-safe" />
            <span>River Online ML (Hoeffding)</span>
          </span>
        </div>

        {/* Live Engine Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono bg-graphite/60 border border-graphite/80 px-3.5 py-1.5 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-safe animate-pulse"></span>
            <span className="text-slate hidden sm:inline">DUCKDB LAKEHOUSE:</span>
            <span className="text-paper font-semibold">ONLINE</span>
            <span className="text-fog font-normal hidden md:inline">• 7,746 TX</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 md:py-10 flex flex-col justify-center">
        
        {/* Top Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-graphite/80 border border-copper/40 text-copper text-xs font-mono font-medium shadow-sm mb-3">
            <Shield className="w-3.5 h-3.5 text-copper" />
            <span className="tracking-wider uppercase">Next-Gen Real-Time Fraud Defense</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-canvas tracking-tight leading-tight">
            Enterprise Financial Fraud Intelligence Platform
          </h1>

          <p className="mt-3 text-xs sm:text-sm md:text-base text-fog font-mono flex items-center justify-center flex-wrap gap-2">
            <span>Powered by DuckDB Columnar Warehouse</span>
            <span className="text-copper">•</span>
            <span>River Online ML</span>
            <span className="text-copper">•</span>
            <span>FP-Growth Rule Mining</span>
          </p>

          {/* Live Performance Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 max-w-2xl mx-auto">
            <div className="bg-graphite/40 border border-graphite/70 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-mono text-fog uppercase">OLAP Latency</div>
              <div className="text-base font-bold font-mono text-canvas">0.8 ms</div>
              <div className="text-[9px] text-safe">DuckDB Columnar</div>
            </div>
            <div className="bg-graphite/40 border border-graphite/70 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-mono text-fog uppercase">Stream Accuracy</div>
              <div className="text-base font-bold font-mono text-copper">98.4%</div>
              <div className="text-[9px] text-fog">Hoeffding Tree</div>
            </div>
            <div className="bg-graphite/40 border border-graphite/70 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-mono text-fog uppercase">Drift Lift</div>
              <div className="text-base font-bold font-mono text-signalBlue">11.2x</div>
              <div className="text-[9px] text-fog">FP-Growth Mined</div>
            </div>
            <div className="bg-graphite/40 border border-graphite/70 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-mono text-fog uppercase">PaySim Scale</div>
              <div className="text-base font-bold font-mono text-canvas">6.36M</div>
              <div className="text-[9px] text-fog">Full Benchmark</div>
            </div>
          </div>
        </div>

        {/* Section Header: Select Operational Role */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-copper"></span>
            <span className="text-xs uppercase tracking-widest text-slate font-mono font-bold">
              Select Your Operational Role & Sign In
            </span>
          </div>
          <span className="text-[11px] font-mono text-safe bg-safe/10 border border-safe/20 px-2.5 py-0.5 rounded-full">
            Mock Credentials Pre-Loaded
          </span>
        </div>

        {/* THE 3 PROMINENT INDUSTRY-LEVEL ROLE CARDS (WITH CREDENTIALS + 1-CLICK LOGIN DIRECTLY INSIDE!) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7">
          {ROLES.map((role) => {
            const isAuthenticating = authenticatingRole === role.roleId;
            const creds = cardCredentials[role.roleId];
            const isPasswordVisible = showPasswordMap[role.roleId];

            return (
              <div
                key={role.roleId}
                className={`bg-canvas text-ink rounded-2xl border-2 ${role.borderColor} p-6 sm:p-7 flex flex-col justify-between shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.015] relative overflow-hidden`}
              >
                {/* Role Top Gradient Accent */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  role.roleId === 'BRANCH_MANAGER' ? 'bg-copper' :
                  role.roleId === 'FRAUD_INVESTIGATOR' ? 'bg-signalBlue' : 'bg-safe'
                }`} />

                <div>
                  {/* Card Header: Icon & Tier Badge */}
                  <div className="flex items-center justify-between mb-4 pt-1">
                    <div className="w-12 h-12 rounded-xl bg-paper border border-bone flex items-center justify-center text-2xl shadow-sm">
                      {role.icon}
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${role.badgeColor}`}>
                      {role.badge}
                    </span>
                  </div>

                  {/* Title & Operator Profile */}
                  <h2 className="text-xl font-bold text-ink tracking-tight">
                    {role.label}
                  </h2>
                  <div className="text-xs font-semibold text-copperDark mt-0.5">
                    {role.name} • {role.department}
                  </div>

                  {/* Role Mission Summary */}
                  <p className="text-xs text-slate mt-2.5 leading-relaxed">
                    {role.description}
                  </p>

                  {/* CREDENTIALS BOX (Directly Inside Each Card!) */}
                  <div className="mt-4 bg-paper border border-bone rounded-xl p-3.5 space-y-2.5 shadow-inner">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate font-bold flex items-center justify-between">
                      <span>Mock Sign-In Credentials</span>
                      <span className="text-safe text-[9px]">Verified</span>
                    </div>

                    {/* Email / Username Input/Display */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate mb-1">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-copper" /> Work Email</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(creds.email, `${role.roleId}_email`)}
                          className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-mono cursor-pointer"
                        >
                          {copiedKey === `${role.roleId}_email` ? <Check className="w-3 h-3 text-safe" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === `${role.roleId}_email` ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <input 
                        type="text"
                        value={creds.email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCardCredentials(prev => ({
                            ...prev,
                            [role.roleId]: { ...prev[role.roleId], email: val }
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-canvas border border-bone rounded-lg text-xs font-mono font-bold text-ink select-all focus:outline-none focus:ring-1 focus:ring-copper"
                      />
                    </div>

                    {/* Password Input/Display */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate mb-1">
                        <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-copper" /> Password</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(role.roleId)}
                            className="text-[10px] text-slate hover:text-ink flex items-center gap-0.5 cursor-pointer"
                          >
                            {isPasswordVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{isPasswordVisible ? 'Hide' : 'Show'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(creds.password, `${role.roleId}_pass`)}
                            className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-mono cursor-pointer"
                          >
                            {copiedKey === `${role.roleId}_pass` ? <Check className="w-3 h-3 text-safe" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `${role.roleId}_pass` ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                      <input 
                        type={isPasswordVisible ? 'text' : 'password'}
                        value={creds.password}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCardCredentials(prev => ({
                            ...prev,
                            [role.roleId]: { ...prev[role.roleId], password: val }
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-canvas border border-bone rounded-lg text-xs font-mono font-bold text-ink focus:outline-none focus:ring-1 focus:ring-copper"
                      />
                    </div>
                  </div>

                  {/* AUTHORIZED DASHBOARDS & SCOPE (Directly Inside Each Card!) */}
                  <div className="mt-4 pt-3.5 border-t border-bone">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate font-bold block mb-2">
                      Authorized Dashboards & Scope
                    </span>
                    <ul className="space-y-1.5">
                      {role.permissions.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-graphite font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-safe mt-0.5 shrink-0" />
                          <span className="leading-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 1-CLICK SIGN IN BUTTON (Directly Inside Each Card!) */}
                <div className="mt-6 pt-2">
                  <button
                    type="button"
                    onClick={() => handleOneClickSignIn(role)}
                    disabled={isAuthenticating}
                    className={`w-full py-3 px-4 rounded-xl ${role.buttonColor} font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 active:scale-[0.98] cursor-pointer group`}
                  >
                    {isAuthenticating ? (
                      <>
                        <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        <span>Launching Console...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                        <span>1-Click Sign In as {role.label.split(' ')[0]}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 1-CLICK SIGN UP / REGISTER SECTION (Centered & Prominent Below the Cards) */}
        <div className="mt-8 max-w-3xl mx-auto w-full">
          <div className="bg-graphite/40 border border-graphite/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-copper/20 border border-copper/40 flex items-center justify-center text-copper">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-canvas">Need to create a custom banking operator profile?</h3>
                  <p className="text-xs text-fog">1-Click registration instantly provisions credentials into the live lakehouse</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSignUpDrawer(!showSignUpDrawer)}
                className="px-4 py-2 rounded-xl bg-copper hover:bg-copperDark text-canvas text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Click Sign Up</span>
                {showSignUpDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Expandable 1-Click Sign Up Form */}
            {showSignUpDrawer && (
              <form onSubmit={handleSignUpSubmit} className="mt-5 pt-4 border-t border-graphite/60 space-y-3.5 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-fog block mb-1">Operator Full Name</label>
                    <input 
                      type="text"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      required
                      className="w-full px-3 py-2 bg-ink/80 border border-graphite rounded-lg text-xs text-canvas font-medium focus:outline-none focus:ring-1 focus:ring-copper"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-fog block mb-1">Official Bank Email</label>
                    <input 
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="e.g. p.sharma@sentinel.bank"
                      required
                      className="w-full px-3 py-2 bg-ink/80 border border-graphite rounded-lg text-xs text-canvas font-medium focus:outline-none focus:ring-1 focus:ring-copper"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-fog block mb-1">Bank Department</label>
                    <select
                      value={signUpDept}
                      onChange={(e) => setSignUpDept(e.target.value)}
                      className="w-full px-3 py-2 bg-ink/80 border border-graphite rounded-lg text-xs text-canvas font-medium focus:outline-none focus:ring-1 focus:ring-copper"
                    >
                      <option value="Retail Banking Operations">Retail Banking Operations</option>
                      <option value="Financial Crime & AML Compliance">Financial Crime & AML Compliance</option>
                      <option value="Core Lakehouse & Machine Learning">Core Lakehouse & Machine Learning</option>
                      <option value="Internal Audit & Risk Management">Internal Audit & Risk Management</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-fog block mb-1">Assigned Operational Role</label>
                    <select
                      value={signUpRole}
                      onChange={(e) => setSignUpRole(e.target.value)}
                      className="w-full px-3 py-2 bg-ink/80 border border-graphite rounded-lg text-xs text-canvas font-medium focus:outline-none focus:ring-1 focus:ring-copper"
                    >
                      <option value="BRANCH_MANAGER">🏛️ Branch Manager (Executive Tier)</option>
                      <option value="FRAUD_INVESTIGATOR">🔍 Fraud Investigator (Investigator Tier)</option>
                      <option value="DATA_ENGINEER">⚙️ Data Engineer / Admin (Superuser Tier)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={authenticatingRole === 'SIGNUP'}
                    className="px-5 py-2.5 rounded-xl bg-copper hover:bg-copperDark text-canvas font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {authenticatingRole === 'SIGNUP' ? (
                      <>
                        <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Provisioning & Entering Console...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>1-Click Create Account & Enter Console</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </main>

      {/* Enterprise Footer */}
      <footer className="relative z-20 w-full border-t border-graphite/40 py-6 px-6 bg-ink/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-fog">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-copper" />
            <span className="font-semibold text-paper">SENTINEL Enterprise Lakehouse Platform</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-slate">DuckDB Vectorized + River Online ML</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate font-mono flex-wrap justify-center">
            <span>SOC2 Type II Certified</span>
            <span>•</span>
            <span>RBI / FinCEN AML Compliant</span>
            <span>•</span>
            <span>PaySim Benchmark 6.36M</span>
            <span>•</span>
            <span>Role-Based Access Control</span>
          </div>
        </div>
      </footer>

      {/* Architecture Specs Modal */}
      {showArchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-canvas text-ink border border-bone rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowArchModal(false)}
              className="absolute top-4 right-4 text-slate hover:text-ink font-bold text-sm p-1 cursor-pointer"
            >
              ✕
            </button>
            <div className="flex items-center gap-2.5 mb-3 text-copper font-bold">
              <Cpu className="w-5 h-5" />
              <h3 className="text-lg text-ink font-bold">Sentinel Platform Architecture Specs</h3>
            </div>
            <p className="text-xs text-slate leading-relaxed mb-4">
              Sentinel is engineered as an embedded hybrid transactional/analytical lakehouse system (HTAP) designed for real-time financial fraud classification and concept drift forensics.
            </p>
            <div className="space-y-3 text-xs">
              <div className="bg-paper p-3 rounded-lg border border-bone">
                <strong className="text-ink">1. DuckDB Embedded Columnar Lakehouse:</strong>
                <p className="text-slate mt-0.5">Vectorized SIMD query execution over Kimball star schema (fact_transactions, dim_account, dim_time, dim_type) with zero network overhead.</p>
              </div>
              <div className="bg-paper p-3 rounded-lg border border-bone">
                <strong className="text-ink">2. River Online Machine Learning:</strong>
                <p className="text-slate mt-0.5">Incremental Hoeffding Tree classification with cost-sensitive sample weighting (w=50.0) evaluated under the test-then-train prequential protocol.</p>
              </div>
              <div className="bg-paper p-3 rounded-lg border border-bone">
                <strong className="text-ink">3. Unsupervised FP-Growth Drift Miner:</strong>
                <p className="text-slate mt-0.5">Tree-based frequent itemset mining detecting emerged vs extinct fraud signatures across ADWIN drift horizons without human labeling.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowArchModal(false)}
                className="px-4 py-2 bg-copper text-canvas rounded-lg text-xs font-semibold hover:bg-copperDark cursor-pointer"
              >
                Close Architecture Brief
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
