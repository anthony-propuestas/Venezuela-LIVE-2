import React, { useState, useEffect, useCallback } from 'react';

const SESSION_KEY = 'adminToken';

async function apiFetch(path, token, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ─── Login ───────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { ok, data } = await apiFetch('/api/admin/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!ok || !data.token) {
        setError(data.error || 'Credenciales incorrectas.');
        return;
      }
      onLogin(data.token);
    } catch {
      setError('Error de red. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-extrabold text-slate-100 mb-1 text-center">
          Panel <span className="text-red-500">Admin</span>
        </h1>
        <p className="text-slate-500 text-sm text-center mb-8">Venezuela LIVE</p>
        <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none text-sm"
              placeholder="admin@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none text-sm"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition"
          >
            {loading ? 'Verificando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(null);
  const [feedback, setFeedback] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/api/admin/users', token);
    if (ok) setUsers(data.users || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const resetLimits = async (userId) => {
    setResetting(userId);
    const { ok } = await apiFetch(`/api/admin/users/${userId}/ratelimits`, token, { method: 'DELETE' });
    setFeedback((prev) => ({ ...prev, [userId]: ok ? 'Reseteado' : 'Error' }));
    setTimeout(() => setFeedback((prev) => { const n = { ...prev }; delete n[userId]; return n; }), 2500);
    setResetting(null);
  };

  if (loading) return <p className="text-slate-500 text-sm py-8 text-center">Cargando...</p>;
  if (!users.length) return <p className="text-slate-500 text-sm py-8 text-center">No hay usuarios.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/60">
            <th className="pb-2 pr-4">Correo</th>
            <th className="pb-2 pr-4">Username</th>
            <th className="pb-2 pr-4">Rol</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {users.map((u) => (
            <tr key={u.user_id} className="text-slate-300">
              <td className="py-2.5 pr-4 text-xs">{u.email || '—'}</td>
              <td className="py-2.5 pr-4 text-xs text-slate-400">{u.username || '—'}</td>
              <td className="py-2.5 pr-4">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                  u.role === 'admin' ? 'bg-red-900/40 text-red-400' :
                  u.role === 'moderator' ? 'bg-amber-900/40 text-amber-400' :
                  'bg-slate-700/60 text-slate-400'
                }`}>{u.role}</span>
              </td>
              <td className="py-2.5 text-right">
                {feedback[u.user_id] ? (
                  <span className="text-xs text-emerald-400 font-semibold">{feedback[u.user_id]}</span>
                ) : (
                  <button
                    onClick={() => resetLimits(u.user_id)}
                    disabled={resetting === u.user_id}
                    className="text-xs px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700/40 text-cyan-400 rounded-lg transition disabled:opacity-50"
                  >
                    {resetting === u.user_id ? '...' : 'Reset límites'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopicsTab({ token }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/api/admin/topics', token);
    if (ok) setTopics(data.topics || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const deleteTopic = async (id) => {
    if (!confirm('¿Eliminar este tema y todas sus propuestas?')) return;
    setDeleting(id);
    const { ok } = await apiFetch(`/api/admin/topics/${id}`, token, { method: 'DELETE' });
    if (ok) setTopics((prev) => prev.filter((t) => t.id !== id));
    setDeleting(null);
  };

  if (loading) return <p className="text-slate-500 text-sm py-8 text-center">Cargando...</p>;
  if (!topics.length) return <p className="text-slate-500 text-sm py-8 text-center">No hay temas.</p>;

  return (
    <div className="space-y-2">
      {topics.map((t) => (
        <div key={t.id} className="flex items-start gap-3 bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-semibold truncate">{t.topic_text}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t.category} / {t.subcategory} · <span className="font-mono">{t.id}</span></p>
          </div>
          <button
            onClick={() => deleteTopic(t.id)}
            disabled={deleting === t.id}
            className="flex-shrink-0 text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 text-red-400 rounded-lg transition disabled:opacity-50"
          >
            {deleting === t.id ? '...' : 'Eliminar'}
          </button>
        </div>
      ))}
    </div>
  );
}

function ProposalsTab({ token }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiFetch('/api/admin/proposals', token);
    if (ok) setProposals(data.proposals || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const deleteProposal = async (id) => {
    if (!confirm('¿Eliminar esta propuesta y sus notas?')) return;
    setDeleting(id);
    const { ok } = await apiFetch(`/api/admin/proposals/${id}`, token, { method: 'DELETE' });
    if (ok) setProposals((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  };

  if (loading) return <p className="text-slate-500 text-sm py-8 text-center">Cargando...</p>;
  if (!proposals.length) return <p className="text-slate-500 text-sm py-8 text-center">No hay propuestas.</p>;

  return (
    <div className="space-y-2">
      {proposals.map((p) => (
        <div key={p.id} className="flex items-start gap-3 bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-semibold truncate">{p.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {p.author} · tema: <span className="font-mono">{p.topic_id}</span>
            </p>
          </div>
          <button
            onClick={() => deleteProposal(p.id)}
            disabled={deleting === p.id}
            className="flex-shrink-0 text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 text-red-400 rounded-lg transition disabled:opacity-50"
          >
            {deleting === p.id ? '...' : 'Eliminar'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'users', label: 'Usuarios' },
  { key: 'topics', label: 'Temas' },
  { key: 'proposals', label: 'Propuestas' },
];

function Dashboard({ token, onLogout }) {
  const [tab, setTab] = useState('users');

  return (
    <div className="min-h-screen bg-black text-slate-300">
      <header className="bg-slate-800/90 border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-slate-100">
            Panel <span className="text-red-500">Admin</span>
          </h1>
          <button
            onClick={onLogout}
            className="text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-400 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                tab === t.key
                  ? 'bg-red-700/80 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'users' && <UsersTab token={token} />}
        {tab === 'topics' && <TopicsTab token={token} />}
        {tab === 'proposals' && <ProposalsTab token={token} />}
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');

  const handleLogin = (t) => {
    sessionStorage.setItem(SESSION_KEY, t);
    setToken(t);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken('');
  };

  if (!token) return <LoginForm onLogin={handleLogin} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
