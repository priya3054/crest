import { useState } from 'react';
import { useAuth } from '../context/auth.jsx';
import { Logo } from '../components/Logo.jsx';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isSignup) await register(name, email, password);
      else await login(email, password);
      // on success AuthProvider flips user -> app renders
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setMode('login');
    setEmail('demo@crest.app');
    setPassword('demo123');
    setError('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <Logo />
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{isSignup ? 'Create your account' : 'Welcome back'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 5, marginBottom: 18 }}>
            {isSignup ? 'Start paper trading with ₹1,00,000 virtual funds.' : 'Sign in to your Crest account.'}
          </div>

          <form onSubmit={submit}>
            {isSignup && (
              <>
                <div className="label" style={{ marginBottom: 7 }}>NAME</div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={{ marginBottom: 12 }} autoFocus />
              </>
            )}

            <div className="label" style={{ marginBottom: 7 }}>EMAIL</div>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ marginBottom: 12 }} autoFocus={!isSignup} />

            <div className="label" style={{ marginBottom: 7 }}>PASSWORD</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignup ? 'At least 6 characters' : '••••••••'} style={{ marginBottom: error ? 12 : 18 }} />

            {error && <div className="error-panel" style={{ marginBottom: 16 }}>{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              className="link"
              style={{ background: 'none', border: 'none', padding: 0 }}
              onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); }}
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="link" style={{ background: 'none', border: 'none', fontSize: 12.5 }} onClick={fillDemo}>
            Use the demo account
          </button>
        </div>
      </div>
    </div>
  );
}
