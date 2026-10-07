import { loginAction } from "./actions";
import "../admin.css";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main id="main" className="adm-login">
      <form action={loginAction} className="adm-login-card">
        <p className="adm-brand">Compadres Cigars Admin Portal</p>
        <h1>Sign in</h1>
        {error && <p className="adm-alert" role="alert">Those details did not work. Check your email and password.</p>}
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="adm-btn" type="submit">Sign in</button>
      </form>
    </main>
  );
}
