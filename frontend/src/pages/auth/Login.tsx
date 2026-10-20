/**
 * Login
 * Page de connexion utilisateur. Déclenche la thunk Redux `login`.
 * - Stocke le token dans localStorage via le reducer
 * - Redirige vers / si déjà authentifié
 */
import { FormEvent, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { login } from "@/store/authSlice";
import { Link, Navigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const dispatch = useAppDispatch();
  const { token, loading } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      await dispatch(login({ email, password })).unwrap();
      toast.success("Connexion réussie");
    } catch (error: any) {
      const status = error?.status;
      if (status === 401) {
        toast.error("Email ou mot de passe incorrect");
      } else if (status === 403) {
        toast.error("Compte désactivé. Contactez l'administrateur.");
      } else if (status === 422) {
        toast.error("Données invalides. Veuillez vérifier les champs.");
      } else if (status >= 500) {
        toast.error("Erreur serveur. Veuillez réessayer plus tard.");
      } else {
        toast.error("Erreur de connexion. Veuillez réessayer.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center shadow-lg mb-4">
            <span className="text-2xl font-bold text-white">SQ</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Bienvenue sur SmartQueue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre espace
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Adresse email
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground"
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-blue-600 hover:text-blue-500"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-foreground"
                >
                  Se souvenir de moi
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Connexion en cours...
                  </>
                ) : (
                  "Se connecter"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">
                  <span className="text-xs">PAS ENCORE DE COMPTE ? </span>
                </span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Link
                to="/signup"
                className="font-medium text-blue-600 hover:text-blue-500 text-sm"
              >
                S'inscrire à un nouveau compte
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} SmartQueue. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
