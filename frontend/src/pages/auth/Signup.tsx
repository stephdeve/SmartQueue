import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { signup } from "@/store/authSlice";
import { Navigate, Link } from "react-router-dom";
import { Lock, Mail, User, Phone, AlertCircle, Building, Eye, EyeOff, MapPin, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { signupSchema, type SignupFormData } from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";

export default function Signup() {
  const dispatch = useAppDispatch();
  const { token, loading } = useAppSelector((s) => s.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [step, setStep] = useState(1);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [establishmentName, setEstablishmentName] = useState("");
  const [establishmentAddress, setEstablishmentAddress] = useState("");

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
  });

  const watchedPassword = watch("password");

  const handleCoordinateChange = (lat: number, lng: number) => {
    setCoordinates({ lat, lng });
    setValue("establishment_lat" as any, lat);
    setValue("establishment_lng" as any, lng);
  };

  if (token) return <Navigate to="/dashboard" replace />;

  const handleNext = async () => {
    const fields = step === 1
      ? ["name", "email", "phone", "password", "password_confirmation"]
      : [];
    const valid = await trigger(fields as any);
    if (valid) setStep(2);
  };

  const handlePrev = () => setStep(1);

  const onSubmit = async (data: SignupFormData) => {
    try {
      await dispatch(signup({
        name: data.name!,
        email: data.email!,
        password: data.password!,
        password_confirmation: data.password_confirmation!,
        phone: data.phone,
        establishment_name: establishmentName || undefined,
        establishment_address: establishmentAddress || undefined,
        establishment_lat: coordinates?.lat,
        establishment_lng: coordinates?.lng,
      } as any)).unwrap();
      toast.success("Compte créé avec succès !");
      window.location.href = "/subscription";
    } catch (error: any) {
      const status = error?.status;
      if (status === 422) {
        toast.error("Données invalides. Veuillez vérifier les champs.");
      } else if (status === 409) {
        toast.error("Un compte avec cet email existe déjà.");
      } else if (status >= 500) {
        toast.error("Erreur serveur. Veuillez réessayer plus tard.");
      } else {
        toast.error("Erreur d'inscription. Veuillez réessayer.");
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
            Créer votre compte établissement
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Commencez avec SmartQueue pour votre entreprise
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              step >= 1 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
            )}>
              {step > 1 ? <Check className="h-4 w-4" /> : 1}
            </div>
            <span className={cn("text-sm font-medium", step >= 1 ? "text-foreground" : "text-muted-foreground")}>
              Compte
            </span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              step >= 2 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
            )}>
              2
            </div>
            <span className={cn("text-sm font-medium", step >= 2 ? "text-foreground" : "text-muted-foreground")}>
              Établissement
            </span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <form onSubmit={handleSubmit(onSubmit)}>
            {step === 1 && (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                      Nom de l'administrateur
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="name"
                        {...register("name")}
                        type="text"
                        className={cn(
                          "focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground",
                          errors.name && "border-red-500 focus:ring-red-500 focus:border-red-500",
                        )}
                        placeholder="Jean Dupont"
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
                      Téléphone (optionnel)
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="phone"
                        {...register("phone")}
                        type="tel"
                        className="focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground"
                        placeholder="+229 01 00 00 00 00"
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                    Email de l'administrateur
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="email"
                      {...register("email")}
                      type="email"
                      autoComplete="email"
                      className={cn(
                        "focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground",
                        errors.email && "border-red-500 focus:ring-red-500 focus:border-red-500",
                      )}
                      placeholder="admin@entreprise.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                      Mot de passe
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="password"
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className={cn(
                          "focus:ring-primary focus:border-primary block w-full pl-10 pr-10 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground",
                          errors.password && "border-red-500 focus:ring-red-500 focus:border-red-500",
                        )}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.message}
                      </p>
                    )}
                    {watchedPassword && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className={cn(
                            "w-16 h-1 rounded",
                            watchedPassword.length >= 8 ? "bg-green-500" : "bg-gray-300",
                          )} />
                          <span className="text-muted-foreground">
                            {watchedPassword.length >= 8 ? "Sécurisé" : "8 caractères min."}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password_confirmation" className="block text-sm font-medium text-foreground mb-1">
                      Confirmer le mot de passe
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="password_confirmation"
                        {...register("password_confirmation")}
                        type={showPasswordConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        className={cn(
                          "focus:ring-primary focus:border-primary block w-full pl-10 pr-10 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground",
                          errors.password_confirmation && "border-red-500 focus:ring-red-500 focus:border-red-500",
                        )}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswordConfirm ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </div>
                    {errors.password_confirmation && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password_confirmation.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="border-b border-border pb-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations de l'établissement (optionnel)
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vous pourrez compléter ces informations plus tard
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="establishment_name" className="block text-sm font-medium text-foreground mb-1">
                      Nom de l'établissement
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="establishment_name"
                        type="text"
                        value={establishmentName}
                        onChange={(e) => setEstablishmentName(e.target.value)}
                        className="focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground"
                        placeholder="Mon Établissement"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="establishment_address" className="block text-sm font-medium text-foreground mb-1">
                      Adresse
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="establishment_address"
                        type="text"
                        value={establishmentAddress}
                        onChange={(e) => setEstablishmentAddress(e.target.value)}
                        className="focus:ring-primary focus:border-primary block w-full pl-10 pr-3 py-2.5 sm:text-sm border-border bg-background rounded-md placeholder:text-muted-foreground"
                        placeholder="123 Rue Example, Ville"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Coordonnées GPS (cliquez sur la carte ou saisissez manuellement)
                  </label>

                  <div
                    className="w-full h-48 bg-gray-100 rounded-md border border-border relative overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      const lat = 6.37 - (y / rect.height) * 0.1;
                      const lng = 2.3 + (x / rect.width) * 0.1;
                      handleCoordinateChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
                    }}
                  >
                    {coordinates ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                          <p className="text-sm font-medium text-foreground">
                            Lat: {coordinates.lat.toFixed(6)}
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            Lng: {coordinates.lng.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <MapPin className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">Cliquez pour définir la position</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label htmlFor="lat" className="block text-xs text-muted-foreground mb-1">
                        Latitude
                      </label>
                      <input
                        id="lat"
                        type="number"
                        step="0.000001"
                        min="-90"
                        max="90"
                        value={coordinates?.lat || ""}
                        onChange={(e) => {
                          const lat = parseFloat(e.target.value);
                          if (!isNaN(lat)) {
                            handleCoordinateChange(lat, coordinates?.lng || 0);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-sm border border-border bg-background rounded-md"
                        placeholder="6.370000"
                      />
                    </div>
                    <div>
                      <label htmlFor="lng" className="block text-xs text-muted-foreground mb-1">
                        Longitude
                      </label>
                      <input
                        id="lng"
                        type="number"
                        step="0.000001"
                        min="-180"
                        max="180"
                        value={coordinates?.lng || ""}
                        onChange={(e) => {
                          const lng = parseFloat(e.target.value);
                          if (!isNaN(lng)) {
                            handleCoordinateChange(coordinates?.lat || 0, lng);
                          }
                        }}
                        className="w-full px-3 py-1.5 text-sm border border-border bg-background rounded-md"
                        placeholder="2.340000"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    required
                    className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                  />
                  <label htmlFor="terms" className="ml-2 block text-sm text-foreground">
                    J'accepte les{" "}
                    <a href="#" className="text-blue-600 hover:text-blue-500">
                      conditions d'utilisation
                    </a>{" "}
                    et la{" "}
                    <a href="#" className="text-blue-600 hover:text-blue-500">
                      politique de confidentialité
                    </a>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-2 py-2.5 px-6 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                      loading && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Création...
                      </>
                    ) : (
                      "Créer mon compte"
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">
                  <span className="text-xs">DÉJÀ UN COMPTE ?</span>
                </span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 text-sm">
                Se connecter à un compte existant
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
