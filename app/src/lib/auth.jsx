import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, editor: null });

  const load = useCallback(async (session) => {
    if (!session) return setState({ loading: false, session: null, editor: null });
    const { data } = await supabase.from('editors').select('*').eq('user_id', session.user.id).maybeSingle();
    setState({ loading: false, session, editor: data || null });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setState({ loading: false, session: null, editor: null });
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') load(session);
      else if (event === 'TOKEN_REFRESHED') setState((s) => ({ ...s, session }));
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value = {
    ...state,
    isOwner: state.editor?.role === 'owner',
    reload: () => supabase.auth.getSession().then(({ data }) => load(data.session)),
    signOut: () => supabase.auth.signOut(),
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
