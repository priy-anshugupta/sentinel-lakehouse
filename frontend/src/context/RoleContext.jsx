import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { setAccessToken } from '../lib/api';

const ROLE_CONFIG = {
  BRANCH_MANAGER: { title: 'Branch manager', workspace: 'Management workspace', description: 'Review exposure, understand trends and prepare reports.', allowedRoutes: ['/', '/reports', '/olap', '/rules', '/glossary'] },
  FRAUD_INVESTIGATOR: { title: 'Fraud investigator', workspace: 'Investigation workspace', description: 'Review flagged transactions and investigate changing patterns.', allowedRoutes: ['/', '/reports', '/olap', '/stream', '/rules', '/glossary'] },
  DATA_ENGINEER: { title: 'Data engineer', workspace: 'Data operations workspace', description: 'Maintain the data, check quality and train mining models.', allowedRoutes: ['/', '/reports', '/olap', '/stream', '/rules', '/models', '/dataset', '/warehouse', '/ingest', '/glossary'] },
};
const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const token = sessionStorage.getItem('sentinel_token');
    if (!token) { setChecking(false); return; }
    setAccessToken(token);
    api.get('/auth/me').then(({ data }) => setUser(data)).catch(() => {
      sessionStorage.removeItem('sentinel_token');
      setAccessToken(null);
    }).finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const expired = () => { sessionStorage.removeItem('sentinel_token'); setAccessToken(null); setUser(null); };
    window.addEventListener('sentinel:session-expired', expired);
    return () => window.removeEventListener('sentinel:session-expired', expired);
  }, []);
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('sentinel_token', data.access_token);
    setAccessToken(data.access_token);
    setUser(data.user);
  };
  const logout = () => {
    sessionStorage.removeItem('sentinel_token');
    setAccessToken(null);
    setUser(null);
  };
  const role = user?.role || null;
  const currentRole = role ? ROLE_CONFIG[role] : null;
  const canAccess = route => Boolean(currentRole?.allowedRoutes.includes(route));
  return <RoleContext.Provider value={{ role, user, currentRole, isLoggedIn: !!user, checking, login, logout, canAccess, ROLE_CONFIG }}>{children}</RoleContext.Provider>;
}
export const useRole = () => useContext(RoleContext);
export { ROLE_CONFIG };
