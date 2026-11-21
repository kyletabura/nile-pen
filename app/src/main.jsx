import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ShieldAlert, KeyRound } from 'lucide-react';
import { AuthCard, MfaChallenge, PasswordForm } from './components/Security.jsx';
import './styles.css';
import { AuthProvider, StatsProvider, useAuth } from './lib/auth.jsx';
import { ToastProvider, ConfirmHost, Empty } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Stories from './pages/Stories.jsx';
import StoryEditor from './pages/StoryEditor.jsx';
import Pitches from './pages/Pitches.jsx';
import Messages from './pages/Messages.jsx';
import Subscribers from './pages/Subscribers.jsx';
import MediaPage from './pages/MediaPage.jsx';
import Topics from './pages/Topics.jsx';
import Team from './pages/Team.jsx';
import Settings from './pages/Settings.jsx';

function Gate() {
  const { loading, session, editor, signOut, needsMfa, recovery, reload, endRecovery } = useAuth();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><span className="brand-mark" aria-label="Loading">N</span></div>;
  if (!session) return <Login />;
  // an account with an authenticator app must enter its code before anything else (including a password reset)
  if (needsMfa) return <MfaChallenge onDone={() => reload()} onCancel={() => signOut()} />;
  if (recovery) return (
    <AuthCard icon={KeyRound} title="Choose a new password" foot={<button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => { endRecovery(); signOut(); }}>Cancel</button>}>
      <p className="muted" style={{ margin: 0 }}>Setting a new password for <b>{session.user.email}</b>.</p>
      <PasswordForm email={session.user.email} submitLabel="Save new password" onDone={() => endRecovery()} />
    </AuthCard>
  );
  if (editor?.must_change_password) return (
    <AuthCard icon={KeyRound} title="Set your own password" foot={<button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => signOut()}>Sign out</button>}>
      <p className="muted" style={{ margin: 0 }}>Welcome{editor.name ? ', ' + editor.name.split(' ')[0] : ''}. You signed in with a temporary password. Choose a private password only you know before you continue.</p>
      <PasswordForm email={session.user.email} submitLabel="Save and continue" onDone={() => reload()} />
    </AuthCard>
  );
  if (!editor) return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <div className="card" style={{ maxWidth: 440 }}>
        <Empty icon={ShieldAlert} title="This account is not on the team" action={<button className="btn" onClick={() => signOut()}>Sign out</button>}>
          {session.user.email} can sign in but has not been added to the newsroom. Ask the site owner to add you on the Team page.
        </Empty>
      </div>
    </div>
  );
  return <StatsProvider><Layout /></StatsProvider>;
}

const router = createBrowserRouter([
  {
    path: '/', element: <Gate />, children: [
      { index: true, element: <Overview /> },
      { path: 'stories', element: <Stories /> },
      { path: 'stories/new', element: <StoryEditor key="new-story" /> },
      { path: 'stories/:id', element: <StoryEditor /> },
      { path: 'live', element: <Stories brief key="live" /> },
      { path: 'live/new', element: <StoryEditor brief key="new-live" /> },
      { path: 'live/:id', element: <StoryEditor brief /> },
      { path: 'pitches', element: <Pitches /> },
      { path: 'pitches/:id', element: <Pitches /> },
      { path: 'messages', element: <Messages /> },
      { path: 'messages/:id', element: <Messages /> },
      { path: 'subscribers', element: <Subscribers /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'topics', element: <Topics /> },
      { path: 'team', element: <Team /> },
      { path: 'settings', element: <Settings /> },
      { path: 'reset-password', element: <Navigate to="/" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
        <ConfirmHost />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
