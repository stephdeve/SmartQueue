/**
 * HeaderNew - Version moderne avec notifications et profil améliorés
 * Barre supérieure affichant l'utilisateur connecté, les notifications et le thème
 */
import { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout } from "@/store/authSlice";
import {
  Bell,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  Moon,
  Sun,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/axios";

type HeaderProps = {
  onMenuToggle?: () => void;
};

interface NotificationDb {
  id: string;
  type?: string;
  notifiable_type?: string;
  notifiable_id?: number;
  data?: any;
  read_at?: string | null;
  created_at?: string;
}

type SearchScope = "tickets" | "services" | "agents";

const parseSearchInput = (raw: string): { scope: SearchScope; query: string } => {
  const v = raw.trim();
  const lower = v.toLowerCase();

  if (lower.startsWith("@tickets")) {
    return { scope: "tickets", query: v.slice("@tickets".length).trim() };
  }
  if (lower.startsWith("@services")) {
    return { scope: "services", query: v.slice("@services".length).trim() };
  }
  if (lower.startsWith("@agents")) {
    return { scope: "agents", query: v.slice("@agents".length).trim() };
  }

  return { scope: "tickets", query: v };
};

type SearchResult = {
  id: string;
  label: string;
  description?: string;
  to: string;
  scope: SearchScope;
};

type UiNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
};

const toRelativeTime = (iso?: string) => {
  if (!iso) return "";
  const dt = new Date(iso);
  const diff = Date.now() - dt.getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return "À l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} j`;
};

const normalizeNotification = (n: NotificationDb): UiNotification => {
  const rawType = (n.data?.type || n.data?.level || n.type || "info") as string;
  const type: UiNotification["type"] =
    rawType === "success" ||
    rawType === "warning" ||
    rawType === "error" ||
    rawType === "info"
      ? (rawType as any)
      : "info";

  const title =
    n.data?.title || n.data?.subject || n.data?.name || "Notification";

  const message = n.data?.message || n.data?.body || n.data?.content || "";

  return {
    id: String(n.id),
    title: String(title),
    message: String(message),
    time: toRelativeTime(n.created_at),
    read: !!n.read_at,
    type,
  };
};

