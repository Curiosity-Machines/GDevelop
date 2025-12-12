import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useActivities } from './hooks/useActivities';
import { Gallery, ProjectForm, Auth, ManifestPage } from './components';
import type { ActivityWithRelations, ActivityFormData } from './types';
import './App.css';

type View = 'gallery' | 'create' | 'edit' | 'manifest';

// Simple URL-based routing
function useRoute(): { view: View; activityId: string | null } {
  const [route, setRoute] = useState<{ view: View; activityId: string | null }>({
    view: 'gallery',
    activityId: null,
  });

  useEffect(() => {
    function parseRoute() {
      const path = window.location.pathname;

      // Check for manifest route: /manifest/:id
      const manifestMatch = path.match(/^\/manifest\/([a-zA-Z0-9-]+)/);
      if (manifestMatch) {
        return { view: 'manifest' as View, activityId: manifestMatch[1] };
      }

      return { view: 'gallery' as View, activityId: null };
    }

    setRoute(parseRoute());

    // Listen for popstate (back/forward navigation)
    const handlePopState = () => {
      setRoute(parseRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return route;
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { activities, loading: activitiesLoading, addActivity, updateActivity, deleteActivity } = useActivities();
  const route = useRoute();
  const [view, setView] = useState<View>('gallery');
  const [editingActivity, setEditingActivity] = useState<ActivityWithRelations | null>(null);

  // If URL is a manifest route, show manifest page (no auth required)
  if (route.view === 'manifest' && route.activityId) {
    return <ManifestPage projectId={route.activityId} />;
  }

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleCreate = () => {
    setEditingActivity(null);
    setView('create');
  };

  const handleEdit = (activity: ActivityWithRelations) => {
    setEditingActivity(activity);
    setView('edit');
  };

  const handleFormSubmit = async (data: ActivityFormData) => {
    if (view === 'edit' && editingActivity) {
      await updateActivity(editingActivity.id, data);
    } else {
      await addActivity(data);
    }
    setView('gallery');
    setEditingActivity(null);
  };

  const handleCancel = () => {
    setView('gallery');
    setEditingActivity(null);
  };

  const handleDelete = async (id: string) => {
    await deleteActivity(id);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-section" onClick={() => setView('gallery')}>
          <img src="/dopple_logo.webp" alt="Dopple" className="logo" />
        </div>
        <div className="header-actions">
          {view === 'gallery' && activities.length > 0 && (
            <button className="btn-header-create" onClick={handleCreate}>
              + New Activity
            </button>
          )}
          <button className="btn-sign-out" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="app-main">
        {activitiesLoading ? (
          <div className="projects-loading">
            <div className="loading-spinner"></div>
            <p>Loading activities...</p>
          </div>
        ) : view === 'gallery' ? (
          <Gallery
            projects={activities}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateNew={handleCreate}
          />
        ) : (
          <ProjectForm
            project={editingActivity || undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Dopple Studio - Create and manage your activity configurations</p>
      </footer>
    </div>
  );
}

export default App;
