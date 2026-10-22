/**
 * Router Configuration - Structure optimisée
 * Organisation des routes par fonctionnalités avec lazy loading
 */
import { BrowserRouter, Link, useRoutes } from "react-router-dom";
import { Suspense, lazy } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useAppDispatch } from "@/store";
import { refreshMe } from "@/store/authSlice";
import { useEffect } from "react";
import { Activity } from "lucide-react";

// Lazy loading des pages pour optimiser le bundle
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Dashboard = lazy(() => import("@/pages/dashboard/Dashboard"));
const DashboardRedirect = lazy(
  () => import("@/pages/dashboard/DashboardRedirect"),
);
const Login = lazy(() => import("@/pages/auth/Login"));
const Signup = lazy(() => import("@/pages/auth/Signup"));
const SubscriptionPlan = lazy(() => import("@/pages/auth/Subscription"));

// Pages queues
const QueuesList = lazy(() => import("@/pages/queues/Queues"));
const TicketsCalled = lazy(() => import("@/pages/queues/TicketsCalled"));
const TicketsAbsent = lazy(() => import("@/pages/queues/TicketsAbsent"));
const TicketsPriority = lazy(() => import("@/pages/queues/TicketsPriority"));

// Pages tickets
const Tickets = lazy(() => import("@/pages/tickets/Tickets"));

// Pages admin
const Agents = lazy(() => import("@/pages/admin/Agents"));
const Services = lazy(() => import("@/pages/admin/Services"));
const Establishments = lazy(() => import("@/pages/admin/Establishments"));
const Stats = lazy(() => import("@/pages/admin/Stats"));
const NotificationLogs = lazy(() => import("@/pages/admin/NotificationLogs"));

// Pages SaaS
const SaasMonitoring = lazy(() => import("@/pages/saas/SaasMonitoring"));
const SaasEstablishments = lazy(
  () => import("@/pages/saas/SaasEstablishments"),
);
const SaasSubscriptions = lazy(() => import("@/pages/saas/SaasSubscriptions"));
const SuperAdminSettings = lazy(() => import("@/pages/saas/SuperAdminSettings"));
const SuperAdminDashboard = lazy(() => import("@/pages/saas/SuperAdminDashboard"));
const SuperAdminProfile = lazy(() => import("@/pages/saas/SuperAdminProfile"));
const AgentDashboard = lazy(() => import("@/pages/agent/AgentDashboard"));

// Setup onboarding admin
const SetupEstablishment = lazy(
  () => import("@/pages/onboarding/SetupEstablishment"),
);

// Pages communes
const Settings = lazy(() => import("@/pages/Settings"));
const Billing = lazy(() => import("@/pages/dashboard/Billing"));
const Analytics = lazy(() => import("@/pages/dashboard/Analytics"));
const PushBroadcast = lazy(() => import("@/pages/dashboard/PushBroadcast"));
const Profile = lazy(() => import("@/pages/auth/user/Profile"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const Notifications = lazy(() => import("@/pages/Notifications"));

// Composant de chargement
const PageLoader = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="relative flex flex-col items-center gap-6">
        {/* Glow */}
        <div className="absolute w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />

        {/* Spinner ring */}
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 " />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        </div>

        {/* Text */}
        <div className="text-center space-y-1">
          <p className="text-lg font-medium tracking-wide">
            Chargement des données
          </p>
          <p className="text-sm text-muted-foreground animate-pulse">
            Préparation de votre expérience...
          </p>
        </div>
      </div>
    </div>
  );
};

// Composant de chargement simple
const PageLoaderSample = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="relative flex flex-col items-center gap-6">
        {/* Glow */}
        <div className="absolute w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />

        {/* Spinner ring */}
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 " />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        </div>
      </div>
    </div>
  );
};