export default function HeaderNew({ onMenuToggle }: HeaderProps) {
  const { user } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null,
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const { data } = await api.get("/api/notifications?per_page=10");
      const items: NotificationDb[] = Array.isArray(data?.data)
        ? data.data
        : [];
      setNotifications(items.map(normalizeNotification));
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Impossible de charger les notifications";
      setNotificationsError(msg);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  // Fermer le dropdown des notifications en cliquant dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const el = document.getElementById('header-global-search')
      if (el && !el.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const { scope, query } = parseSearchInput(searchQuery)
    const q = query.trim().toLowerCase()
    if (!q) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setSearchLoading(true)
      setSearchError(null)
      try {
        if (scope === 'tickets') {
          // Déterminer l'endpoint selon le rôle
          // Le super admin n'a pas de file : les routes /agent/* lui renvoient 403
          const isAgentOrAdmin = user?.role === 'agent' || user?.role === 'admin'
          const ticketsEndpoint = isAgentOrAdmin ? '/api/agent/tickets' : '/api/tickets/active'
          const historyEndpoint = isAgentOrAdmin ? '/api/agent/tickets?status=closed&per_page=50' : '/api/tickets/history?per_page=50'
          
          const [activeRes, historyRes] = await Promise.all([
            api.get(ticketsEndpoint),
            api.get(historyEndpoint),
          ])

          const activeArr = Array.isArray(activeRes?.data?.data)
            ? activeRes.data.data
            : Array.isArray(activeRes?.data)
              ? activeRes.data
              : []
          const historyArr = Array.isArray(historyRes?.data?.data)
            ? historyRes.data.data
            : Array.isArray(historyRes?.data)
              ? historyRes.data
              : []

          const all = [...activeArr, ...historyArr]
          const mapped: SearchResult[] = all
            .map((t: any) => {
              const id = String(t?.id ?? t?.data?.id ?? '')
              const attrs = t?.attributes || t
              const status = attrs?.status
              const serviceName =
                attrs?.service?.name ||
                attrs?.service_name ||
                attrs?.service?.data?.name
              const estName =
                attrs?.service?.establishment?.name ||
                attrs?.establishment_name ||
                attrs?.service?.data?.establishment?.name
              const label = id ? `Ticket #${id}` : 'Ticket'
              const description = [status, serviceName, estName].filter(Boolean).join(' • ')

              return {
                id: id || `ticket-${Math.random()}`,
                label,
                description,
                to: id ? `/dashboard/tickets?ticket=${id}` : '/dashboard/tickets',
                scope: 'tickets' as SearchScope,
              }
            })
            .filter((r) => {
              const hay = `${r.label} ${r.description || ''}`.toLowerCase()
              return hay.includes(q)
            })
            .slice(0, 8)

          if (!cancelled) setSearchResults(mapped)
          return
        }

        if (scope === 'services') {
          if (!isAdmin) {
            if (!cancelled) {
              setSearchResults([])
              setSearchError('Recherche services réservée aux admins')
            }
            return
          }
          const { data } = await api.get('/api/admin/services')
          const arr = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : []
          const mapped: SearchResult[] = arr
            .map((s: any) => {
              const id = String(s?.id ?? '')
              const name = String(s?.name ?? 'Service')
              const status = s?.status
              const estName = s?.establishment?.name
              return {
                id: id || `service-${Math.random()}`,
                label: name,
                description: [status, estName].filter(Boolean).join(' • '),
                to: '/dashboard/services',
                scope: 'services' as SearchScope,
              }
            })
            .filter((r) => `${r.label} ${r.description || ''}`.toLowerCase().includes(q))
            .slice(0, 8)
          if (!cancelled) setSearchResults(mapped)
          return
        }

        if (scope === 'agents') {
          if (!isAdmin) {
            if (!cancelled) {
              setSearchResults([])
              setSearchError('Recherche agents réservée aux admins')
            }
            return
          }
          const { data } = await api.get('/api/admin/agents')
          const arr = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
              ? data
              : []
          const mapped: SearchResult[] = arr
            .map((a: any) => {
              const id = String(a?.id ?? '')
              const name = String(a?.name ?? 'Agent')
              const email = a?.email
              const status = a?.status
              return {
                id: id || `agent-${Math.random()}`,
                label: name,
                description: [email, status].filter(Boolean).join(' • '),
                to: '/dashboard/agents',
                scope: 'agents' as SearchScope,
              }
            })
            .filter((r) => `${r.label} ${r.description || ''}`.toLowerCase().includes(q))
            .slice(0, 8)
          if (!cancelled) setSearchResults(mapped)
          return
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Erreur recherche'
        if (!cancelled) {
          setSearchResults([])
          setSearchError(msg)
        }
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }

    const t = window.setTimeout(run, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [searchQuery, searchOpen, isAdmin])

  useEffect(() => {
    if (!notificationsOpen) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsOpen]);

  if (!user) return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 transition-all duration-300 ",
        "bg-background border-border",
      )}
    >
      {/* Section gauche - Menu mobile et recherche */}
      <div className="flex items-center gap-4 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="md:hidden h-9 w-9 hover:bg-accent"
        >
          <Menu className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Ouvrir le menu</span>
        </Button>

        <div className="relative max-w-md flex-1" id="header-global-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false)
                setSearchQuery('')
                return
              }
              if (e.key === 'Enter' && searchResults.length > 0) {
                navigate(searchResults[0].to)
                setSearchOpen(false)
                setSearchQuery('')
              }
            }}
            className={cn(
              "w-full h-9 pl-10 pr-4 text-sm rounded-xl transition-all duration-300",
              "bg-muted border border-border",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
              "placeholder:text-muted-foreground",
            )}
            placeholder="@tickets @services @agents"
          />

          {searchOpen && (searchLoading || searchError || searchResults.length > 0) && (
            <div
              className={cn(
                'absolute left-0 right-0 top-full mt-2 rounded-xl border shadow-xl overflow-hidden z-50',
                'bg-background border-border',
                // Responsive width et positionnement
                'min-w-[280px] max-w-[calc(100vw-2rem)] sm:min-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl',
                'left-2 sm:left-0 right-2 sm:right-0'
              )}
            >
              {searchLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Recherche...</div>
              ) : searchError ? (
                <div className="p-3 text-sm text-destructive">{searchError}</div>
              ) : (
                <div className="divide-y divide-border">
                  {searchResults.map((r) => (
                    <button
                      key={`${r.scope}-${r.id}`}
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm transition-colors',
                        'hover:bg-accent',
                      )}
                      onClick={() => {
                        navigate(r.to)
                        setSearchOpen(false)
                        setSearchQuery('')
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground truncate">{r.label}</span>
                        <span className="text-xs text-muted-foreground">@{r.scope}</span>
                      </div>
                      {r.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section droite - Notifications, thème et profil */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className={cn(
              "relative h-9 w-9 transition-all duration-300",
              "hover:bg-accent hover:scale-110",
            )}
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 ? (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center animate-pulse shadow-lg"
              >
                {unreadCount}
              </Badge>
            ) : null}
            <span className="sr-only">Notifications</span>
          </Button>

          {/* Dropdown notifications */}
          {notificationsOpen && (
            <div
              className={cn(
                "absolute right-0 top-full mt-2 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden transition-all duration-300",
                "bg-background border",
                // Responsive width : 320px sur grand écran, 280px sur tablette, prend toute la largeur avec marges sur mobile
                "w-80 sm:w-72 md:w-80",
                "right-2 sm:right-0",
                "max-w-[calc(100vw-2rem)] sm:max-w-none"
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Notifications</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const unread = notifications.filter((n) => !n.read)
                      if (unread.length === 0) return
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                      try {
                        await api.post('/api/notifications/mark-all-read')
                      } catch (_) {
                        fetchNotifications()
                      }
                    }}
                    disabled={unreadCount === 0}
                    className="h-7"
                  >
                    Tout lire
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setNotificationsOpen(false)}
                    className="h-6 w-6 hover:bg-accent"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notificationsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Chargement...
                  </div>
                ) : notificationsError ? (
                  <div className="p-4 text-center text-destructive">
                    {notificationsError}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Aucune notification
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-accent transition-colors cursor-pointer",
                          !notification.read &&
                            "bg-blue-50 dark:bg-blue-900/20",
                        )}
                        onClick={() => navigate("/dashboard/notifications")}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                              notification.type === "error" && "bg-red-500",
                              notification.type === "warning" &&
                                "bg-orange-500",
                              notification.type === "success" && "bg-green-500",
                              notification.type === "info" && "bg-blue-500",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {notification.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate("/dashboard/notifications")}
                >
                  Voir toutes les notifications
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Toggle thème */}
        <ThemeToggle />

        {/* Profil utilisateur */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "relative h-9 px-2 transition-all duration-300",
                "hover:bg-accent hover:scale-105",
              )}
            >
              <Avatar
                className="h-8 w-8 ring-2 ring-blue-500/20"
                src={user.avatar}
              >
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium flex items-center justify-center">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block ml-3 text-left">
                <p className="text-sm font-medium ">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user.role}
                </p>
              </div>
              <ChevronDown className="hidden md:block ml-2 h-4 w-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className={cn(
              "w-56 rounded-xl shadow-2xl transition-all duration-300",
              "bg-background border-border",
              // Responsive width et positionnement
              "sm:w-56 w-52",
              "max-w-[calc(100vw-2rem)] sm:max-w-none"
            )}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="hover:bg-accent"
              onClick={() => navigate("/dashboard/profile")}
            >
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Mon profil</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-accent"
              onClick={() => navigate("/dashboard/notifications")}
            >
              <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Notifications</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-accent"
              onClick={() => navigate("/dashboard/settings")}
            >
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Paramètres</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive hover:bg-accent focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
