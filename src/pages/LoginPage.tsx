import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) {
      setStatus('error');
      setError(err.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div
      className="museum"
      style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}
    >
      <div
        style={{
          width: 'min(420px, 92vw)',
          padding: '40px 36px',
          border: '1px solid var(--line)',
          background: 'linear-gradient(180deg, var(--bg-2), var(--bg-1))',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            color: 'var(--gold)',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          Entrance · 入口
        </div>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 300,
            fontSize: 32,
            margin: '0 0 6px',
            letterSpacing: '0.06em',
            color: 'var(--ink)',
          }}
        >
          审美日课
        </h1>
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 13,
            color: 'var(--ink-3)',
            letterSpacing: '0.08em',
            margin: '0 0 32px',
          }}
        >
          留下你的邮箱，我们会发一条登录链接。
        </p>

        {status === 'sent' ? (
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 14,
              color: 'var(--ink-2)',
              lineHeight: 1.8,
            }}
          >
            链接已发至 <span style={{ color: 'var(--gold)' }}>{email}</span>。
            <br />
            在邮箱里点一下就能进入展厅。
          </div>
        ) : (
          <form
            onSubmit={submit}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                background: 'transparent',
                border: 0,
                borderBottom: '1px solid var(--line-strong)',
                color: 'var(--ink)',
                padding: '12px 0',
                fontFamily: 'var(--serif)',
                fontSize: 16,
                letterSpacing: '0.04em',
                outline: 'none',
                textAlign: 'center',
              }}
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={status === 'sending'}
              style={status === 'sending' ? { opacity: 0.5, cursor: 'wait' } : undefined}
            >
              {status === 'sending' ? '正在发送…' : '发送登录链接'}
            </button>
            {error && (
              <div style={{ color: '#c97a55', fontSize: 12, fontFamily: 'var(--serif)' }}>
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
