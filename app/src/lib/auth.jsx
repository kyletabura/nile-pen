import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const EMPTY = { loading: false, session: null, editor: null, needsMfa: false, recovery: false };

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ...EMPTY, loading: true });

  const load = useCallback(async (session, extra = {}) => {
    if (!session) return setState({ ...EMPTY, ...extra });
    const [{ data: editor }, { data: aal }] = await Promise.all([
      supabase.from('editors').select('*').eq('user_id', session.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    // needsMfa: the account has an authenticator but this session has not passed the code check yet
    const needsMfa = !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
    setState((s) => ({ ...EMPTY, session, editor: editor || null, needsMfa, recovery: extra.recovery ?? s.recovery }));
  }, []);

  useEffect(() => {
    const recovering = window.location.pathname === '/reset-password';
    supabase.auth.getSession().then(({ data }) => load(data.session, { recovery: recovering && !!data.session }));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // a real sign-in restarts the inactivity clock (see useIdleSignOut in Layout)
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'MFA_CHALLENGE_VERIFIED') {
        try { localStorage.setItem('np-last-active', String(Date.now())); } catch { /* ignore */ }
      }
      // run outside the callback: calling Supabase inside it can deadlock the auth client
      setTimeout(() => {
        if (event === 'SIGNED_OUT') setState(EMPTY);
        else if (event === 'PASSWORD_RECOVERY') load(session, { recovery: true });
        else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'MFA_CHALLENGE_VERIFIED') load(session);
        else if (event === 'TOKEN_REFRESHED') setState((s) => ({ ...s, session }));
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value = {
    ...state,
    isOwner: state.editor?.role === 'owner',
    reload: (extra) => supabase.auth.getSession().then(({ data }) => load(data.session, extra)),
    endRecovery: () => { window.history.replaceState(null, '', '/'); return supabase.auth.getSession().then(({ data }) => load(data.session, { recovery: false })); },
    signOut: (scope = 'local') => supabase.auth.signOut({ scope }),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/* Counts for the sidebar badges and overview, refreshed on demand. */
const StatsCtx = createContext(null);
export const useStats = () => useContext(StatsCtx);
export function StatsProvider({ children }) {
  const [stats, setStats] = useState(null);
  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('dashboard_stats');
    if (data) setStats(data);
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    const on = () => refresh();
    window.addEventListener('np:refresh', on);
    window.addEventListener('focus', on);
    return () => { clearInterval(t); window.removeEventListener('np:refresh', on); window.removeEventListener('focus', on); };
  }, [refresh]);
  return <StatsCtx.Provider value={{ stats, refresh }}>{children}</StatsCtx.Provider>;
}
export const bump = () => window.dispatchEvent(new Event('np:refresh'));
