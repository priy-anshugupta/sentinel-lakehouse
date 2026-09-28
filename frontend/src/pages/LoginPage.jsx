import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRole } from '../context/RoleContext';

export default function LoginPage() {
  const { login } = useRole();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await login(email, password); navigate('/', { replace: true }); }
    catch (err) { setError(err.response?.data?.detail || 'Could not sign in. Check the server and your credentials.'); }
    finally { setBusy(false); }
  };
  return <div className="login-layout">
    <section className="login-story" aria-label="About Sentinel">
      <div className="story-image" />
      <div className="story-content">
        <div className="brand brand-light"><span className="brand-mark"><ShieldCheck size={23}/></span><span>SENTINEL</span></div>
        <div className="story-copy"><span className="eyebrow light">FRAUD INTELLIGENCE WORKSPACE</span>
          <h1>See the signal.<br/>Make the decision.</h1>
          <p>One place to review transaction risk, understand emerging patterns, and trace every figure to the warehouse.</p>
          <div className="story-points"><span>01 &nbsp; Monitor exposure</span><span>02 &nbsp; Investigate patterns</span><span>03 &nbsp; Report with confidence</span></div>
        </div>
        <div className="story-foot">SYNTHETIC PAYSIM DATASET <span>•</span> DEMONSTRATION ENVIRONMENT</div>
      </div>
    </section>
    <section className="login-panel">
      <div className="login-form-wrap"><div className="mobile-brand brand"><span className="brand-mark"><ShieldCheck size={22}/></span>SENTINEL</div>
        <div className="login-icon"><LockKeyhole size={23}/></div>
        <span className="eyebrow">SECURE WORKSPACE</span><h2>Welcome back</h2>
        <p className="muted">Sign in with your assigned demo account to open your workspace.</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@sentinel.demo" />
          <label htmlFor="password">Password</label><div className="password-field"><input id="password" type={visible?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight size={18}/></button>
        </form>
        <div className="demo-help"><strong>Explore the demo</strong><p>Use one of the assigned accounts in the README. Access is limited by role and sessions expire after eight hours.</p></div>
      </div>
      <div className="login-panel-foot">Sentinel analytics demo · Data is simulated and is not a bank production system.</div>
    </section>
  </div>;
}
