/**
 * Services (Admin)
 * Gestion des services avec modals de création/édition.
 * - GET /api/admin/services (liste)
 * - POST /api/admin/services (création)
 * - PUT /api/admin/services/{id} (édition)
 * Champs: establishment_id, name, avg_service_time_minutes, status (open/closed), priority_support
 */
import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/axios";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Ticket,
  Edit,
  Trash2,
  Pencil,
  QrCode,
  Download,
  CalendarClock,
  Bell,
  Search,
  ArrowUpDown,
  Star,
  Loader2,
  Activity,
  Clock,
  Layers,
} from "lucide-react";
import { jsPDF } from "jspdf";
import ServiceScheduleModal from "@/components/ServiceScheduleModal";
import ServiceSoundModal from "@/components/ServiceSoundModal";
import { AnalyticsCard } from "@/components/ui/analytics-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Service = {
  id: number;
  name: string;
  status: string;
  avg_service_time_minutes?: number;
  priority_support?: boolean;
  priority_mode?: string;
  priority_weighted_ratio?: number;
  call_timeout_minutes?: number | null;
  max_call_attempts?: number;
  en_route_grace_minutes?: number;
  capacity?: number | null;
  establishment?: { id: number; name: string };
  qr_code_token?: string;
  qr_code_url?: string;
  qr_generated_at?: string;
};
type Establishment = { id: number; name: string };

