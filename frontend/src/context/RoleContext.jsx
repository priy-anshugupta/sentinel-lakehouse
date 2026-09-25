import React, { createContext, useContext, useState } from 'react';

// Role definitions with access permissions
const ROLE_CONFIG = {
  BRANCH_MANAGER: {
    id: 'BRANCH_MANAGER',
    title: 'Branch Manager',
    subtitle: 'Executive Overview & Reports',
    description: 'Access to Command Center, Report Builder, and Glossary for non-technical banking staff.',
    icon: '🏛️',
    allowedRoutes: ['/', '/reports', '/glossary'],
    color: 'copper',
    defaultUser: {
      name: 'Priya Sharma',
      email: 'manager@sentinel-bank.internal',
      department: 'Retail Banking & Branch Operations',
      badge: 'Executive Tier'
    }
  },
  FRAUD_INVESTIGATOR: {
    id: 'FRAUD_INVESTIGATOR',
    title: 'Fraud Investigator',
    subtitle: 'Compliance & Root-Cause Analysis',
    description: 'Access to fraud detection dashboards, rule analysis, stream monitoring, and reporting.',
    icon: '🔍',
    allowedRoutes: ['/', '/stream', '/rules', '/reports', '/glossary'],
    color: 'signalBlue',
    defaultUser: {
      name: 'Alex Chen',
      email: 'investigator@sentinel-bank.internal',
      department: 'Financial Crime Compliance (AML/CFT)',
      badge: 'Investigator Tier'
    }
  },
  DATA_ENGINEER: {
    id: 'DATA_ENGINEER',
    title: 'Data Engineer / Admin',
    subtitle: 'Full System Access',
    description: 'Complete access to all dashboards including OLAP Studio, Warehouse Admin, and Ingest Lab.',
    icon: '⚙️',
    allowedRoutes: ['/', '/olap', '/stream', '/rules', '/warehouse', '/ingest', '/reports', '/glossary'],
    color: 'safe',
    defaultUser: {
      name: 'Vikram Verma',
      email: 'admin@sentinel-bank.internal',
      department: 'Core Lakehouse & Machine Learning',
      badge: 'Superuser / Admin'
    }
  }
};

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRole] = useState(null); // null means not logged in
  const [user, setUser] = useState(null);

  const login = (roleId, customUserData = null) => {
    if (ROLE_CONFIG[roleId]) {
      setRole(roleId);
      const defaultUser = ROLE_CONFIG[roleId].defaultUser;
      setUser(customUserData ? { ...defaultUser, ...customUserData, role: roleId } : { ...defaultUser, role: roleId });
    }
  };

  const signUp = ({ name, email, role: selectedRole, department }) => {
    const targetRole = selectedRole || 'BRANCH_MANAGER';
    if (ROLE_CONFIG[targetRole]) {
      setRole(targetRole);
      setUser({
        name: name || 'Demo Officer',
        email: email || 'demo@sentinel-bank.internal',
        department: department || 'General Operations',
        role: targetRole,
        badge: 'Newly Provisioned'
      });
    }
  };

  const logout = () => {
    setRole(null);
    setUser(null);
  };

  const isLoggedIn = role !== null;
  const currentRole = role ? ROLE_CONFIG[role] : null;

  const canAccess = (route) => {
    if (!currentRole) return false;
    return currentRole.allowedRoutes.includes(route);
  };

  return (
    <RoleContext.Provider value={{ 
      role, 
      user, 
      currentRole, 
      isLoggedIn, 
      login, 
      signUp, 
      logout, 
      canAccess, 
      ROLE_CONFIG 
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

export { ROLE_CONFIG };
export default RoleContext;
