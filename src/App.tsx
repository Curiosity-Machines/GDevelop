import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useActivities } from './hooks/useActivities';
import { Link } from 'react-router-dom';
import { Gallery, ProjectForm, AccountSettings } from './components';
import type { ActivityWithRelations, ActivityFormData } from './types';

type View = 'gallery' | 'create' | 'edit';

interface AppProps {
  initialView?: 'create' | 'edit';
}

function App({ initialView }: AppProps) {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const { signOut, hasSDKAccess } = useAuth();
  const { activities, loading: activitiesLoading, uploadProgress, addActivity, updateActivity, deleteActivity } = useActivities();
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  // Derive view and editing activity from route params
  const view: View = initialView || 'gallery';
  const editingActivity = useMemo(() => {
    if (initialView === 'edit' && editId) {
      return activities.find(a => a.id === editId) || null;
    }
    return null;
  }, [initialView, editId, activities]);

  // Redirect to gallery if edit activity not found after loading
  const shouldRedirect = initialView === 'edit' && editId && !activitiesLoading && activities.length > 0 && !editingActivity;
  if (shouldRedirect) {
    navigate('/', { replace: true });
  }

  const handleCreate = useCallback(() => {
    navigate('/create');
  }, [navigate]);

  const handleEdit = useCallback((activity: ActivityWithRelations) => {
    navigate(`/edit/${activity.id}`);
  }, [navigate]);

  const handleFormSubmit = async (data: ActivityFormData, bundleFile?: File) => {
    if (view === 'edit' && editingActivity) {
      const clearBundle = Boolean(editingActivity.bundlePath && !data.entryPoint && data.url);
      await updateActivity(editingActivity.id, data, bundleFile, clearBundle);
    } else {
      await addActivity(data, bundleFile);
    }
    navigate('/');
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleDelete = async (id: string) => {
    await deleteActivity(id);
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-10 py-[30px] bg-white border-b border-gray-200 max-md:px-5 max-md:py-4 max-md:flex-wrap max-md:gap-4">
        <div className="flex items-center gap-4 cursor-pointer" onClick={handleLogoClick}>
          <img src="/dopple_logo.webp" alt="Dopple" className="h-20 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          {view === 'gallery' && activities.length > 0 && (
            <button
              className="px-6 py-3 bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-[0.9375rem] font-medium border-none rounded-[10px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] max-md:w-full max-md:text-center"
              onClick={handleCreate}
            >
              + New Activity
            </button>
          )}
          {hasSDKAccess && (
            <Link
              to="/sdk"
              className="px-5 py-2.5 bg-transparent text-gray-600 text-sm border border-gray-200 rounded-lg no-underline transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300"
            >
              SDK
            </Link>
          )}
          <button
            className="px-5 py-2.5 bg-transparent text-gray-600 text-sm border border-gray-200 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300"
            onClick={() => setShowAccountSettings(true)}
          >
            Account
          </button>
          <button
            className="px-5 py-2.5 bg-transparent text-gray-600 text-sm border border-gray-200 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-300"
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 p-10 max-w-[1400px] mx-auto w-full box-border max-md:p-5">
        {activitiesLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-gray-400">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin-slow"></div>
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
            uploadProgress={uploadProgress}
          />
        )}
      </main>

      <footer className="px-10 py-6 text-center border-t border-[#2a2a4a]">
        <p className="m-0 text-[#4a4a6a] text-sm">Dopple Studio - Create and manage your activity configurations</p>
      </footer>

      {showAccountSettings && <AccountSettings onClose={() => setShowAccountSettings(false)} />}
    </div>
  );
}

export default App;
