import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'signin' | 'signup';

export function Auth() {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'signup') {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link.');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setMessage(null);
  };

  const handleOAuthSignIn = async () => {
    setOauthLoading('github');
    setError(null);
    await signInWithOAuth('github');
    // Note: OAuth redirects away, so we don't need to reset loading state
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-50">
      <div className="bg-white rounded-2xl p-10 w-full max-w-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="text-center mb-8">
          <div className="w-[60px] h-[60px] bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-[28px] font-bold text-white mx-auto mb-4">D</div>
          <h1 className="text-2xl text-[#1a1a2e] m-0 mb-2">Dopple Studio</h1>
          <p className="text-slate-500 m-0 text-sm">{mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <button
            type="button"
            className="flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-lg text-[15px] font-medium cursor-pointer transition-all duration-200 bg-white text-gray-700 hover:enabled:bg-gray-50 hover:enabled:border-[#24292e] hover:enabled:-translate-y-px hover:enabled:shadow-[0_2px_8px_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleOAuthSignIn}
            disabled={!!oauthLoading}
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            {oauthLoading === 'github' ? 'Loading...' : 'Continue with GitHub'}
          </button>
        </div>

        <div className="flex items-center my-6 text-center before:flex-1 before:border-b before:border-gray-200 after:flex-1 after:border-b after:border-gray-200">
          <span className="px-4 text-slate-500 text-sm bg-white">or</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="py-3 px-4 border border-gray-200 rounded-lg text-base transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              minLength={6}
              className="py-3 px-4 border border-gray-200 rounded-lg text-base transition-all duration-200 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
            />
          </div>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">{error}</div>}
          {message && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm text-center">{message}</div>}

          <button
            type="submit"
            className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white border-none py-3.5 rounded-lg text-base font-semibold cursor-pointer transition-all duration-200 hover:enabled:-translate-y-px hover:enabled:shadow-[0_4px_12px_rgba(99,102,241,0.4)] disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading || !!oauthLoading}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm m-0 mb-2">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={toggleMode}
              className="bg-transparent border-none text-indigo-500 font-semibold cursor-pointer p-0 text-sm hover:underline"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          <p className="text-xs text-gray-400 m-0 mt-3">
            Tip: After signing in, you can link additional accounts (e.g., GitHub) in Account Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
