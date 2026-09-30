import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useBranding } from "@/hooks/useBranding";

const Auth = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate("/");
      }
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Conta criada! Verifique seu email para confirmar.");
      }
    }
    setLoading(false);
  };

  const activeLogo = branding.logo_light_url || branding.logo_url || "/css-logo.png";

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-background border-r border-border">
        <div className="relative z-10 text-center px-12 max-w-md">
          <img src={activeLogo} alt={`${branding.platform_name} Logo`} className="max-w-[280px] max-h-28 object-contain mx-auto mb-8" />
          <p className="text-base leading-relaxed mb-8 text-muted-foreground">
            {branding.platform_description}
          </p>

          <div className="flex gap-4 justify-center">
            <div className="bg-card rounded-xl border border-border px-6 py-4 shadow-sm">
              <p className="text-2xl font-bold text-primary">100%</p>
              <p className="text-xs mt-0.5 text-muted-foreground">Rastreabilidade</p>
            </div>
            <div className="bg-card rounded-xl border border-border px-6 py-4 shadow-sm">
              <p className="text-2xl font-bold text-primary">24/7</p>
              <p className="text-xs mt-0.5 text-muted-foreground">Disponível</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-start justify-center pt-16 lg:pt-24 px-6 bg-muted/30">
        <div className="w-full max-w-md space-y-5">
          {/* Login card */}
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {isLogin ? "Acesso ao Sistema" : "Criar Conta"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isLogin ? branding.login_text : "Preencha os dados para cadastro"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="w-full px-4 py-3 text-sm bg-background rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  E-mail Corporativo
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-sm bg-background rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
                  placeholder={branding.email_placeholder}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 text-sm bg-background rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-opacity disabled:opacity-50 hover:opacity-90"
              >
                {loading ? "Aguarde..." : "Entrar"}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                {branding.support_text}
              </p>
            </div>
          </div>

          {/* Toggle login/register */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccess("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                {isLogin ? "Cadastre-se" : "Faça login"}
              </button>
            </p>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center mt-4">
            {branding.login_footer}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
