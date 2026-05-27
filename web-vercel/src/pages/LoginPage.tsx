import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';

type Mode = 'signin' | 'signup';

const FIELD_STYLE: React.CSSProperties = {
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
};

function translateError(message: string): string {
  // Map a few common Supabase error strings to friendlier Chinese.
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不对';
  if (/user already registered/i.test(message)) return '这个邮箱已经注册过了，直接登录就行';
  if (/email not confirmed/i.test(message)) return '邮箱还没验证（请到 Supabase 后台关闭邮件验证或点确认邮件）';
  if (/password should be at least/i.test(message)) return '密码至少 6 位';
  if (/database error saving new user/i.test(message)) {
    return '注册失败（Supabase 默认邮件服务被限流或邮箱域被拒）。请到 Supabase → Authentication → Sign In / Up 关闭 Confirm email，或换用 GitHub 登录。';
  }
  return message;
}

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const nav = useNavigate();
  const { session } = useSession();

  // Once signed in, bounce back to wherever the user came from.
  useEffect(() => {
    if (session) nav(returnTo, { replace: true });
  }, [session, returnTo, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setErr(null);
    setInfo(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange in useSession will unmount this component.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // If email confirmation is enabled in Supabase, session is null and
        // a confirmation email was sent; otherwise the user is auto-signed-in.
        if (!data.session) {
          setInfo('已发送验证邮件，请到邮箱点确认链接；或到 Supabase 后台关闭 Confirm email 后重试。');
        }
      }
    } catch (e2) {
      setErr(translateError(e2 instanceof Error ? e2.message : String(e2)));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGitHub = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin + returnTo },
      });
      if (error) throw error;
      // Browser navigates away to GitHub OAuth; no further state needed.
    } catch (e) {
      setErr(translateError(e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  };

  return (
    <div className="museum" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div
        style={{
          width: 'min(420px, 92vw)',
          padding: '40px 36px',
          border: '1px solid var(--line)',
          background: 'linear-gradient(180deg, var(--bg-2), var(--bg-1))',
        }}
      >
        <div style={{ textAlign: 'center' }}>
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
              margin: '0 0 24px',
              letterSpacing: '0.06em',
              color: 'var(--ink)',
            }}
          >
            审美日课
          </h1>
        </div>

        {/* mode tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            justifyContent: 'center',
            marginBottom: 24,
            borderBottom: '1px solid var(--line)',
          }}
        >
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErr(null);
                setInfo(null);
              }}
              style={{
                background: 'transparent',
                border: 0,
                color: mode === m ? 'var(--gold)' : 'var(--ink-3)',
                fontFamily: 'var(--serif)',
                fontSize: 14,
                padding: '10px 24px',
                letterSpacing: '0.18em',
                cursor: 'pointer',
                borderBottom: mode === m ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {m === 'signin' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            style={FIELD_STYLE}
            autoComplete="email"
            autoFocus
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 6 位）"
            style={FIELD_STYLE}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={busy}
            style={busy ? { opacity: 0.5, cursor: 'wait' } : undefined}
          >
            {busy ? '正在处理…' : mode === 'signin' ? '登录' : '注册并进入'}
          </button>
        </form>

        {/* divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0 16px',
            color: 'var(--ink-4)',
            fontSize: 11,
            letterSpacing: '0.2em',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <button
          type="button"
          className="btn-ghost"
          onClick={signInWithGitHub}
          disabled={busy}
          style={{ width: '100%', padding: '12px 0' }}
        >
          用 GitHub 登录
        </button>

        {err && (
          <div
            style={{
              marginTop: 18,
              color: '#c97a55',
              fontSize: 12.5,
              fontFamily: 'var(--serif)',
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            {err}
          </div>
        )}
        {info && (
          <div
            style={{
              marginTop: 18,
              color: 'var(--gold)',
              fontSize: 12.5,
              fontFamily: 'var(--serif)',
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            {info}
          </div>
        )}
      </div>
    </div>
  );
}
