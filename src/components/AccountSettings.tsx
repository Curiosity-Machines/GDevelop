import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserIdentity } from '@supabase/supabase-js';

export function AccountSettings({ onClose }: { onClose: () => void }) {
  const { user, linkIdentity, getUserIdentities, unlinkIdentity } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  const loadIdentities = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { identities: userIdentities, error: err } = await getUserIdentities();
    if (err) {
      setError(err.message);
    } else {
      // Only show email and GitHub identities
      const filteredIdentities = userIdentities.filter(
        (id) => id.provider === 'email' || id.provider === 'github'
      );
      setIdentities(filteredIdentities);
    }
    setLoading(false);
  }, [getUserIdentities]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional data fetching on mount
    loadIdentities();

    // Check for OAuth redirect after linking
    const urlParams = new URLSearchParams(window.location.search);
    const provider = urlParams.get('provider');
    if (provider) {
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      // Reload identities after a short delay to allow Supabase to process
      setTimeout(() => {
        loadIdentities();
        setMessage(`Successfully linked ${provider} account!`);
      }, 1000);
    }
  }, [loadIdentities]);

  const handleLinkIdentity = async (provider: 'github') => {
    setLinkingProvider(provider);
    setError(null);
    setMessage(null);
    const { error: err } = await linkIdentity(provider);
    if (err) {
      setError(err.message);
      setLinkingProvider(null);
    } else {
      // OAuth redirect will happen, so we don't reset loading state
      setMessage(`Redirecting to ${provider}...`);
    }
  };

  const handleUnlinkIdentity = async (identity: UserIdentity) => {
    if (identities.length <= 1) {
      setError('You must have at least one linked identity. Cannot unlink the last identity.');
      return;
    }

    if (!confirm(`Are you sure you want to unlink your ${identity.provider} account?`)) {
      return;
    }

    setError(null);
    setMessage(null);
    const { error: err } = await unlinkIdentity(identity);
    if (err) {
      setError(err.message);
    } else {
      setMessage('Identity unlinked successfully.');
      await loadIdentities();
    }
  };

  const getProviderDisplayName = (provider: string) => {
    if (provider === 'email') {
      return 'Email/Password';
    }
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const isLinked = (provider: string) => {
    return identities.some((id) => id.provider === provider);
  };

  const formatRelativeTime = (dateString: string | undefined | null, isCreated: boolean = false) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      // For account creation, show days ago
      if (isCreated) {
        const diffInDays = Math.floor(diffInSeconds / 86400);
        if (diffInDays === 0) {
          return 'Today';
        } else if (diffInDays === 1) {
          return '1 day ago';
        } else if (diffInDays < 30) {
          return `${diffInDays} days ago`;
        } else if (diffInDays < 365) {
          const months = Math.floor(diffInDays / 30);
          return months === 1 ? '1 month ago' : `${months} months ago`;
        } else {
          const years = Math.floor(diffInDays / 365);
          return years === 1 ? '1 year ago' : `${years} years ago`;
        }
      }

      // For last sign in, show more granular relative time
      if (diffInSeconds < 60) {
        return 'a few seconds ago';
      } else if (diffInSeconds < 120) {
        return 'a minute ago';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
      } else if (diffInSeconds < 7200) {
        return 'an hour ago';
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
      } else if (diffInSeconds < 172800) {
        return 'a day ago';
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} days ago`;
      } else if (diffInSeconds < 1209600) {
        return 'a week ago';
      } else if (diffInSeconds < 2592000) {
        const weeks = Math.floor(diffInSeconds / 604800);
        return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`;
      } else if (diffInSeconds < 5184000) {
        return 'a month ago';
      } else if (diffInSeconds < 31536000) {
        const months = Math.floor(diffInSeconds / 2592000);
        return months === 1 ? 'a month ago' : `${months} months ago`;
      } else if (diffInSeconds < 63072000) {
        return 'a year ago';
      } else {
        const years = Math.floor(diffInSeconds / 31536000);
        return years === 1 ? 'a year ago' : `${years} years ago`;
      }
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[1000] p-5 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="m-0 text-2xl text-[#1a1a2e]">Account Settings</h2>
          <button
            className="flex items-center justify-center w-8 h-8 p-0 bg-transparent border-none text-[32px] text-slate-500 rounded cursor-pointer transition-all duration-200 hover:bg-gray-100 hover:text-[#1a1a2e]"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {user && (
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 className="m-0 mb-4 text-lg text-[#1a1a2e]">Account Information</h3>
              <p className="my-2 text-sm text-slate-500">
                <strong className="font-semibold text-gray-700">Email:</strong> {user.email || 'No email'}
              </p>
              <p className="my-2 text-sm text-slate-500">
                <strong className="font-semibold text-gray-700">Account Created:</strong> {formatRelativeTime(user.created_at, true)}
              </p>
              <p className="my-2 text-sm text-slate-500">
                <strong className="font-semibold text-gray-700">Last Signed In:</strong> {formatRelativeTime(user.last_sign_in_at, false)}
              </p>
            </div>
          )}

          <div>
            <h3 className="m-0 mb-4 text-lg text-[#1a1a2e]">Linked Accounts</h3>
            {loading ? (
              <p>Loading identities...</p>
            ) : (
              <>
                <div className="mb-8">
                  {identities.map((identity) => (
                    <div key={identity.id} className="flex justify-between items-center p-4 mb-3 bg-gray-50 rounded-lg">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-sm text-[#1a1a2e]">{getProviderDisplayName(identity.provider)}</span>
                        <span className="text-[13px] text-slate-500">
                          {identity.identity_data?.email || identity.identity_data?.user_name || 'N/A'}
                        </span>
                      </div>
                      {identities.length > 1 && (
                        <button
                          className="px-4 py-2 bg-red-500 text-white text-sm font-medium border-none rounded-md cursor-pointer transition-all duration-200 hover:enabled:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleUnlinkIdentity(identity)}
                          disabled={identities.length <= 1}
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h4 className="m-0 mb-2 text-base text-[#1a1a2e]">Link Additional Accounts</h4>
                  <p className="m-0 mb-4 text-sm text-slate-500 leading-relaxed">
                    Link your GitHub account to sign in with either email/password or GitHub. This is useful if you
                    signed up with a different email than your GitHub account.
                  </p>
                  <div className="flex flex-col gap-3">
                    {!isLinked('github') && (
                      <button
                        className="flex items-center justify-center gap-3 px-4 py-3 bg-white text-[#24292e] text-[15px] font-medium border border-gray-200 rounded-lg cursor-pointer transition-all duration-200 hover:enabled:bg-gray-50 hover:enabled:border-[#24292e] hover:enabled:-translate-y-px hover:enabled:shadow-[0_2px_8px_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => handleLinkIdentity('github')}
                        disabled={!!linkingProvider}
                      >
                        {linkingProvider === 'github' ? 'Linking...' : 'Link GitHub Account'}
                      </button>
                    )}
                    {isLinked('github') && (
                      <p className="text-sm text-center text-slate-500 p-4 bg-green-50 rounded-lg border border-green-200">
                        GitHub account is linked.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

