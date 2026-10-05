import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowRight, ChartColumnIncreasing, DatabaseZap, Eye, EyeOff, FileBarChart2, LockKeyhole, ShieldCheck } from 'lucide-react';
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
  return <div className="landing-page"><div className="login-layout" id="sign-in">
    <section className="login-story" aria-label="About Sentinel">
      <div className="story-image" />
      <div className="story-content">
        <div className="brand brand-light"><span className="brand-mark"><ShieldCheck size={23}/></span><span>SENTINEL</span></div>
        <div className="story-copy"><span className="eyebrow light">FRAUD INTELLIGENCE WORKSPACE</span>
          <h1>See the signal.<br/>Make the decision.</h1>
          <p>One place to review transaction risk, understand emerging patterns, and trace every figure to the warehouse.</p>
          <div className="story-points"><span>01 &nbsp; Monitor exposure</span><span>02 &nbsp; Investigate patterns</span><span>03 &nbsp; Report with confidence</span></div>
        </div>
        <div className="story-foot">SYNTHETIC PAYSIM DATASET <span>•</span> DEMONSTRATION ENVIRONMENT <a href="#how-it-works">Explore the workspace <ArrowDown size={13}/></a></div>
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
        <section className="login-role-guide" aria-label="Workspace roles"><strong>A workspace for every responsibility</strong><div><article><b>Branch manager</b><p>Risk summaries, transaction trends and review reports.</p></article><article><b>Fraud investigator</b><p>Transaction monitoring and changes in risk patterns.</p></article><article><b>Data engineer</b><p>Data quality, imports, warehouse and model training.</p></article></div></section><div className="demo-help"><strong>Explore the demo</strong><p>Use one of the assigned accounts in the README. Access is limited by role and sessions expire after eight hours.</p></div>
        <a href="#how-it-works" className="login-learn-link">How Sentinel works <ArrowDown size={15}/></a>
      </div>
      <div className="login-panel-foot">Sentinel analytics demo · Data is simulated and is not a bank production system.</div>
    </section>
  </div>
  <main className="landing-content" id="how-it-works">
    <section className="landing-intro"><span className="eyebrow">BUILT FOR CLEARER REVIEWS</span><h2>From transaction data to a decision you can explain.</h2><p>Sentinel turns a synthetic transaction stream into a dimensional warehouse, then lets a manager ask focused questions and inspect the figures behind the answer.</p></section>
    <div className="landing-feature-grid">
      <article className="landing-feature"><span className="landing-feature-icon"><DatabaseZap size={23}/></span><span className="landing-step">01 / INGEST</span><h3>Keep each transaction traceable</h3><p>Each ingested transaction becomes one fact row, joined to simulated time and transaction type dimensions.</p></article>
      <article className="landing-feature"><span className="landing-feature-icon"><ChartColumnIncreasing size={23}/></span><span className="landing-step">02 / ANALYZE</span><h3>Find the pattern behind the total</h3><p>Roll up by simulation month or week, then drill into smaller periods and slice by transaction type.</p></article>
      <article className="landing-feature"><span className="landing-feature-icon"><FileBarChart2 size={23}/></span><span className="landing-step">03 / REPORT</span><h3>Bring evidence to the review</h3><p>Type a supported business question, see how it was interpreted, inspect the SQL, and export the actual warehouse result.</p></article>
    </div>
    <section className="landing-showcase"><div className="landing-showcase-copy"><span className="eyebrow">A QUESTION YOU CAN ASK</span><h2>“Show cash-out fraud by week for the first month.”</h2><p>The report applies a cash-out slice, rolls up by simulation week, and returns transaction counts, confirmed fraud, and amount from DuckDB.</p><div className="landing-query-flow"><span>Business question</span><ArrowRight size={16}/><span>OLAP operation</span><ArrowRight size={16}/><span>Warehouse evidence</span></div><a href="#sign-in" className="landing-return">Sign in to explore <ArrowRight size={16}/></a></div><img src="/images/analyst-review.png" alt="Analyst reviewing transaction charts" loading="lazy"/></section>
    <p className="landing-disclaimer">This is a demonstration using synthetic PaySim data. Simulation steps represent hours, not calendar dates. Model flags are leads for review; confirmed fraud uses the dataset label.</p>
  </main>
  <footer className="landing-footer"><strong>SENTINEL</strong><span>Risk intelligence workspace · Synthetic data demonstration</span><a href="#sign-in">Back to sign in ↑</a></footer>
  </div>;
}
