import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/axios";
import { useAppDispatch, useAppSelector } from "@/store";
import { refreshMe } from "@/store/authSlice";
import { toast } from "sonner";

export default function SetupEstablishment() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sans coordonnées, l'établissement n'apparaît pas dans la recherche « à proximité »
  // de l'application mobile (elles restent modifiables dans Paramètres).
  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur ce navigateur");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Number(pos.coords.latitude.toFixed(7)), lng: Number(pos.coords.longitude.toFixed(7)) });
        setLocating(false);
      },
      () => {
        toast.error("Position refusée ou indisponible");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  useEffect(() => {
    if (!user) return;
    // Attendre que le state soit complètement chargé
    if (user.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    // Ne rediriger que si l'utilisateur a déjà un établissement
    if (user.establishment_id) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/admin/establishments", {
        name,
        address: address || null,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      await dispatch(refreshMe());
      toast.success("Établissement créé");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          "Erreur de création",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl flex flex-col h-screen items-center justify-center mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-blue-500">
          Bienvenue sur SmartQueue
        </h1>
        <p className="text-sm text-muted-foreground">
          Créer votre premier établissement pour commencer
        </p>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-5">
        <h1 className="text-lg font-semibold text-foreground">
          Créer votre établissement
        </h1>
        <p className="text-sm text-muted-foreground">
          Dernière étape avant d'accéder au dashboard admin.
        </p>
      </div>

      <div className="bg-card rounded-xl shadow-lg border border-border p-5 space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Nom</label>
          <input
            className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">
            Adresse (optionnel)
          </label>
          <input
            className="w-full rounded-md border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Position (recommandé)</label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              onClick={locate}
              disabled={locating}
            >
              {locating ? "Localisation…" : "Utiliser ma position actuelle"}
            </button>
            <span className="text-sm text-muted-foreground">
              {coords ? `${coords.lat}, ${coords.lng}` : "Non renseignée"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Faites-le depuis l'établissement : les usagers le trouveront dans la recherche à proximité de l'application.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
