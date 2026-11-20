import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
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
  const { loading, session, editor, signOut } = useAuth();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><span className="brand-mark" aria-label="Loading">N</span></div>;
  if (!session) return <Login />;
  if (!editor) return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <div className="card" style={{ maxWidth: 440 }}>
        <Empty icon={ShieldAlert} title="This account is not on the team" action={<button className="btn" onClick={signOut}>Sign out</button>}>
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
