import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, ChartColumnIncreasing, DatabaseZap, Eye, EyeOff, FileBarChart2, LockKeyhole, ShieldCheck, X, SearchCheck, GitBranch, Check } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import './LandingPage.css';
import './SignInDialog.css';

const roles = [
  { id: 'manager', title: 'Branch manager', description: 'See the bigger picture. Review exposure, track trends and bring clear reports to the next meeting.', short: 'Risk summaries & reports', icon: ChartColumnIncreasing, number: '01' },
  { id: 'investigator', title: 'Fraud investigator', description: 'Follow review leads, monitor transactions and understand what changed in the patterns.', short: 'Transaction & pattern review', icon: SearchCheck, number: '02' },
  { id: 'engineer', title: 'Data engineer', description: 'Trace every number to its source. Check data quality, explore the warehouse and train explainable models.', short: 'Warehouse & model training', icon: DatabaseZap, number: '03' },
];

export default function LoginPage() {
  const { login } = useRole();
  const navigate = useNavigate();
  const dialog = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [destination, setDestination] = useState('/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const openSignIn = () => { setMenuOpen(false); setDestination('/'); setError(''); dialog.current?.showModal(); };
  const openModels = () => { setDestination('/models'); setError(''); dialog.current?.showModal(); };
  const signIn = async (account, secret, key) => {
    if (busy) return;
    setError(''); setBusy(key);
    try { await login(account, secret); dialog.current?.close(); navigate(destination === '/models' && account.toLowerCase() === 'engineer@sentinel.demo' ? '/models' : '/', { replace: true }); }
    catch (err) { setError(err.response?.data?.detail || 'Could not sign in. Check the server and your credentials.'); }
    finally { setBusy(''); }
  };
  const submit = event => { event.preventDefault(); signIn(email, password, 'account'); };
  return <div className="sentinel-home">
    <a className="home-skip" href="#main-content">Skip to content</a><header className="home-header">
      <a className="home-brand" href="#"><span><ShieldCheck size={23}/></span>SENTINEL<small>RISK INTELLIGENCE</small></a>
      <nav aria-label="Main navigation" className={menuOpen ? 'is-open' : ''} onClick={()=>setMenuOpen(false)}><a href="#capabilities">Capabilities</a><a href="#how-it-works">How it works</a><a href="#workspaces">Workspaces</a></nav>
      <button className="home-menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20}/> : <span><i/><i/></span>}</button><button className="home-signin" onClick={openSignIn}>Sign in <ArrowUpRight size={16}/></button>
    </header>
    <main id="main-content">
      <section className="home-hero"><div className="home-hero-layout">
        <div className="home-hero-image"/>
        <div className="home-hero-content"><span className="home-kicker"><i/> TRANSACTION RISK INTELLIGENCE</span>
          <h1>See the signal.<br/>Make the <em>decision.</em></h1>
          <p>Understand the patterns behind your transactions. Explore risk, investigate change, and bring clear evidence to every review.</p>
          <div className="home-hero-actions"><button onClick={openSignIn}>Try a workspace <ArrowUpRight size={18}/></button><a href="#how-it-works">See how it works <ArrowDown size={16}/></a></div>
          <div className="home-hero-note"><ShieldCheck size={15}/> Synthetic data. Real analytical workflows.</div>
        </div>
        </div>
        <div className="home-hero-bottom"><span><i/> BUILT FOR EXPLORATION</span><span>3 workspaces <b> / </b> 5 OLAP operations <b> / </b> 3 mining methods</span><a href="#capabilities" aria-label="Explore capabilities"><ArrowDown size={19}/></a></div>
      </section>
      <div className="home-trust"><span>A CONNECTED ANALYTICAL WORKSPACE</span><b><DatabaseZap size={18}/> Dimensional warehouse</b><b><ChartColumnIncreasing size={18}/> Interactive OLAP</b><b><GitBranch size={18}/> Explainable mining</b><b><FileBarChart2 size={18}/> Evidence based reports</b></div>
      <section className="home-section" id="capabilities"><div className="home-section-heading"><div><span className="home-overline">FROM SIGNAL TO UNDERSTANDING</span><h2>One workspace.<br/>The context you need.</h2></div><p>Move from an overall view to the details that matter, with the data and context together in one workspace.</p></div>
        <div className="home-capabilities">{[
          [ChartColumnIncreasing, '01', 'See the bigger picture', 'Review transaction activity, known fraud labels and model flags. Compare simulated periods and spot where a closer look could help.', 'Risk overview & trends'],
          [SearchCheck, '02', 'Follow the changing pattern', 'Explore historical transactions and compare activity around recorded model changes. Keep review leads separate from confirmed dataset labels.', 'Transaction & pattern analysis'],
          [FileBarChart2, '03', 'Bring evidence to the table', 'Ask a supported business question, explore the result and export a focused report. Engineers can inspect the SQL behind the figures.', 'Scoped reports & exports'],
        ].map(([Icon, number, title, copy, foot])=><article key={number}><div className="home-feature-top"><Icon size={26}/><span>{number}</span></div><h3>{title}</h3><p>{copy}</p><span className="home-feature-foot">{foot} <ArrowUpRight size={16}/></span></article>)}</div>
      </section>
      <section className="home-process" id="how-it-works"><div className="home-process-photo"><img src="/images/analyst-review.png" alt="Analyst reviewing transaction charts" loading="lazy"/><span><ShieldCheck size={18}/> Follow the evidence, from source to report.</span></div><div className="home-process-copy"><span className="home-overline">ONE CONNECTED JOURNEY</span><h2>From raw records<br/>to a useful answer.</h2><p>Sentinel connects data preparation, exploration and mining so you can understand how each result was produced.</p><ol>{[['Organise the data','Validate synthetic transactions and load them into a dimensional warehouse.'],['Explore the detail','Summarise by time, filter transaction types or drill into a smaller period.'],['Understand the result','Inspect decision trees, behaviour groups and associations alongside the evidence.']].map(([t,p],i)=><li key={t}><span>0{i+1}</span><div><h3>{t}</h3><p>{p}</p></div></li>)}</ol><button className="home-text-button" onClick={openSignIn}>See it for yourself <ArrowUpRight size={17}/></button></div></section>
      <section className="home-section home-workspaces" id="workspaces"><div className="home-section-heading"><div><span className="home-overline">A VIEW FOR EVERY RESPONSIBILITY</span><h2>Your role.<br/>Your workspace.</h2></div><p>Try a demo workspace in one click. Each role opens the tools and information relevant to its work.</p></div><div className="home-role-grid">{roles.map(({id,title,description,icon:Icon,number})=><article key={id}><span className="home-role-number">WORKSPACE {number}</span><Icon size={27}/><h3>{title}</h3><p>{description}</p><button disabled={Boolean(busy)} onClick={()=>signIn(`${id}@sentinel.demo`, 'SentinelDemo!2026', id)}>{busy===id?'Opening workspaceÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦':`Try ${title.toLowerCase()}`} <ArrowUpRight size={17}/></button></article>)}</div>{error&&<p className="form-error" role="alert">{error}</p>}</section>
      <section className="home-final"><span className="home-overline">YOUR NEXT REVIEW STARTS HERE</span><h2>Make your next review<br/>an informed one.</h2><button onClick={openSignIn}>Open your workspace <ArrowUpRight size={19}/></button><p><Check size={14}/> Three demo roles <span> / </span> No external AI key required</p></section>
    </main>
    <footer className="home-footer"><a className="home-brand" href="#"><span><ShieldCheck size={20}/></span>SENTINEL</a><p>Educational analytics using synthetic PaySim data.<br/>Historical replay, not a live bank feed. Model flags require review.</p><a href="#how-it-works">How it works <ArrowUpRight size={15}/></a></footer>
    <dialog ref={dialog} className="home-login-dialog" aria-labelledby="signin-title" onClick={e=>{if(e.target===e.currentTarget&&!busy)e.currentTarget.close();}} onCancel={e=>{if(busy)e.preventDefault();}}>
      <div className="home-modal-inner"><button className="home-modal-close" aria-label="Close sign in" disabled={Boolean(busy)} onClick={()=>dialog.current.close()}><X size={21}/></button><div className="login-icon"><LockKeyhole size={23}/></div><span className="home-overline">WELCOME TO SENTINEL</span><h2 id="signin-title">Open your workspace.</h2><p>{destination === '/models' ? 'Choose Data engineer to explore decision trees, behaviour groups and association rules in Model lab.' : 'Choose a demo role for one-click access, or sign in with your account.'}</p>
        <div className="home-quick-roles">{roles.map(({id,title,short,icon:Icon})=><button key={id} disabled={Boolean(busy)} onClick={()=>signIn(`${id}@sentinel.demo`,'SentinelDemo!2026',id)}><Icon size={21}/><span><strong>{busy===id?'Signing inÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦':title}</strong><small>{short}</small></span><ArrowRight size={17}/></button>)}</div>
        <div className="home-form-divider"><span>or use your account</span></div><form onSubmit={submit} className="login-form"><label htmlFor="email">Work email</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@sentinel.demo"/><label htmlFor="password">Password</label><div className="password-field"><input id="password" type={visible?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{error&&<div className="form-error" role="alert">{error}</div>}<button className="primary-button login-submit" disabled={Boolean(busy)}>{busy==='account'?'Signing inÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦':'Sign in'}<ArrowRight size={17}/></button></form><p className="home-modal-foot">Demo access is limited by role. Sessions expire after eight hours.</p></div>
    </dialog>
  </div>;
}
