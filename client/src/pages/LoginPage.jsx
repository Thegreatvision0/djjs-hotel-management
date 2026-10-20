import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Crown, ConciergeBell, Sparkles, UtensilsCrossed } from "lucide-react";
import { useAuth, ROLE_HOME } from "../context/AuthContext";
import { Button, Alert } from "../components/ui";
import Logo from "../components/Logo";

// Quick-login demo buttons are hidden; users sign in with their email and password.
// Set to true to show them again (e.g. for a local demo).
const SHOW_DEMO_ACCOUNTS = false;

const DEMO = [
  { email: "admin@djjshotel.com", password: "admin123", role: "Admin", icon: Crown },
  { email: "frontdesk@djjshotel.com", password: "frontdesk", role: "Front Desk", icon: ConciergeBell },
  { email: "housekeeping@djjshotel.com", password: "housekeep", role: "Housekeeping", icon: Sparkles },
  { email: "restaurant@djjshotel.com", password: "restaurant", role: "Restaurant", icon: UtensilsCrossed },
];

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e, creds) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(creds?.email || email, creds?.password || password);
      nav(ROLE_HOME[u.role], { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,168,76,.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(201,168,76,.12),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-12 2xl:p-16">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="font-display text-2xl font-semibold tracking-wide">DJJS Hotel</span>
          </div>
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-300">Property Management</p>
            <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.05] xl:text-5xl 2xl:text-6xl">Every stay, from arrival to farewell.</h1>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-300">Reservations, rooms, folios and housekeeping for Anand Bhawan, DSB and the Guest House — in one calm, shared workspace.</p>
          </div>
          <div className="flex gap-8 text-sm text-slate-400">
            <div><p className="font-display text-3xl text-white">3</p>properties</div>
            <div><p className="font-display text-3xl text-white">69</p>rooms</div>
            <div><p className="font-display text-3xl text-white">24/7</p>front desk</div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0 lg:py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size="md" />
            <span className="font-display text-2xl font-semibold text-ink-900">DJJS Hotel</span>
          </div>
          <h2 className="font-display text-[30px] font-semibold text-ink-900 sm:text-[34px]">Welcome back</h2>
          <p className="mt-1 text-[14px] text-slate-500">Sign in to continue to your workspace.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required autoFocus className="input h-11" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@djjshotel.com" />
            </div>
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <div className="relative">
                <input id="pw" type={show ? "text" : "password"} required className="input h-11 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in <ArrowRight className="h-4 w-4" /></Button>
          </form>

          {SHOW_DEMO_ACCOUNTS && <div className="mt-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Demo accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button key={d.email} type="button" disabled={loading} onClick={() => submit(null, d)}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5 text-left transition hover:border-gold-300 hover:bg-gold-50/40">
                  <d.icon className="h-4 w-4 text-gold-500" />
                  <span className="text-[13px] font-medium text-ink-900">{d.role}</span>
                </button>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