export default function Services() {
  const [rows, setRows] = useState<Service[]>([]);
  const [ests, setEsts] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openQr, setOpenQr] = useState(false);
  const [openSchedule, setOpenSchedule] = useState(false);
  const [scheduleServiceId, setScheduleServiceId] = useState<number | null>(
    null,
  );
  const [openSound, setOpenSound] = useState(false);
  const [soundService, setSoundService] = useState<Service | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [qrService, setQrService] = useState<Service | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Formulaires
  const [createForm, setCreateForm] = useState({
    establishment_id: 0,
    name: "",
    avg_service_time_minutes: 5,
    status: "open",
    priority_support: false,
    priority_mode: "immediate",
    priority_weighted_ratio: 5,
    call_timeout_minutes: null as number | null,
    en_route_grace_minutes: 10,
    max_call_attempts: 2,
    capacity: null as number | null,
  });
  const [editForm, setEditForm] = useState({
    establishment_id: 0,
    name: "",
    avg_service_time_minutes: 5,
    status: "open",
    priority_support: false,
    priority_mode: "immediate",
    priority_weighted_ratio: 5,
    call_timeout_minutes: null as number | null,
    en_route_grace_minutes: 10,
    max_call_attempts: 2,
    capacity: null as number | null,
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Recherche, filtres, tri, pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [establishmentFilter, setEstablishmentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [sortField, setSortField] = useState<string>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Schémas de validation Zod
  const serviceSchema = z.object({
    establishment_id: z.number().int().positive("Établissement requis"),
    name: z.string().min(2, "Nom trop court"),
    avg_service_time_minutes: z.number().int().min(1).max(240),
    status: z.enum(["open", "closed"]),
    priority_support: z.boolean(),
    priority_mode: z.enum(["immediate", "weighted", "disabled"]),
    priority_weighted_ratio: z.number().int().min(1).max(50),
    call_timeout_minutes: z.union([z.number().int().min(1).max(60), z.null()]),
    en_route_grace_minutes: z.number().int().min(1).max(60),
    max_call_attempts: z.number().int().min(1).max(10),
    capacity: z.union([z.number().int().min(1).max(5000), z.null()]),
  });

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.get("/api/admin/services?per_page=50");
      const data = response.data.data || response.data;
      const arr = Array.isArray(data) ? data : [];
      setRows(arr);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
      } else if (status === 403) {
        toast.error("Accès refusé. Permissions administrateur requises.");
      } else if (status === 404) {
        toast.error("Endpoint non trouvé. Vérifiez l'API.");
      } else if (status >= 500) {
        toast.error("Erreur serveur. Contactez l'administrateur.");
      } else {
        toast.error("Impossible de charger les services");
      }
      console.error("Erreur lors du chargement des services:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEsts = async () => {
    try {
      const response = await api.get("/api/admin/establishments?per_page=50");
      const data = response.data.data || response.data;
      setEsts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
      } else if (status === 403) {
        toast.error("Accès refusé. Permissions administrateur requises.");
      } else {
        toast.error("Impossible de charger les établissements");
      }
      console.error("Erreur lors du chargement des établissements:", error);
      setEsts([]);
    }
  };
  useEffect(() => {
    load();
    loadEsts();
  }, []);

  /** Ouverture du modal d'édition avec pré-remplissage. */
  const openEditModal = (s: Service) => {
    setEditing(s);
    setEditForm({
      establishment_id: s.establishment?.id || 0,
      name: s.name,
      avg_service_time_minutes: s.avg_service_time_minutes || 5,
      status: s.status || "open",
      priority_support: !!s.priority_support,
      priority_mode: s.priority_mode || "immediate",
      priority_weighted_ratio: s.priority_weighted_ratio ?? 5,
      call_timeout_minutes: s.call_timeout_minutes ?? null,
      max_call_attempts: s.max_call_attempts ?? 2,
      en_route_grace_minutes: s.en_route_grace_minutes ?? 10,
      capacity: s.capacity ?? null,
    });
    setOpenEdit(true);
  };

  /** Création d'un service. */
  const createService = async () => {
    setCreateErrors({});
    const parsed = serviceSchema.safeParse({ ...createForm });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[String(i.path[0])] = i.message;
      });
      setCreateErrors(errs);
      toast.error("Veuillez corriger le formulaire");
      return;
    }
    try {
      const response = await api.post("/api/admin/services", parsed.data);
      toast.success("Service créé avec succès");
      setOpenCreate(false);
      setCreateForm({
        establishment_id: 0,
        name: "",
        avg_service_time_minutes: 5,
        status: "open",
        priority_support: false,
        priority_mode: "immediate",
        priority_weighted_ratio: 5,
        call_timeout_minutes: null,
        en_route_grace_minutes: 10,
        max_call_attempts: 2,
        capacity: null,
      });
      load();
    } catch (e: any) {
      const status = e?.response?.status;
      const message =
        e?.response?.data?.error?.message || e?.response?.data?.message;

      if (status === 401) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
      } else if (status === 403) {
        toast.error("Permission refusée pour créer un service.");
      } else if (status === 422) {
        toast.error(
          message || "Données invalides. Veuillez vérifier le formulaire.",
        );
      } else if (status >= 500) {
        toast.error("Erreur serveur lors de la création.");
      } else {
        toast.error(message || "Erreur de création");
      }
    }
  };

  /** Mise à jour d'un service. */
  const updateService = async () => {
    if (!editing) return;
    setEditErrors({});
    const parsed = serviceSchema.safeParse({ ...editForm });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[String(i.path[0])] = i.message;
      });
      setEditErrors(errs);
      toast.error("Veuillez corriger le formulaire");
      return;
    }
    try {
      const response = await api.put(
        `/api/admin/services/${editing.id}`,
        parsed.data,
      );
      toast.success("Service mis à jour avec succès");
      setOpenEdit(false);
      setEditing(null);

      const updated = response?.data?.data || response?.data;
      if (updated && typeof updated === "object" && updated.id) {
        setRows((prev) =>
          prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
        );
      } else {
        await load();
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const message =
        e?.response?.data?.error?.message || e?.response?.data?.message;

      if (status === 401) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
      } else if (status === 403) {
        toast.error("Permission refusée pour modifier ce service.");
      } else if (status === 404) {
        toast.error("Service non trouvé.");
      } else if (status === 422) {
        toast.error(
          message || "Données invalides. Veuillez vérifier le formulaire.",
        );
      } else if (status >= 500) {
        toast.error("Erreur serveur lors de la mise à jour.");
      } else {
        toast.error(message || "Erreur de mise à jour");
      }
    }
  };

  /** Génère un QR code pour un service. */
  const generateQrCode = async (service: Service) => {
    setQrLoading(true);
    try {
      const response = await api.post(
        `/api/admin/services/${service.id}/qr-code`,
      );
      const qrData = response.data.qr_code;
      const updatedService = {
        ...service,
        qr_code_token: qrData.token,
        qr_code_url: qrData.url,
        qr_generated_at: qrData.generated_at,
      };
      setQrService(updatedService);
      toast.success("QR code généré avec succès");
      setRows((prev) =>
        prev.map((s) => (s.id === service.id ? updatedService : s)),
      );
    } catch (e: any) {
      const status = e?.response?.status;
      const message = e?.response?.data?.message;
      if (status === 403) {
        toast.error("Permission refusée");
      } else {
        toast.error(message || "Erreur lors de la génération du QR code");
      }
    } finally {
      setQrLoading(false);
    }
  };

  /** Ouvre le modal QR code. */
  const openQrModal = async (service: Service) => {
    setQrService(service);
    setOpenQr(true);
    if (!service.qr_code_token) {
      await generateQrCode(service);
    }
  };

  /** Télécharge le QR code en PDF. */
  const downloadQrCode = async (service: Service) => {
    if (!service.qr_code_url) return;
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text(service.name, pageWidth / 2, 30, { align: "center" });

      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(service.establishment?.name || "", pageWidth / 2, 42, {
        align: "center",
      });

      doc.setTextColor(0, 0, 0);
      const qrSize = 80;
      const qrX = (pageWidth - qrSize) / 2;

      doc.addImage(service.qr_code_url, "SVG", qrX, 55, qrSize, qrSize);

      doc.setDrawColor(50, 50, 50);
      doc.setLineWidth(0.5);
      doc.rect(qrX - 5, 50, qrSize + 10, qrSize + 10);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);

      const infoY = 150;
      doc.text(`Service: ${service.name}`, 20, infoY);
      doc.text(
        `Établissement: ${service.establishment?.name || ""}`,
        20,
        infoY + 8,
      );
      doc.text(`Code: vqs://service/${service.qr_code_token}`, 20, infoY + 16);
      if (service.qr_generated_at) {
        doc.text(
          `Généré le: ${new Date(service.qr_generated_at).toLocaleDateString("fr-FR")}`,
          20,
          infoY + 24,
        );
      }

      doc.setFillColor(232, 244, 232);
      doc.rect(15, infoY + 35, pageWidth - 30, 40, "F");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(45, 90, 45);
      doc.text("Instructions pour les usagers:", 20, infoY + 45);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(
        "• Scannez ce QR code avec l'application SmartQueue",
        25,
        infoY + 55,
      );
      doc.text(
        "• Un ticket sera automatiquement créé pour ce service",
        25,
        infoY + 62,
      );
      doc.text(
        "• Consultez votre position dans la file d'attente en temps réel",
        25,
        infoY + 69,
      );

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "SmartQueue - Système de gestion de files d'attente",
        pageWidth / 2,
        280,
        { align: "center" },
      );
      doc.text(
        "Ce QR code est permanent et peut être utilisé chaque jour",
        pageWidth / 2,
        286,
        { align: "center" },
      );

      doc.save(`qr-${service.name}-${service.qr_code_token}.pdf`);
      toast.success("PDF téléchargé avec succès");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const overallAvgTime = useMemo(() => {
    const withTime = rows.filter(
      (r) =>
        r.avg_service_time_minutes != null && r.avg_service_time_minutes > 0,
    );
    if (withTime.length === 0) return 0;
    return (
      withTime.reduce((sum, r) => sum + r.avg_service_time_minutes!, 0) /
      withTime.length
    );
  }, [rows]);

  const filteredServices = useMemo(() => {
    let result = [...rows];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (establishmentFilter !== "all") {
      const estId = Number(establishmentFilter);
      result = result.filter((r) => r.establishment?.id === estId);
    }

    result.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortField === "name") {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortField === "avg_service_time_minutes") {
        aVal = a.avg_service_time_minutes ?? Infinity;
        bVal = b.avg_service_time_minutes ?? Infinity;
      } else if (sortField === "capacity") {
        aVal = a.capacity ?? -Infinity;
        bVal = b.capacity ?? -Infinity;
      } else {
        aVal = (a as any)[sortField];
        bVal = (b as any)[sortField];
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    rows,
    searchQuery,
    statusFilter,
    establishmentFilter,
    sortField,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, establishmentFilter]);

  const totalCapacity = rows.reduce((sum, r) => sum + (r.capacity ?? 0), 0);

  const sortArrow = (field: string) => {
    if (sortField !== field) return null;
    return (
      <ArrowUpDown
        className={cn(
          "h-3 w-3 transition-transform",
          sortDir === "desc" && "rotate-180",
        )}
      />
    );
  };

  const healthIndicator = (service: Service) => {
    if (
      service.avg_service_time_minutes == null ||
      service.avg_service_time_minutes === 0
    ) {
      return (
        <span
          className="inline-block h-2 w-2 rounded-full bg-gray-400"
          title="—"
        />
      );
    }
    if (service.avg_service_time_minutes <= overallAvgTime) {
      return (
        <span
          className="inline-block h-2 w-2 rounded-full bg-green-500"
          title="Bon"
        />
      );
    }
    if (service.avg_service_time_minutes <= overallAvgTime * 1.2) {
      return (
        <span
          className="inline-block h-2 w-2 rounded-full bg-amber-500"
          title="Moyen"
        />
      );
    }
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-red-500"
        title="Lent"
      />
    );
  };

  const healthLabel = (service: Service) => {
    if (
      service.avg_service_time_minutes == null ||
      service.avg_service_time_minutes === 0
    )
      return <span className="text-muted-foreground">—</span>;
    if (service.avg_service_time_minutes <= overallAvgTime)
      return (
        <span className="text-green-600 dark:text-green-400 text-xs">Bon</span>
      );
    if (service.avg_service_time_minutes <= overallAvgTime * 1.2)
      return (
        <span className="text-amber-600 dark:text-amber-400 text-xs">
          Moyen
        </span>
      );
    return <span className="text-red-600 dark:text-red-400 text-xs">Lent</span>;
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Services</h1>
            <p className="text-sm text-muted-foreground">
              Gérez les services et leurs établissements
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => setOpenCreate(true)}
        >
          <Plus className="h-4 w-4" />
          Nouveau service
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Total services"
          value={rows.length}
          icon={Layers}
        />
        <AnalyticsCard
          title="Services ouverts"
          value={rows.filter((r) => r.status === "open").length}
          icon={Activity}
        />
        <AnalyticsCard
          title="Temps moyen"
          value={overallAvgTime > 0 ? `${Math.round(overallAvgTime)} min` : "—"}
          icon={Clock}
        />
        <AnalyticsCard
          title="Capacité totale"
          value={totalCapacity > 0 ? totalCapacity : "—"}
          icon={Plus}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="open">Ouvert</SelectItem>
            <SelectItem value="closed">Fermé</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={establishmentFilter}
          onValueChange={setEstablishmentFilter}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Établissement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les établissements</SelectItem>
            {ests.map((est) => (
              <SelectItem key={est.id} value={String(est.id)}>
                {est.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl">
        {loading ? (
          <div className="overflow-auto rounded-md border shadow-lg border-border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  {[
                    "ID",
                    "Service",
                    "Statut",
                    "Temps moyen (min)",
                    "Capacité",
                    "Délai priorité",
                    "Tentatives max",
                    "Délai présentation",
                    "Établissement",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : paginatedServices.length === 0 ? (
          <div className="rounded-md border shadow-lg border-border p-8 text-center text-muted-foreground">
            Aucun service trouvé
          </div>
        ) : (
          <>
            <div className="overflow-auto rounded-md border shadow-lg border-border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      ID
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Service
                        {sortArrow("name")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Statut
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none"
                      onClick={() => handleSort("avg_service_time_minutes")}
                    >
                      <div className="flex items-center gap-1">
                        Temps moyen (min)
                        {sortArrow("avg_service_time_minutes")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none"
                      onClick={() => handleSort("capacity")}
                    >
                      <div className="flex items-center gap-1">
                        Capacité
                        {sortArrow("capacity")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Délai priorité
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Tentatives max
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Délai présentation
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Établissement
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {paginatedServices.map((row, i) => (
                    <tr
                      key={(row.id ?? i).toString()}
                      className="hover-card transition-colors"
                    >
                      <td className="px-3 py-2 text-foreground">{row.id}</td>
                      <td className="px-3 py-2 text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {healthIndicator(row)}
                            <span>{row.name}</span>
                          </div>
                          {row.priority_support && (
                            <Badge
                              variant="warning"
                              className="gap-1 text-[10px] px-1.5 py-0"
                            >
                              <Star className="h-3 w-3" />
                              Prioritaire
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.status === "open" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200 ring-1 ring-inset ring-green-200 dark:ring-green-800/30" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 ring-1 ring-inset ring-red-200 dark:ring-red-800/30"}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{row.avg_service_time_minutes ?? "—"}</span>
                          {row.avg_service_time_minutes != null && (
                            <div className="flex items-center gap-1">
                              {healthIndicator(row)}
                              {healthLabel(row)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.capacity === null || row.capacity === undefined
                          ? "—"
                          : row.capacity}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.call_timeout_minutes ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.max_call_attempts ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.en_route_grace_minutes ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.establishment?.name}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        <div className="flex gap-1">
                          <button
                            className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            onClick={() => {
                              setScheduleServiceId(row.id);
                              setOpenSchedule(true);
                            }}
                            title="Horaires & jours fériés"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                            onClick={() => {
                              setSoundService(row);
                              setOpenSound(true);
                            }}
                            title="Alertes sonores"
                          >
                            <Bell className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            onClick={() => openQrModal(row)}
                            title="QR Code"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            onClick={() => openEditModal(row)}
                            title="Éditer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            onClick={async () => {
                              if (
                                !confirm(`Supprimer le service ${row.name} ?`)
                              )
                                return;
                              try {
                                await api.delete(
                                  `/api/admin/services/${row.id}`,
                                );
                                toast.success("Service supprimé avec succès");
                                await load();
                              } catch (e: any) {
                                const status = e?.response?.status;
                                const message =
                                  e?.response?.data?.error?.message ||
                                  e?.response?.data?.message;

                                if (status === 401) {
                                  toast.error(
                                    "Session expirée. Veuillez vous reconnecter.",
                                  );
                                } else if (status === 403) {
                                  toast.error(
                                    "Permission refusée pour supprimer ce service.",
                                  );
                                } else if (status === 404) {
                                  toast.error("Service non trouvé.");
                                } else if (status >= 500) {
                                  toast.error(
                                    "Erreur serveur lors de la suppression.",
                                  );
                                } else {
                                  toast.error(
                                    message || "Suppression impossible",
                                  );
                                }
                              }
                            }}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    currentPage <= 1
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-foreground bg-muted hover:bg-accent",
                  )}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-1 text-muted-foreground">
                            ...
                          </span>
                        )}
                        <button
                          className={cn(
                            "inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-md transition-colors",
                            p === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground bg-muted hover:bg-accent",
                          )}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}
                <button
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    currentPage >= totalPages
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-foreground bg-muted hover:bg-accent",
                  )}
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Création */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Créer un service"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground">
              Établissement
            </label>
            <select
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.establishment_id}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  establishment_id: Number(e.target.value),
                })
              }
            >
              <option value={0}>—</option>
              {ests.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Nom</label>
            <input
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm({ ...createForm, name: e.target.value })
              }
            />
            {createErrors.name && (
              <p className="text-xs text-destructive">{createErrors.name}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Temps moyen (min)
            </label>
            <input
              type="number"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.avg_service_time_minutes}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  avg_service_time_minutes: Number(e.target.value),
                })
              }
            />
            {createErrors.avg_service_time_minutes && (
              <p className="text-xs text-destructive">
                {createErrors.avg_service_time_minutes}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Capacité (max tickets)
            </label>
            <input
              type="number"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.capacity ?? ""}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  capacity:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="(illimité)"
            />
            {createErrors.capacity && (
              <p className="text-xs text-destructive">
                {createErrors.capacity}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Statut
            </label>
            <select
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.status}
              onChange={(e) =>
                setCreateForm({ ...createForm, status: e.target.value })
              }
            >
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={createForm.priority_support}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  priority_support: e.target.checked,
                })
              }
            />
            <span>Support prioritaire</span>
          </label>
          <div className="col-span-2">
            <label className="text-sm font-medium text-foreground">
              Mode de priorité
            </label>
            <select
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm mt-1"
              value={createForm.priority_mode}
              onChange={(e) =>
                setCreateForm({ ...createForm, priority_mode: e.target.value })
              }
            >
              <option value="immediate">
                Immédiat — prioritaire passe devant
              </option>
              <option value="weighted">
                Pondéré — ratio N normal / 1 prioritaire
              </option>
              <option value="disabled">Désactivé — FIFO pur</option>
            </select>
          </div>
          {createForm.priority_mode === "weighted" && (
            <div>
              <label className="text-sm font-medium text-foreground">
                Ratio (N normal → 1 prio)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                className="w-full rounded-md border-border bg-background px-3 py-2 text-sm"
                value={createForm.priority_weighted_ratio}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    priority_weighted_ratio: Number(e.target.value),
                  })
                }
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground">
              Délai de priorité (min)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              placeholder="Par défaut (10 min)"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.call_timeout_minutes ?? ""}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  call_timeout_minutes:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Délai accordé après l'appel d'un ticket avant marquage absent
              automatique.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Tentatives max
            </label>
            <input
              type="number"
              min={1}
              max={10}
              placeholder="2"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.max_call_attempts}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  max_call_attempts: Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nombre d'absences avant expiration définitive du ticket.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Délai de présentation (min)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              placeholder="10"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={createForm.en_route_grace_minutes}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  en_route_grace_minutes: Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Délai accordé à l'usager pour se présenter après confirmation "En
              route".
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-md transition-colors"
            onClick={() => setOpenCreate(false)}
          >
            Annuler
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
            onClick={createService}
          >
            Créer
          </button>
        </div>
      </Modal>

      {/* Modal Édition */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title={`Éditer le service ${editing?.name ?? ""}`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground">
              Établissement
            </label>
            <select
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.establishment_id}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  establishment_id: Number(e.target.value),
                })
              }
            >
              <option value={0}>—</option>
              {ests.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Nom</label>
            <input
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
            {editErrors.name && (
              <p className="text-xs text-destructive">{editErrors.name}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Temps moyen (min)
            </label>
            <input
              type="number"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.avg_service_time_minutes}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  avg_service_time_minutes: Number(e.target.value),
                })
              }
            />
            {editErrors.avg_service_time_minutes && (
              <p className="text-xs text-destructive">
                {editErrors.avg_service_time_minutes}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Capacité (max tickets)
            </label>
            <input
              type="number"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.capacity ?? ""}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  capacity:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="(illimité)"
            />
            {editErrors.capacity && (
              <p className="text-xs text-destructive">{editErrors.capacity}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Statut
            </label>
            <select
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.status}
              onChange={(e) =>
                setEditForm({ ...editForm, status: e.target.value })
              }
            >
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={editForm.priority_support}
              onChange={(e) =>
                setEditForm({ ...editForm, priority_support: e.target.checked })
              }
            />
            <span>Support prioritaire</span>
          </label>
          <div className="col-span-2">
            <label className="text-sm font-medium text-foreground">
              Mode de priorité
            </label>
            <select
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm mt-1"
              value={editForm.priority_mode}
              onChange={(e) =>
                setEditForm({ ...editForm, priority_mode: e.target.value })
              }
            >
              <option value="immediate">
                Immédiat — prioritaire passe devant
              </option>
              <option value="weighted">
                Pondéré — ratio N normal / 1 prioritaire
              </option>
              <option value="disabled">Désactivé — FIFO pur</option>
            </select>
          </div>
          {editForm.priority_mode === "weighted" && (
            <div>
              <label className="text-sm font-medium text-foreground">
                Ratio (N normal → 1 prio)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                className="w-full rounded-md border-border bg-background px-3 py-2 text-sm"
                value={editForm.priority_weighted_ratio}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    priority_weighted_ratio: Number(e.target.value),
                  })
                }
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground">
              Délai de priorité (min)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              placeholder="Par défaut (10 min)"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.call_timeout_minutes ?? ""}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  call_timeout_minutes:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Délai accordé après l'appel d'un ticket avant marquage absent
              automatique.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Tentatives max
            </label>
            <input
              type="number"
              min={1}
              max={10}
              placeholder="2"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.max_call_attempts}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  max_call_attempts: Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nombre d'absences avant expiration définitive du ticket.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              Délai de présentation (min)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              placeholder="10"
              className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              value={editForm.en_route_grace_minutes}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  en_route_grace_minutes: Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Délai accordé à l'usager pour se présenter après confirmation "En
              route".
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-md transition-collors"
            onClick={() => setOpenEdit(false)}
          >
            Annuler
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
            onClick={updateService}
          >
            Enregistrer
          </button>
        </div>
      </Modal>

      {/* Modal Horaires / Jours ouvrables / Exceptions */}
      <ServiceScheduleModal
        open={openSchedule}
        onClose={() => {
          setOpenSchedule(false);
          setScheduleServiceId(null);
          load();
        }}
        serviceId={scheduleServiceId}
      />

      {/* Modal Alertes sonores */}
      <ServiceSoundModal
        open={openSound}
        onClose={() => {
          setOpenSound(false);
          setSoundService(null);
        }}
        serviceId={soundService?.id ?? null}
        serviceName={soundService?.name}
      />

      {/* Modal QR Code */}
      <Modal
        open={openQr}
        onClose={() => setOpenQr(false)}
        title={`QR Code - ${qrService?.name ?? ""}`}
      >
        <div className="flex flex-col items-center space-y-4">
          {qrLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : qrService?.qr_code_url ? (
            <>
              <img
                src={qrService.qr_code_url}
                alt={`QR Code ${qrService.name}`}
                className="w-48 h-48 object-contain border border-border rounded-lg"
              />
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {qrService.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {qrService.establishment?.name}
                </p>
                {qrService.qr_generated_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Généré le{" "}
                    {new Date(qrService.qr_generated_at).toLocaleDateString(
                      "fr-FR",
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
                  onClick={() => generateQrCode(qrService)}
                >
                  <QrCode className="h-4 w-4" />
                  Régénérer
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-md transition-colors"
                  onClick={() => downloadQrCode(qrService)}
                >
                  <Download className="h-4 w-4" />
                  Télécharger PDF
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Ce QR code est permanent. Il encode: vqs://service/
                {qrService.qr_code_token?.substring(0, 8)}...
              </p>
            </>
          ) : (
            <div className="text-center py-8">
              <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun QR code généré</p>
              <button
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
                onClick={() => qrService && generateQrCode(qrService)}
              >
                <QrCode className="h-4 w-4" />
                Générer le QR code
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