const PageLoaderHome = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 max-w-xs w-full">
        {/* Logo + Nom */}
        <div className="flex items-center gap-2 justify-center animate-pulse">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-lg text-foreground">SmartQueue</p>
            <p className="text-xs text-muted-foreground leading-none">
              Gestion de vos files d'attente
            </p>
          </div>
        </div>

        {/* Barre de chargement */}
        <div className="space-y-2">
          <div className="mx-10 h-2 bg-muted rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full animate-[loading_2s_ease-in-out_infinite]"
              style={{ width: "30%" }}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Chargement de votre espace...
          </p>
        </div>
      </div>

      {/* Animation personnalisée pour la barre */}
      <style>{`
        @keyframes loading {
          0% { left: -30%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
};

// Compte usager (rôle « user ») connecté au web : l'espace web est réservé aux
// établissements, l'usager prend ses tickets depuis l'application mobile.
const UserHome = () => (
  <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
    <h1 className="text-2xl font-bold text-foreground">Espace établissement</h1>
    <p className="text-muted-foreground">
      Pour prendre un ticket et suivre votre position, utilisez l'application mobile SmartQueue. Pour gérer les files
      d'attente de votre établissement, choisissez une offre : votre période d'essai démarre immédiatement.
    </p>
    <Link
      to="/dashboard/subscription"
      className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
    >
      Choisir une offre
    </Link>
  </div>
);

function AppRoutes() {
  const { user, isAuthenticated } = useAuth();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!isAuthenticated) return;
    // Ensure we have a fresh user after reload/login
    // - Admin: establishment_id is required for scoping
    // - Agent: needs services/counters for queue dashboard
    if (user?.role === "admin") {
      if (!user?.establishment_id) {
        dispatch(refreshMe());
      }
      return;
    }
    if (user?.role === "agent") {
      dispatch(refreshMe());
    }
  }, [dispatch, isAuthenticated]);

  const routes = [
    // Routes publiques
    {
      path: "/",
      element: (
        <Suspense fallback={<PageLoaderHome />}>
          <LandingPage />
        </Suspense>
      ),
    },
    {
      path: "/login",
      element: (
        <Suspense fallback={<PageLoaderSample />}>
          <Login />
        </Suspense>
      ),
    },
    {
      path: "/signup",
      element: (
        <Suspense fallback={<PageLoaderSample />}>
          <Signup />
        </Suspense>
      ),
    },
    {
      path: "/subscription",
      element: (
        <Suspense fallback={<PageLoaderSample />}>
          <SubscriptionPlan />
        </Suspense>
      ),
    },
    {
      path: "/forgot-password",
      element: (
        <Suspense fallback={<PageLoaderSample />}>
          <ForgotPassword />
        </Suspense>
      ),
    },
    {
      path: "/reset-password",
      element: (
        <Suspense fallback={<PageLoaderSample />}>
          <ResetPassword />
        </Suspense>
      ),
    },

    // Routes protégées avec layout
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<PageLoader />}>
              {user?.role === "super_admin" ? (
                <SuperAdminDashboard />
              ) : user?.role === "agent" ? (
                <AgentDashboard />
              ) : user?.role === "admin" ? (
                <Dashboard />
              ) : (
                <UserHome />
              )}
            </Suspense>
          ),
        },
        // Route setup-establishment toujours disponible pour les admins
        // Le composant SetupEstablishment gère la redirection si l'utilisateur a déjà un établissement
        ...(user?.role === "admin"
          ? [
              {
                path: "setup-establishment",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SetupEstablishment />
                  </Suspense>
                ),
              },
            ]
          : []),
        {
          path: "queues",
          children: [
            {
              index: true,
              element: (
                <Suspense fallback={<PageLoader />}>
                  <QueuesList />
                </Suspense>
              ),
            },
            {
              path: "called",
              element: (
                <Suspense fallback={<PageLoader />}>
                  <TicketsCalled />
                </Suspense>
              ),
            },
            {
              path: "absent",
              element: (
                <Suspense fallback={<PageLoader />}>
                  <TicketsAbsent />
                </Suspense>
              ),
            },
            {
              path: "priority",
              element: (
                <Suspense fallback={<PageLoader />}>
                  <TicketsPriority />
                </Suspense>
              ),
            },
          ],
        },
        // Route tickets pour admin et agent
        ...(user?.role === "admin" || user?.role === "agent"
          ? [
              {
                path: "tickets",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Tickets />
                  </Suspense>
                ),
              },
            ]
          : []),
        // Routes admin (protégées)
        ...(user?.role === "admin" && !!user?.establishment_id
          ? [
              {
                path: "agents",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Agents />
                  </Suspense>
                ),
              },
              {
                path: "services",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Services />
                  </Suspense>
                ),
              },
              {
                path: "establishments",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Establishments />
                  </Suspense>
                ),
              },
              {
                path: "stats",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Stats />
                  </Suspense>
                ),
              },
              {
                path: "admin/notification-logs",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <NotificationLogs />
                  </Suspense>
                ),
              },
            ]
          : []),
        // Routes SaaS (protégées - uniquement super_admin)
        ...(user?.role === "super_admin"
          ? [
              {
                path: "saas/monitoring",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SaasMonitoring />
                  </Suspense>
                ),
              },
              {
                path: "saas/establishments",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SaasEstablishments />
                  </Suspense>
                ),
              },
              {
                path: "saas/subscriptions",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SaasSubscriptions />
                  </Suspense>
                ),
              },
              {
                path: "saas/settings",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <SuperAdminSettings />
                  </Suspense>
                ),
              },
            ]
          : []),
        {
          path: "settings",
          element: (
            <Suspense fallback={<PageLoader />}>
              {user?.role === "super_admin" ? <SuperAdminSettings /> : <Settings />}
            </Suspense>
          ),
        },
        // Pages d'administration d'établissement (endpoints /api/admin/* réservés aux admins)
        ...(user?.role === "admin"
          ? [
              {
                path: "billing",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Billing />
                  </Suspense>
                ),
              },
              {
                path: "analytics",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <Analytics />
                  </Suspense>
                ),
              },
              {
                path: "push",
                element: (
                  <Suspense fallback={<PageLoader />}>
                    <PushBroadcast />
                  </Suspense>
                ),
              },
            ]
          : []),
        // Souscription : usager qui crée son établissement, ou admin qui change d'offre
        ...(user?.role === "admin" || user?.role === "user"
          ? [
              {
                path: "subscription",
                element: (
                  <Suspense fallback={<PageLoaderSample />}>
                    <SubscriptionPlan />
                  </Suspense>
                ),
              },
            ]
          : []),
        {
          path: "profile",
          element: (
            <Suspense fallback={<PageLoader />}>
              {user?.role === "super_admin" ? <SuperAdminProfile /> : <Profile />}
            </Suspense>
          ),
        },
        {
          path: "notifications",
          element: (
            <Suspense fallback={<PageLoader />}>
              <Notifications />
            </Suspense>
          ),
        },
      ],
    },

    // Route 404
    {
      path: "*",
      element: (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground selection:bg-primary/30">
          {/* Optionnel : Un cercle décoratif flou en arrière-plan pour la profondeur */}
          <div className="absolute inset-0 overflow-hidden -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[120px]" />
          </div>

          <div className="max-w-md w-full px-6 text-center">
            {/* L'identifiant d'erreur avec un style imposant */}
            <h1 className="text-9xl font-black tracking-tighter text-blue-500 leading-none mb-12">
              404
            </h1>

            <div className="relative -mt-12">
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Oups ! Page perdue.
              </h2>
              <p className="text-muted-foreground text-lg mb-5 balance">
                Désolé, la page que vous recherchez semble avoir déménagé ou n'a
                jamais existé.
              </p>

              {/* Bouton stylisé avec transition */}
              <a
                href="/"
                className="inline-flex items-center justify-center h-12 px-8 font-medium tracking-wide text-primary-foreground transition duration-200 rounded-full bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none focus:ring-offset-background active:scale-95"
              >
                Retour à l'accueil
              </a>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return useRoutes(routes);
}

export default function Router() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
