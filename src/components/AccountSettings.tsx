import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserIdentity } from '@supabase/supabase-js';
import './AccountSettings.css';

export function AccountSettings({ onClose }: { onClose: () => void }) {
  const { user, linkIdentity, getUserIdentities, unlinkIdentity } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const loadIdentities = async () => {
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
  };

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

  const getIdentityEmail = (provider: string) => {
    const identity = identities.find((id) => id.provider === provider);
    return identity?.identity_data?.email || identity?.identity_data?.user_name || 'N/A';
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
    <div className="account-settings-overlay" onClick={onClose}>
      <div className="account-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="account-settings-header">
          <h2>Account Settings</h2>
          <button className="account-settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="account-settings-content">
          {user && (
            <div className="account-info">
              <h3>Account Information</h3>
              <p>
                <strong>Email:</strong> {user.email || 'No email'}
              </p>
              <p>
                <strong>Account Created:</strong> {formatRelativeTime(user.created_at, true)}
              </p>
              <p>
                <strong>Last Signed In:</strong> {formatRelativeTime(user.last_sign_in_at, false)}
              </p>
            </div>
          )}

          <div className="linked-accounts">
            <h3>Linked Accounts</h3>
            {loading ? (
              <p>Loading identities...</p>
            ) : (
              <>
                <div className="identities-list">
                  {identities.map((identity) => (
                    <div key={identity.id} className="identity-item">
                      <div className="identity-info">
                        <span className="identity-provider">{getProviderDisplayName(identity.provider)}</span>
                        <span className="identity-email">
                          {identity.identity_data?.email || identity.identity_data?.user_name || 'N/A'}
                        </span>
                      </div>
                      {identities.length > 1 && (
                        <button
                          className="btn-unlink"
                          onClick={() => handleUnlinkIdentity(identity)}
                          disabled={identities.length <= 1}
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="link-accounts-section">
                  <h4>Link Additional Accounts</h4>
                  <p className="link-accounts-description">
                    Link your GitHub account to sign in with either email/password or GitHub. This is useful if you
                    signed up with a different email than your GitHub account.
                  </p>
                  <div className="link-buttons">
                    {!isLinked('github') && (
                      <button
                        className="btn-link btn-link-github"
                        onClick={() => handleLinkIdentity('github')}
                        disabled={!!linkingProvider}
                      >
                        {linkingProvider === 'github' ? 'Linking...' : 'Link GitHub Account'}
                      </button>
                    )}
                    {isLinked('github') && <p className="all-linked">GitHub account is linked.</p>}
                  </div>
                </div>
              </>
            )}
          </div>

          {error && <div className="account-settings-error">{error}</div>}
          {message && <div className="account-settings-message">{message}</div>}
        </div>
      </div>
    </div>
  );
}

