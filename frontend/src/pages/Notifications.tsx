import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  Filter,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api/axios';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'ticket' | 'system' | 'queue' | 'user';
  actionUrl?: string;
}

interface NotificationDb {
  id: string;
  type?: string;
  data?: any;
  read_at?: string | null;
  created_at?: string;
}

const toRelativeTime = (iso?: string) => {
  if (!iso) return '';
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

const normalizeNotification = (n: NotificationDb): Notification => {
  const rawType = (n.data?.type || n.data?.level || n.type || 'info') as string;
  const type: Notification['type'] =
    rawType === 'success' || rawType === 'warning' || rawType === 'error' || rawType === 'info'
      ? (rawType as any)
      : 'info';

  const rawCategory = (n.data?.category || n.data?.scope || 'system') as string;
  const category: Notification['category'] =
    rawCategory === 'ticket' || rawCategory === 'system' || rawCategory === 'queue' || rawCategory === 'user'
      ? (rawCategory as any)
      : 'system';

  const title = n.data?.title || n.data?.subject || n.data?.name || 'Notification';
  const message = n.data?.message || n.data?.body || n.data?.content || '';
  const actionUrl = n.data?.actionUrl || n.data?.action_url || n.data?.url;

  return {
    id: String(n.id),
    title: String(title),
    message: String(message),
    time: toRelativeTime(n.created_at),
    read: !!n.read_at,
    type,
    category,
    actionUrl: typeof actionUrl === 'string' ? actionUrl : undefined,
  };
};

export default function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchNotifications = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get('/api/notifications?per_page=50');
      console.log('[Notifications] API response:', data);
      
      // La réponse peut être: { data: [...] }, { data: { data: [...] } }, ou directement [...]
      let items: NotificationDb[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (Array.isArray(data?.data)) {
        items = data.data;
      } else if (data?.data?.data && Array.isArray(data.data.data)) {
        items = data.data.data;
      }
      
      console.log('[Notifications] Parsed items:', items);
      setNotifications(items.map(normalizeNotification));
    } catch (e: any) {
      console.error('[Notifications] Error:', e);
      const msg = e?.response?.data?.message || e?.message || 'Impossible de charger les notifications';
      setLoadError(msg);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const filteredNotifications = notifications.filter(notification => {
    const matchesReadStatus = 
      filter === 'all' || 
      (filter === 'unread' && !notification.read) || 
      (filter === 'read' && notification.read);
    
    const matchesType = 
      typeFilter === 'all' || 
      notification.type === typeFilter;
    
    return matchesReadStatus && matchesType;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch (e) {
      await fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await api.post('/api/notifications/mark-all-read');
    } catch (e) {
      await fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await api.delete(`/api/notifications/${id}`);
    } catch (e) {
      await fetchNotifications();
    }
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map(n => n.id);
    setNotifications([]);
    try {
      await Promise.all(ids.map(id => api.delete(`/api/notifications/${id}`)));
    } catch (e) {
      await fetchNotifications();
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: Notification['category']) => {
    switch (category) {
      case 'ticket':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'system':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'queue':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'user':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Veuillez vous connecter pour accéder à vos notifications.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 ">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Notifications</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gérez vos notifications et restez informé des activités importantes
              </p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="animate-pulse w-fit shrink-0">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAll}
            disabled={notifications.length === 0}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Tout effacer
          </Button>
          {isAdmin && (
            <>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  // Fonctionnalité à venir
                  alert('Fonctionnalité d\'ajout de notifications bientôt disponible !');
                }}
                className="flex items-center gap-2"
              >
                <Bell className="h-4 w-4" />
                Ajouter une notification
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => {
                  // Fonctionnalité à venir
                  alert('Fonctionnalité de notification globale bientôt disponible !');
                }}
                className="flex items-center gap-2"
              >
                <Info className="h-4 w-4" />
                Notification globale
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => {
                  window.location.href = '/dashboard/admin/notification-logs';
                }}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Logs notifications
              </Button>
            </>
          )}
        </div>

        {/* Filtres */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* Header des filtres */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtrer:</span>
              </div>
              
              {/* Tous les filtres sur une seule ligne */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Filtres par statut */}
                <Button
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setTypeFilter('all');
                  }}
                  className="shrink-0"
                >
                  Tout ({notifications.length})
                </Button>
                <Button
                  variant={filter === 'unread' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setFilter('unread');
                    setTypeFilter('all');
                  }}
                  className="shrink-0"
                >
                  Non lues ({unreadCount})
                </Button>
                <Button
                  variant={filter === 'read' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setFilter('read');
                    setTypeFilter('all');
                  }}
                  className="shrink-0"
                >
                  Lues ({notifications.length - unreadCount})
                </Button>

                {/* Séparateur */}
                <div className="hidden sm:block w-px h-4 bg-border mx-1" />

                {/* Filtres par type */}
                <Button
                  variant={typeFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTypeFilter('all')}
                  className="shrink-0 text-xs"
                >
                  Tous types
                </Button>
                <Button
                  variant={typeFilter === 'info' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTypeFilter('info')}
                  className="flex items-center gap-1 shrink-0 text-xs"
                >
                  <Info className="h-3 w-3" />
                  <span className="hidden xs:inline">Info</span>
                  <span className="xs:hidden">Info</span>
                </Button>
                <Button
                  variant={typeFilter === 'success' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTypeFilter('success')}
                  className="flex items-center gap-1 shrink-0 text-xs"
                >
                  <CheckCircle className="h-3 w-3" />
                  <span className="hidden xs:inline">Succès</span>
                  <span className="xs:hidden">Succès</span>
                </Button>
                <Button
                  variant={typeFilter === 'warning' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTypeFilter('warning')}
                  className="flex items-center gap-1 shrink-0 text-xs"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="hidden xs:inline">Alerte</span>
                  <span className="xs:hidden">Alerte</span>
                </Button>
                <Button
                  variant={typeFilter === 'error' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTypeFilter('error')}
                  className="flex items-center gap-1 shrink-0 text-xs"
                >
                  <XCircle className="h-3 w-3" />
                  <span className="hidden xs:inline">Erreur</span>
                  <span className="xs:hidden">Erreur</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des notifications */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : loadError && notifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Erreur de chargement
            </h3>
            <p className="text-muted-foreground mb-6">{loadError}</p>
            <Button variant="outline" onClick={fetchNotifications}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {filter === 'unread' ? 'Aucune notification non lue' : 
               filter === 'read' ? 'Aucune notification lue' : 
               'Aucune notification'}
            </h3>
            <p className="text-muted-foreground">
              {filter === 'unread' ? 'Toutes vos notifications ont été lues' :
               filter === 'read' ? "Vous n'avez pas encore lu de notifications" :
               "Vous n'avez pas encore reçu de notifications"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <Card 
              key={notification.id}
              className={cn(
                "transition-all duration-200 hover:shadow-md",
                !notification.read && "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icône de notification */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                    notification.type === 'info' && "bg-blue-100 dark:bg-blue-900/30",
                    notification.type === 'success' && "bg-green-100 dark:bg-green-900/30",
                    notification.type === 'warning' && "bg-orange-100 dark:bg-orange-900/30",
                    notification.type === 'error' && "bg-red-100 dark:bg-red-900/30"
                  )}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className={cn(
                          "font-semibold text-foreground mb-1",
                          !notification.read && "font-bold"
                        )}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {notification.time}
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getCategoryColor(notification.category))}
                          >
                            {notification.category}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsRead(notification.id)}
                            className="h-8 w-8 hover:bg-accent"
                            title="Marquer comme lu"
                          >
                            <Check className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-8 w-8 hover:bg-destructive/10"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    {/* Action button if applicable */}
                    {notification.actionUrl && (
                      <div className="mt-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            // Navigation vers l'URL d'action
                            window.location.href = notification.actionUrl;
                          }}
                        >
                          Voir les détails
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
