import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useBranding } from "@/hooks/useBranding";
import { Zap } from "lucide-react";

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

  const hasLogo = branding.logo_light_url || branding.logo_url;

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${branding.login_bg_color}), hsl(214, 40%, 95%))` }}>
        {/* Decorative circles */}
        <div className="absolute -top-20 right-10 w-64 h-64 rounded-full opacity-20" style={{ background: "hsl(214, 40%, 82%)" }} />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-15" style={{ background: "hsl(214, 40%, 80%)" }} />
        <div className="absolute top-1/3 -left-10 w-48 h-48 rounded-full opacity-10" style={{ background: "hsl(214, 40%, 78%)" }} />

        <div className="relative z-10 text-center px-12 max-w-md">
          {hasLogo ? (
            <img src={branding.logo_light_url || branding.logo_url} alt={`${branding.platform_name} Logo`} className="max-w-[320px] mx-auto mb-8" />
          ) : (
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                <Zap className="w-8 h-8 text-primary-foreground" />
              </div>
              <span className="text-4xl font-bold" style={{ color: "hsl(215, 55%, 28%)" }}>
                {branding.platform_name}
              </span>
            </div>
          )}
          <p className="text-base leading-relaxed mb-8" style={{ color: "hsl(215, 30%, 45%)" }}>
            {branding.platform_description}
          </p>

          <div className="flex gap-4 justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl px-6 py-4 shadow-sm">
              <p className="text-2xl font-bold" style={{ color: "hsl(215, 55%, 28%)" }}>100%</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(215, 30%, 50%)" }}>Rastreabilidade</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl px-6 py-4 shadow-sm">
              <p className="text-2xl font-bold" style={{ color: "hsl(215, 55%, 28%)" }}>24/7</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(215, 30%, 50%)" }}>Disponível</p>
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
                className="w-full py-3 rounded-lg font-semibold text-sm text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                style={{ background: "hsl(215, 55%, 28%)" }}
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
                className="font-semibold hover:underline"
                style={{ color: "hsl(215, 55%, 28%)" }}
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
