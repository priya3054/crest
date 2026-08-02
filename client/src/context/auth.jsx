import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, clearToken, getToken, setAuthErrorHandler } from '../lib/api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // false until we've checked any saved token

  useEffect(() => {
    // Any 401 from the API (e.g. an expired token) logs the user out.
    setAuthErrorHandler(() => {
      clearToken();
      setUser(null);
    });

    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    // Validate the saved token by fetching the current user.
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const r = await api.login({ email, password });
    setToken(r.token);
    setUser(r.user);
  };
  const register = async (name, email, password) => {
    const r = await api.register({ name, email, password });
    setToken(r.token);
    setUser(r.user);
  };
  const logout = () => {
    clearToken();
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, ready, login, register, logout }}>{children}</AuthCtx.Provider>;
}
