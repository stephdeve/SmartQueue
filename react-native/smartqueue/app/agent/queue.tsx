import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  Platform,
  StatusBar,
  useWindowDimensions,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useCustomAlert } from "../../src/hooks/useCustomAlert";
import axiosClient from "../../src/api/axiosClient";
import { useFocusEffect } from "@react-navigation/native";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

(window as any).Pusher = Pusher;

type Ticket = {
  id: number;
  number: string;
  status: string;
  position?: number | null;
  priority: string;
  priority_reason?: string | null;
  source?: string | null;
  display_name?: string | null;
  customer_name?: string | null;
  is_senior?: boolean;
  is_handicap?: boolean;
  is_pregnant?: boolean;
  created_at: string;
  called_at?: string;
  called_expires_at?: string | null;
  en_route_at?: string | null;
  present_at?: string | null;
  response_received_at?: string | null;
  en_route_expires_at?: string | null;
  estimated_travel_minutes?: number | null;
  last_distance_m?: number | null;
  eta_minutes?: number | null;
  auto_deferred?: boolean;
  defer_reason?: string | null;
  valid_date?: string | null;
  absent_level?: number;
  absent_expires_at?: string | null;
};

type ServiceStats = {
  waiting: number;
  processed: number;
  avg_wait_time: number;
};

type SmartQueueData = {
  critical_zone: boolean;
  intelligent_cutoff_at: string | null;
  waiting_count_today: number;
  estimated_load_minutes: number;
  is_open_now: boolean;
  closing_time: string | null;
  reason_if_closed: string | null;
};

type DeferredDay = {
  date: string;
  count: number;
  tickets: Ticket[];
};

type ThemeColors = ReturnType<typeof useThemeColors>;

type CreateTicketForm = {
  priority: "normal" | "high" | "vip" | "urgence";
  priority_reason: string;
  customer_name: string;
  customer_phone: string;
  is_senior: boolean;
  is_handicap: boolean;
  is_pregnant: boolean;
};

// Fonction pour formater la date avec gestion du fuseau horaire
function parseServerDate(dateStr: string): Date {
  // Si la date a un fuseau horaire UTC explicite
  if (dateStr.includes('Z') || dateStr.includes('+')) {
    return new Date(dateStr);
  }
  // Si la date est au format UTC sans Z (ex: "2024-01-15 10:30:00")
  // On ajoute 'Z' pour indiquer UTC
  if (dateStr.includes(' ') && !dateStr.includes('T')) {
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  }
  return new Date(dateStr);
}

function timeAgo(dateStr: string): string {
  try {
    const date = parseServerDate(dateStr);
    const now = new Date();
    const mins = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `il y a ${h}h${m}` : `il y a ${h}h`;
  } catch {
    return "--";
  }
}

function fmtTime(dateStr?: string | null): string {
  if (!dateStr) return "--";
  try {
    const date = parseServerDate(dateStr);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--";
  }
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "--";
  try {
    const date = parseServerDate(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

function fmtCutoff(iso?: string | null): string {
  if (!iso) return "--";
  try {
    const date = parseServerDate(iso);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--";
  }
}

const PRIORITY_CFG: Record<string, { color: string; label: string }> = {
  urgence: { color: "#FF3B30", label: "URG" },
  vip:     { color: "#8B5CF6", label: "VIP" },
  high:    { color: "#FF9500", label: "PRIO" },
  normal:  { color: "#8E8E93", label: "STD" },
};

const SOURCE_ICON: Record<string, string> = {
  app:     "phone-portrait-outline",
  qr_scan: "qr-code-outline",
  agent:   "person-circle-outline",
  kiosk:   "desktop-outline",
  sms:     "chatbubble-outline",
};

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  waiting: { color: "#007AFF", label: "Attente" },
  called: { color: "#34C759", label: "Appelé" },
  absent: { color: "#FF3B30", label: "Absent" },
  en_route: { color: "#FF9500", label: "En route" },
  present: { color: "#34C759", label: "Présent" },
};

const KpiPill = ({ icon, label, value, accent, colors }: any) => (
  <View style={[styles.kpiPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={[styles.kpiIcon, { backgroundColor: accent + "1A" }]}>
      <Ionicons name={icon} size={14} color={accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.kpiValue, { color: accent }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </View>
  </View>
);

const SmartQueueBanner = ({ data, colors }: { data: SmartQueueData; colors: ThemeColors }) => {
  if (data.critical_zone) {
    return (
      <View style={[styles.bannerWarning, { backgroundColor: "#FF3B300F", borderColor: "#FF3B3030" }]}>
        <View style={styles.bannerIconWarning}>
          <Ionicons name="warning" size={16} color="#FF3B30" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitleWarning}>Zone critique — file saturée</Text>
          <Text style={styles.bannerSubWarning}>Les nouveaux tickets sont automatiquement reportés</Text>
        </View>
      </View>
    );
  }

  const loadH = Math.floor(data.estimated_load_minutes / 60);
  const loadM = data.estimated_load_minutes % 60;
  const loadLabel = data.estimated_load_minutes <= 0 ? "—" : loadH > 0 ? `${loadH}h${loadM > 0 ? loadM + "min" : ""}` : `${loadM}min`;
  const cutoffLabel = fmtCutoff(data.intelligent_cutoff_at);

  return (
    <View style={[styles.bannerNormal, { backgroundColor: "#34C7590F", borderColor: "#34C75930" }]}>
      <View style={styles.bannerIconNormal}>
        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitleNormal}>Capacité normale</Text>
        <Text style={[styles.bannerSubNormal, { color: colors.textSecondary }]}>
          Charge estimée : {loadLabel} · Coupure à {cutoffLabel}
        </Text>
      </View>
      {data.intelligent_cutoff_at && (
        <View style={styles.bannerChip}>
          <Text style={styles.bannerChipText}>{cutoffLabel}</Text>
        </View>
      )}
    </View>
  );
};

function useCountdown(expiresAt?: string | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) { setSeconds(null); return; }
    // DB timestamps lack ms precision; add 1s grace to avoid false 0
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() + 1000 - Date.now()) / 1000));
    setSeconds(calc());
    const id = setInterval(() => setSeconds(calc()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return seconds;
}

function fmtCountdown(s: number): string {
  if (s <= 0) return "Expiré";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `0:${sec.toString().padStart(2, "0")}`;
}

const CurrentTicketCard = ({ ticket, onRecall, onAbsent, onClose, isActing, colors }: any) => {
  const statusCfg = STATUS_CFG[ticket.status] ?? { color: "#007AFF", label: ticket.status };

  const calledCountdown = useCountdown(ticket.status === "called" ? ticket.called_expires_at : null);
  const enRouteCountdown = useCountdown(ticket.status === "en_route" ? ticket.en_route_expires_at : null);

  const absentLevel = ticket.absent_level ?? 0;
  const maxAttempts = ticket.max_call_attempts ?? 2;
  const isAbsentDefinitive = ticket.status === "absent" && absentLevel >= maxAttempts;
  const isNonDefinitiveAbsent = ticket.status === "absent" && absentLevel > 0 && absentLevel < maxAttempts;
  const recallDisabled = isActing || isAbsentDefinitive || ticket.status === "waiting";
  const absentDisabled = isActing || isAbsentDefinitive || (ticket.status !== "called" && !isNonDefinitiveAbsent);
  const absentBtnColor = isNonDefinitiveAbsent ? "rgba(228, 37, 26, 0.95)" : "rgba(255, 149, 0, 0.9)";

  let statusLine = "";
  if (ticket.status === "present") statusLine = "Usager présent";
  else if (ticket.en_route_at) {
    const travelPart = ticket.estimated_travel_minutes ? `≈ ${ticket.estimated_travel_minutes} min` : null;
    const distPart = ticket.last_distance_m != null ? `${(ticket.last_distance_m / 1000).toFixed(1)} km` : null;
    const details = [travelPart, distPart].filter(Boolean).join(" · ");
    statusLine = details ? `En route · ${details}` : "En route — réponse reçue";
  }
  else if (ticket.called_at) statusLine = `Appelé à ${fmtTime(ticket.called_at)}`;

  const isCalledExpiring = calledCountdown !== null && calledCountdown <= 30;
  const isEnRouteExpiring = enRouteCountdown !== null && enRouteCountdown <= 60;

  return (
    <View style={[styles.currentCard, { backgroundColor: "#1558CC" }]}>
      <View style={styles.currentRow}>
        <View style={styles.currentIcon}>
          <Ionicons name="megaphone" size={18} color="#FFF" />
        </View>
        <View style={styles.currentNumberContainer}>
          <Text style={styles.currentNumber}>{ticket.number}</Text>
          <View style={styles.currentStatusBadge}>
            <Text style={styles.currentStatusText}>{statusCfg.label.toUpperCase()}</Text>
          </View>
        </View>
        {/* Absent level badge */}
        {absentLevel > 0 && (
          <View style={[styles.countdownBadge, { backgroundColor: isAbsentDefinitive ? "rgba(228,37,26,0.9)" : "rgba(255,149,0,0.9)" }]}>
            <Ionicons name="person-remove" size={11} color="#FFF" />
            <Text style={styles.countdownText}>{isAbsentDefinitive ? "Absence définitive" : "Rappel disponible"}</Text>
          </View>
        )}
        {/* Countdown badge */}
        {ticket.status === "called" && calledCountdown !== null && (
          <View style={[styles.countdownBadge, { backgroundColor: isCalledExpiring ? "rgba(255,59,48,0.9)" : "rgba(255,255,255,0.2)" }]}>
            <Ionicons name="timer-outline" size={11} color="#FFF" />
            <Text style={styles.countdownText}>{fmtCountdown(calledCountdown)}</Text>
          </View>
        )}
        {ticket.status === "en_route" && enRouteCountdown !== null && (
          <View style={[styles.countdownBadge, { backgroundColor: isEnRouteExpiring ? "rgba(255,59,48,0.9)" : "rgba(255,149,0,0.7)" }]}>
            <Ionicons name="walk-outline" size={11} color="#FFF" />
            <Text style={styles.countdownText}>{fmtCountdown(enRouteCountdown)}</Text>
          </View>
        )}
      </View>
      {statusLine !== "" && <Text style={styles.currentStatusLine}>{statusLine}</Text>}
      <View style={styles.currentActions}>
        <TouchableOpacity style={[styles.currentActionBtn, { opacity: recallDisabled ? 0.5 : 1 }]} onPress={onRecall} disabled={recallDisabled}>
          <Ionicons name="volume-high" size={14} color="#FFF" />
          <Text style={styles.currentActionText}>Rappel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.currentActionBtn, { backgroundColor: absentBtnColor, opacity: absentDisabled ? 0.5 : 1 }]} onPress={onAbsent} disabled={absentDisabled}>
          <Ionicons name="person-remove" size={14} color="#FFF" />
          <Text style={styles.currentActionText}>Absent</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.currentActionBtn, { backgroundColor: "rgba(32, 230, 82, 0.89)" }]} onPress={onClose} disabled={isActing}>
          <Ionicons name="checkmark-circle" size={14} color="#FFF" />
          <Text style={styles.currentActionText}>Servi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// TicketRow complètement refait pour meilleur alignement
const TicketRow = ({ item, index, colors, onAbsent, onPress }: any) => {
  const prio = PRIORITY_CFG[item.priority] ?? PRIORITY_CFG.normal;
  const statusCfg = STATUS_CFG[item.status] ?? { color: "#8E8E93", label: item.status };
  const etaLabel = typeof item.eta_minutes === "number" && item.eta_minutes > 0 ? `≈ ${item.eta_minutes}min` : null;
  const sourceIcon = item.source ? (SOURCE_ICON[item.source] ?? "help-circle-outline") : null;
  
  // Attributs spéciaux
  const specialAttrs = [];
  if (item.is_senior) specialAttrs.push({ icon: "accessibility-outline", color: "#007AFF" });
  if (item.is_handicap) specialAttrs.push({ icon: "heart-outline", color: "#8B5CF6" });
  if (item.is_pregnant) specialAttrs.push({ icon: "body-outline", color: "#FF6B9D" });

  return (
    <TouchableOpacity
      style={[styles.ticketRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      {/* Position avec badge priorité */}
      <View style={[styles.ticketPosition, { backgroundColor: prio.color + "18", borderColor: prio.color + "40" }]}>
        <Text style={[styles.ticketPositionText, { color: prio.color }]}>{item.position ?? index + 1}</Text>
      </View>
      
      {/* Contenu principal */}
      <View style={styles.ticketContent}>
        {/* Ligne 1 : Numéro + Badges */}
        <View style={styles.ticketHeaderRow}>
          <Text style={[styles.ticketNumber, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.number}
          </Text>
          <View style={[styles.ticketPriorityBadge, { backgroundColor: prio.color + "20" }]}>
            <Text style={[styles.ticketPriorityText, { color: prio.color }]}>{prio.label}</Text>
          </View>
          {etaLabel && (
            <View style={styles.ticketEtaBadge}>
              <Ionicons name="time-outline" size={10} color="#007AFF" />
              <Text style={styles.ticketEtaText}>{etaLabel}</Text>
            </View>
          )}
        </View>
        
        {/* Ligne 2 : Infos supplémentaires */}
        <View style={styles.ticketMetaRow}>
          {/* Icône source */}
          {sourceIcon && (
            <View style={styles.ticketSourceIcon}>
              <Ionicons name={sourceIcon as any} size={12} color={colors.textSecondary} />
            </View>
          )}
          
          {/* Attributs spéciaux */}
          {specialAttrs.length > 0 && (
            <View style={styles.ticketAttrs}>
              {specialAttrs.map((attr, idx) => (
                <View key={idx} style={styles.ticketAttrIcon}>
                  <Ionicons name={attr.icon as any} size={12} color={attr.color} />
                </View>
              ))}
            </View>
          )}
          
          {/* Date de création */}
          <Text style={[styles.ticketMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {fmtTime(item.created_at)} · {timeAgo(item.created_at)}
          </Text>
        </View>
        
        {/* Ligne 3 : Nom du client (si disponible) */}
        {(item.display_name || item.customer_name) && (
          <Text style={[styles.ticketCustomer, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.display_name || item.customer_name}
          </Text>
        )}
      </View>
      
      {/* Statut et action */}
      <View style={styles.ticketActions}>
        <View style={[styles.ticketStatusBadge, { backgroundColor: statusCfg.color + "18", borderColor: statusCfg.color + "35" }]}>
          <Text style={[styles.ticketStatusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
        {item.absent_level != null && item.absent_level > 0 && (
          <View style={[styles.ticketStatusBadge, { backgroundColor: (item.absent_level ?? 0) >= (item.max_call_attempts ?? 2) ? "#EF444418" : "#FF950018", borderColor: (item.absent_level ?? 0) >= (item.max_call_attempts ?? 2) ? "#EF444440" : "#FF950040", marginTop: 4 }]}>
            <Text style={[styles.ticketStatusText, { color: (item.absent_level ?? 0) >= (item.max_call_attempts ?? 2) ? "#EF4444" : "#FF9500", fontSize: 9 }]}>
              {(item.absent_level ?? 0) >= (item.max_call_attempts ?? 2) ? "Absence définitive" : "Rappel disponible"}
            </Text>
          </View>
        )}
        <TouchableOpacity 
          style={[styles.ticketAbsentBtn, { borderColor: "#FF3B3028" }]} 
          onPress={() => onAbsent(item.id, item.number, item.absent_level ?? 0)}
        >
          <Ionicons name="person-remove-outline" size={16} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ─── Checkbox row ─────────────────────────────────────────────────────────────
const CheckRow = ({ label, icon, checked, onToggle, colors }: { label: string; icon: string; checked: boolean; onToggle: () => void; colors: ThemeColors }) => (
  <TouchableOpacity style={[cmStyles.checkRow, { borderColor: checked ? "#007AFF40" : colors.border, backgroundColor: checked ? "#007AFF08" : colors.surface }]} onPress={onToggle} activeOpacity={0.7}>
    <View style={[cmStyles.checkIcon, { backgroundColor: checked ? "#007AFF18" : colors.border + "40" }]}>
      <Ionicons name={icon as any} size={16} color={checked ? "#007AFF" : colors.textSecondary} />
    </View>
    <Text style={[cmStyles.checkLabel, { color: colors.textPrimary }]}>{label}</Text>
    <View style={[cmStyles.checkbox, { borderColor: checked ? "#007AFF" : colors.border, backgroundColor: checked ? "#007AFF" : "transparent" }]}>
      {checked && <Ionicons name="checkmark" size={12} color="#FFF" />}
    </View>
  </TouchableOpacity>
);

// ─── Priority selector ────────────────────────────────────────────────────────
const PRIO_OPTIONS: { value: CreateTicketForm["priority"]; label: string; color: string; icon: string }[] = [
  { value: "normal",  label: "Normal",      color: "#8E8E93", icon: "list-outline" },
  { value: "high",    label: "Prioritaire", color: "#FF9500", icon: "flame-outline" },
  { value: "vip",     label: "VIP",         color: "#8B5CF6", icon: "star-outline" },
  { value: "urgence", label: "Urgence",     color: "#FF3B30", icon: "alert-circle-outline" },
];

const PrioritySelector = ({ value, onChange, colors }: { value: string; onChange: (v: CreateTicketForm["priority"]) => void; colors: ThemeColors }) => (
  <View style={cmStyles.prioRow}>
    {PRIO_OPTIONS.map((opt) => {
      const active = value === opt.value;
      return (
        <TouchableOpacity
          key={opt.value}
          style={[cmStyles.prioBtn, { borderColor: active ? opt.color : colors.border, backgroundColor: active ? opt.color + "18" : colors.surface }]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Ionicons name={opt.icon as any} size={16} color={active ? opt.color : colors.textSecondary} />
          <Text style={[cmStyles.prioBtnText, { color: active ? opt.color : colors.textSecondary, fontWeight: active ? "700" : "500" }]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─── Modal de création ────────────────────────────────────────────────────────
const CreateTicketModal = ({
  visible, onClose, form, setForm, onSubmit, isCreating, colors,
}: {
  visible: boolean;
  onClose: () => void;
  form: CreateTicketForm;
  setForm: React.Dispatch<React.SetStateAction<CreateTicketForm>>;
  onSubmit: () => void;
  isCreating: boolean;
  colors: ThemeColors;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <TouchableOpacity style={cmStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[cmStyles.sheet, { backgroundColor: colors.background }]}>
        {/* Drag handle */}
        <View style={[cmStyles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[cmStyles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[cmStyles.sheetTitle, { color: colors.textPrimary }]}>Créer un ticket</Text>
            <Text style={[cmStyles.sheetSub, { color: colors.textSecondary }]}>Création manuelle par l’agent</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={cmStyles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={cmStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Type de ticket */}
          <Text style={[cmStyles.sectionLabel, { color: colors.textSecondary }]}>Type de ticket</Text>
          <PrioritySelector value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))} colors={colors} />

          {/* Note de priorité (optionnel, si priorité > normal) */}
          {form.priority !== "normal" && (
            <>
              <Text style={[cmStyles.sectionLabel, { color: colors.textSecondary }]}>Note (optionnel)</Text>
              <View style={[cmStyles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <TextInput
                  style={[cmStyles.input, { color: colors.textPrimary }]}
                  placeholder="Ex. patient avec mobilité réduite..."
                  placeholderTextColor={colors.textSecondary}
                  value={form.priority_reason}
                  onChangeText={(v) => setForm(f => ({ ...f, priority_reason: v }))}
                />
              </View>
            </>
          )}

          {/* Nom du client */}
          <Text style={[cmStyles.sectionLabel, { color: colors.textSecondary }]}>Nom du client</Text>
          <View style={[cmStyles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={[cmStyles.input, { color: colors.textPrimary }]}
              placeholder="Nom complet"
              placeholderTextColor={colors.textSecondary}
              value={form.customer_name}
              onChangeText={(v) => setForm(f => ({ ...f, customer_name: v }))}
            />
          </View>

          {/* Téléphone */}
          <Text style={[cmStyles.sectionLabel, { color: colors.textSecondary }]}>Téléphone</Text>
          <View style={[cmStyles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={[cmStyles.input, { color: colors.textPrimary }]}
              placeholder="+229 01 00 00 00 00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={form.customer_phone}
              onChangeText={(v) => setForm(f => ({ ...f, customer_phone: v }))}
            />
          </View>

          {/* Attributs spéciaux */}
          <Text style={[cmStyles.sectionLabel, { color: colors.textSecondary }]}>Attributs spéciaux</Text>
          <CheckRow label="Senior" icon="accessibility-outline" checked={form.is_senior} onToggle={() => setForm(f => ({ ...f, is_senior: !f.is_senior }))} colors={colors} />
          <CheckRow label="Handicap" icon="body-outline" checked={form.is_handicap} onToggle={() => setForm(f => ({ ...f, is_handicap: !f.is_handicap }))} colors={colors} />
          <CheckRow label="Femme enceinte" icon="heart-outline" checked={form.is_pregnant} onToggle={() => setForm(f => ({ ...f, is_pregnant: !f.is_pregnant }))} colors={colors} />
        </ScrollView>

        {/* Actions */}
        <View style={[cmStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity style={[cmStyles.cancelBtn, { borderColor: colors.border }]} onPress={onClose} disabled={isCreating}>
            <Text style={[cmStyles.cancelText, { color: colors.textSecondary }]}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cmStyles.submitBtn, { backgroundColor: isCreating ? "#007AFF80" : "#007AFF" }]}
            onPress={onSubmit}
            disabled={isCreating}
          >
            {isCreating ? (
              <Text style={cmStyles.submitText}>Création...</Text>
            ) : (
              <>
                <Ionicons name="add-circle" size={18} color="#FFF" />
                <Text style={cmStyles.submitText}>Créer le ticket</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const cmStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20, maxHeight: "90%" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetSub: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  prioRow: { flexDirection: "row", gap: 8 },
  prioBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10 },
  prioBtnText: { fontSize: 12 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  input: { flex: 1, fontSize: 14, padding: 0 },
  checkRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8, gap: 10 },
  checkIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  checkLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14, fontWeight: "600" },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, paddingVertical: 13 },
  submitText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});

export default function AgentQueue() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { AlertComponent, showSuccess, showWarning, showError } = useCustomAlert();
  const params = useLocalSearchParams<{ serviceId: string; counterId: string }>();
  const serviceId = params.serviceId;
  const counterId = params.counterId;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [smartQueue, setSmartQueue] = useState<SmartQueueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [clientProfileTicket, setClientProfileTicket] = useState<Ticket | null>(null);
  const [clientProfileData, setClientProfileData] = useState<any>(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);
  const [activities, setActivities] = useState<{ id: string; type: string; ticket_number: string; message: string; timestamp: Date }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTicketForm>({
    priority: "normal",
    priority_reason: "",
    customer_name: "",
    customer_phone: "",
    is_senior: false,
    is_handicap: false,
    is_pregnant: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [callTimeoutMinutes, setCallTimeoutMinutes] = useState<number | null>(null);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [timeoutInput, setTimeoutInput] = useState("");
  const [isUpdatingTimeout, setIsUpdatingTimeout] = useState(false);
  const [affluenceData, setAffluenceData] = useState<any>(null);
  const [showAffluenceSheet, setShowAffluenceSheet] = useState(false);
  const [queueTab, setQueueTab] = useState<"today" | "deferred">("today");
  const [deferredDays, setDeferredDays] = useState<DeferredDay[]>([]);
  const [deferredTotal, setDeferredTotal] = useState(0);
  const echoRef = useRef<any>(null);
  const hPad = width >= 768 ? 16 : 12;

  const fetchData = useCallback(async () => {
    if (!serviceId) return;
    try {
      const [queueRes, statsRes, serviceRes, availRes, deferredRes] = await Promise.all([
        axiosClient.get(`/services/${serviceId}/queue`),
        axiosClient.get(`/services/${serviceId}/affluence`),
        axiosClient.get(`/services/${serviceId}`),
        axiosClient.get(`/services/${serviceId}/availability`).catch(() => null),
        axiosClient.get(`/services/${serviceId}/deferred-queue`).catch(() => null),
      ]);

      const waitingTickets = (queueRes.data?.tickets || []).filter((t: Ticket) => t.status === "waiting");
      waitingTickets.sort((a: Ticket, b: Ticket) => (a.position ?? Infinity) - (b.position ?? Infinity));

      setTickets(waitingTickets);
      setFilteredTickets(waitingTickets);
      setAffluenceData(statsRes.data);
      setStats({
        waiting: statsRes.data?.people || 0,
        processed: statsRes.data?.processed || 0,
        avg_wait_time: statsRes.data?.eta_avg || statsRes.data?.average_wait_time || 0,
      });
      // GET /services/{id} renvoie une ressource enveloppée : { data: { ... } }
      const service = serviceRes.data?.data ?? serviceRes.data;
      setServiceStatus(service?.status || "open");
      setCallTimeoutMinutes(service?.call_timeout_minutes ?? null);
      setMaxCallAttempts(service?.max_call_attempts ?? 2);

      if (availRes?.data) {
        const cap = availRes.data.capacity ?? {};
        const avail = availRes.data.availability ?? {};
        setSmartQueue({
          critical_zone: cap.critical_zone ?? false,
          intelligent_cutoff_at: cap.intelligent_cutoff_at ?? null,
          waiting_count_today: cap.waiting_count_today ?? 0,
          estimated_load_minutes: cap.estimated_load_minutes ?? 0,
          is_open_now: avail.is_open_now ?? true,
          closing_time: avail.closing_time ?? null,
          reason_if_closed: avail.reason_if_closed ?? null,
        });
      }

      const calledTicket = (queueRes.data?.tickets || []).find(
        (t: Ticket) => t.status === "present" || t.status === "called" || t.status === "en_route"
      );
      setCurrentTicket(calledTicket || null);

      if (deferredRes?.data) {
        setDeferredDays(deferredRes.data.days ?? []);
        setDeferredTotal(deferredRes.data.total ?? 0);
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [serviceId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const connectRealtime = async () => {
        if (!serviceId || echoRef.current) return;
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return;

        const wsUrlStr = process.env.EXPO_PUBLIC_WS_URL || "wss://reverb-production-b4e5.up.railway.app";
        const isWss = wsUrlStr.startsWith("wss://");
        const hostWithoutScheme = wsUrlStr.replace("wss://", "").replace("ws://", "");
        const host = hostWithoutScheme.split(":")[0];

        const echo = new Echo({
          broadcaster: "reverb",
          key: process.env.EXPO_PUBLIC_REVERB_APP_KEY || "smartqueue_key",
          appid: process.env.EXPO_PUBLIC_REVERB_APP_ID || "smartqueue_id",
          wsHost: host,
          wsPort: isWss ? 443 : 80,
          wssPort: 443,
          forceTLS: isWss,
          enabledTransports: ["ws", "wss"],
          authorizer: (channel: any) => ({
            authorize: (socketId: string, callback: Function) => {
              axiosClient.post("/broadcasting/auth", { socket_id: socketId, channel_name: channel.name })
                .then((response) => callback(false, response.data))
                .catch((error) => callback(true, error));
            },
          }),
        });

        echoRef.current = echo;
        echo.join(`service.${serviceId}`)
          .listen(".user.en_route", (e: any) => { if (isActive) { fetchData(); addActivity('en_route', e?.ticket_number || '?', 'En route vers le guichet'); } })
          .listen(".service.ticket.called", (e: any) => { if (isActive) { fetchData(); addActivity('called', e?.ticket_number || '?', 'Appelé'); } })
          .listen(".service.ticket.absent", (e: any) => { if (isActive) { fetchData(); const level = e?.absent_level ?? 1; const max = e?.max_call_attempts ?? 2; addActivity('absent', e?.ticket_number || '?', level >= max ? 'Absence définitive' : 'Absence temporaire'); } })
          .listen(".service.ticket.served", (e: any) => { if (isActive) { fetchData(); addActivity('closed', e?.ticket_number || '?', 'Servi / Clôturé'); } })
          .listen(".service.stats.updated", () => { if (isActive) fetchData(); })
          // Délai de priorité / tentatives / délai de présentation modifiés (admin ou autre agent)
          .listen(".ServiceConfigUpdated", () => { if (isActive) fetchData(); })
          .listen(".service.ticket.enqueued", (e: any) => { if (isActive) { fetchData(); addActivity('enqueued', e?.ticket_number || '?', 'Nouveau ticket en file'); } });
      };
      connectRealtime();
      return () => {
        isActive = false;
        if (echoRef.current) { try { echoRef.current.leave(`service.${serviceId}`); echoRef.current.disconnect(); } catch {} echoRef.current = null; }
      };
    }, [serviceId, fetchData])
  );

  const addActivity = (type: string, ticketNumber: string, message: string) => {
    setActivities(prev => {
      const event = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, ticket_number: ticketNumber, message, timestamp: new Date() };
      const updated = [event, ...prev];
      return updated.length > 200 ? updated.slice(0, 200) : updated;
    });
  };

  const fetchClientProfile = async (ticket: Ticket) => {
    setClientProfileTicket(ticket);
    setClientProfileLoading(true);
    setClientProfileData(null);
    try {
      const { data } = await axiosClient.get(`/tickets/${ticket.id}/client-profile`);
      setClientProfileData(data);
    } catch (error: any) {
      // silent
    } finally {
      setClientProfileLoading(false);
    }
  };

  useEffect(() => {
    let items = tickets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(t =>
        t.number.toLowerCase().includes(q) ||
        (t.customer_name || "").toLowerCase().includes(q) ||
        String(t.position ?? "").includes(q)
      );
    }
    if (statusFilter.length > 0) {
      items = items.filter(t => statusFilter.includes(t.status));
    }
    if (priorityFilter.length > 0) {
      items = items.filter(t => priorityFilter.includes(t.priority));
    }
    setFilteredTickets(items);
  }, [searchQuery, tickets, statusFilter, priorityFilter]);

  const handleCallNext = async () => {
    if (!serviceId) return;
    setIsActing(true);
    try {
      const payload: any = {};
      if (counterId) payload.counter_id = parseInt(counterId);
      await axiosClient.post(`/services/${parseInt(serviceId)}/call-next`, payload);
      await fetchData();
      showSuccess("Appel réussi", "Prochain ticket appelé");
    } catch (error: any) {
      showError("Erreur", error?.response?.data?.message || "Erreur lors de l'appel");
    } finally { setIsActing(false); }
  };

  const [maxCallAttempts, setMaxCallAttempts] = useState(2);

  const handleMarkAbsent = async (ticketId: number, ticketNumber: string, currentAbsentLevel: number = 0) => {
    const nextLevel = currentAbsentLevel + 1;
    const maxAttempts = maxCallAttempts;
    const isDefinitive = nextLevel >= maxAttempts;
    const title = isDefinitive
      ? "Absence définitive"
      : `Marquer absent (${nextLevel}/${maxAttempts})`;
    const message = isDefinitive
      ? `Ticket ${ticketNumber} — Absence définitive. Le ticket sera supprimé automatiquement après expiration du délai.`
      : `Marquer le ticket ${ticketNumber} comme absent ? Un rappel sera possible (${nextLevel}/${maxAttempts}).`;
    const confirmLabel = isDefinitive ? "Absent définitif" : "Marquer absent";
    showWarning(title, message, confirmLabel, async () => {
      setIsActing(true);
      try {
        const res = await axiosClient.post(`/tickets/${ticketId}/mark-absent`);
        const level = res.data?.absent_level ?? nextLevel;
        if (level < maxAttempts) {
          showSuccess("Absence temporaire", `Ticket ${ticketNumber} — Absence ${level}/${maxAttempts}. Rappel possible.`);
        } else {
          showWarning("Absence définitive", `Ticket ${ticketNumber} — Absence définitive. Expiration automatique programmée.`);
        }
        await fetchData();
      } catch (error: any) { showError("Erreur", error?.response?.data?.message || "Erreur"); }
      finally { setIsActing(false); }
    }, "Annuler");
  };

  const handleRecall = async (ticketId: number) => {
    setIsActing(true);
    try {
      await axiosClient.post(`/tickets/${ticketId}/recall`);
      showSuccess("Rappel envoyé", "Client notifié");
    } catch (error: any) { showError("Erreur", error?.response?.data?.message || "Erreur"); }
    finally { setIsActing(false); }
  };

  const handleClose = async (ticketId: number) => {
    showWarning("Terminer", "Terminer ce service ?", "Terminer", async () => {
      setIsActing(true);
      try {
        await axiosClient.post(`/tickets/${ticketId}/close`);
        await fetchData();
        showSuccess("Terminé", "Ticket clôturé");
      } catch (error: any) { showError("Erreur", error?.response?.data?.message || "Erreur"); }
      finally { setIsActing(false); }
    }, "Annuler");
  };

  const handleOpenService = async () => {
    setIsActing(true);
    try {
      await axiosClient.post(`/services/${parseInt(serviceId || "0")}/open`);
      setServiceStatus("open");
      showSuccess("Succès", "Service ouvert");
    } catch (err: any) { showError("Erreur", err?.response?.data?.message || err?.message); }
    finally { setIsActing(false); }
  };

  const handleCloseService = async () => {
    setIsActing(true);
    try {
      await axiosClient.post(`/services/${parseInt(serviceId || "0")}/close`);
      setServiceStatus("closed");
      showSuccess("Succès", "Service fermé");
    } catch (err: any) { showError("Erreur", err?.response?.data?.message || err?.message); }
    finally { setIsActing(false); }
  };

  const handleUpdateTimeout = async () => {
    if (!serviceId) return;
    const parsed = timeoutInput.trim() === "" ? null : parseInt(timeoutInput, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 1 || parsed > 60)) {
      showError("Valeur invalide", "Le délai doit être compris entre 1 et 60 minutes.");
      return;
    }
    setIsUpdatingTimeout(true);
    try {
      await axiosClient.patch(`/services/${parseInt(serviceId)}/call-timeout`, {
        call_timeout_minutes: parsed,
      });
      setCallTimeoutMinutes(parsed);
      setShowTimeoutModal(false);
      showSuccess("Délai mis à jour", parsed ? `Délai de priorité : ${parsed} min` : "Délai par défaut rétabli");
    } catch (error: any) {
      showError("Erreur", error?.response?.data?.message || "Impossible de mettre à jour");
    } finally {
      setIsUpdatingTimeout(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!serviceId) return;
    setIsCreating(true);
    try {
      await axiosClient.post("/agent/tickets", {
        service_id: parseInt(serviceId),
        priority: createForm.priority,
        priority_reason: createForm.priority_reason.trim() || undefined,
        customer_name: createForm.customer_name.trim() || undefined,
        customer_phone: createForm.customer_phone.trim() || undefined,
        is_senior: createForm.is_senior,
        is_handicap: createForm.is_handicap,
        is_pregnant: createForm.is_pregnant,
      });
      setShowCreateModal(false);
      setCreateForm({ priority: "normal", priority_reason: "", customer_name: "", customer_phone: "", is_senior: false, is_handicap: false, is_pregnant: false });
      await fetchData();
      showSuccess("Ticket créé", "Le ticket a été ajouté à la file");
    } catch (error: any) {
      showError("Erreur", error?.response?.data?.message || "Impossible de créer le ticket");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="hourglass-outline" size={32} color={colors.textSecondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: hPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>File d’attente</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Service #{serviceId}{counterId ? ` · Guichet ${counterId}` : ""}
            {smartQueue?.closing_time ? ` · Ferme à ${fmtTime(smartQueue.closing_time)}` : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.timeoutBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => { setTimeoutInput(callTimeoutMinutes ? String(callTimeoutMinutes) : ""); setShowTimeoutModal(true); }}
        >
          <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.timeoutBtnText, { color: colors.textSecondary }]}>
            {callTimeoutMinutes ? `${callTimeoutMinutes}min` : "Délai"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.serviceToggle, { backgroundColor: serviceStatus === "open" ? "#34C759" : "#FF3B30", opacity: isActing ? 0.6 : 1 }]}
          onPress={() => serviceStatus === "open" ? handleCloseService() : handleOpenService()}
          disabled={isActing}
        >
          <Ionicons name={serviceStatus === "open" ? "checkmark-circle" : "close-circle"} size={12} color="#FFF" />
          <Text style={styles.serviceToggleText}>{serviceStatus === "open" ? "Ouvert" : "Fermé"}</Text>
        </TouchableOpacity>
      </View>

      {/* KPI en grille */}
      {stats && (
        <View style={[styles.kpiGrid, { paddingHorizontal: hPad, marginTop: 15 }]}>
          <View style={styles.kpiRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => affluenceData && setShowAffluenceSheet(true)} activeOpacity={0.7}>
            <KpiPill icon="people-outline" label="Attente" value={String(stats.waiting)} accent="#007AFF" colors={colors} />
          </TouchableOpacity>
            <KpiPill icon="checkmark-done-outline" label="Traités" value={String(stats.processed)} accent="#34C759" colors={colors} />
          </View>
          <View style={styles.kpiRow}>
            <KpiPill icon="timer-outline" label="Moyenne" value={stats.avg_wait_time > 0 ? `${Math.round(stats.avg_wait_time)}min` : "--"} accent="#FF9500" colors={colors} />
            {smartQueue && (
              <KpiPill
                icon={smartQueue.critical_zone ? "warning-outline" : "flash-outline"}
                label="Charge"
                value={smartQueue.estimated_load_minutes > 0
                  ? smartQueue.estimated_load_minutes >= 60
                    ? `${Math.floor(smartQueue.estimated_load_minutes / 60)}h${smartQueue.estimated_load_minutes % 60 > 0 ? (smartQueue.estimated_load_minutes % 60) + "m" : ""}`
                    : `${smartQueue.estimated_load_minutes}min`
                  : "—"}
                accent={smartQueue.critical_zone ? "#FF3B30" : "#8B5CF6"}
                colors={colors}
              />
            )}
          </View>
        </View>
      )}

      {smartQueue && serviceStatus === "open" && (
        <View style={{ paddingHorizontal: hPad, marginBottom: 6 }}>
          <SmartQueueBanner data={smartQueue} colors={colors} />
        </View>
      )}

      {currentTicket && (
        <View style={{ paddingHorizontal: hPad }}>
          <CurrentTicketCard
            ticket={currentTicket}
            onRecall={() => handleRecall(currentTicket.id)}
            onAbsent={() => handleMarkAbsent(currentTicket.id, currentTicket.number, currentTicket.absent_level ?? 0)}
            onClose={() => handleClose(currentTicket.id)}
            isActing={isActing}
            colors={colors}
          />
        </View>
      )}

      {/* Onglets File du jour / Reportés */}
      <View style={[styles.tabRow, { paddingHorizontal: hPad }]}>
        <TouchableOpacity
          style={[styles.tabBtn, queueTab === "today" && styles.tabBtnActive, { borderColor: queueTab === "today" ? "#007AFF" : colors.border }]}
          onPress={() => setQueueTab("today")}
        >
          <Ionicons name="today-outline" size={14} color={queueTab === "today" ? "#007AFF" : colors.textSecondary} />
          <Text style={[styles.tabBtnText, { color: queueTab === "today" ? "#007AFF" : colors.textSecondary }]}>File du jour</Text>
          {tickets.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: queueTab === "today" ? "#007AFF" : colors.border }]}>
              <Text style={[styles.tabBadgeText, { color: queueTab === "today" ? "#FFF" : colors.textSecondary }]}>{tickets.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, queueTab === "deferred" && styles.tabBtnDeferred, { borderColor: queueTab === "deferred" ? "#FF9500" : colors.border }]}
          onPress={() => setQueueTab("deferred")}
        >
          <Ionicons name="calendar-outline" size={14} color={queueTab === "deferred" ? "#FF9500" : colors.textSecondary} />
          <Text style={[styles.tabBtnText, { color: queueTab === "deferred" ? "#FF9500" : colors.textSecondary }]}>Reportés</Text>
          {deferredTotal > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: queueTab === "deferred" ? "#FF9500" : "#FF950020" }]}>
              <Text style={[styles.tabBadgeText, { color: queueTab === "deferred" ? "#FFF" : "#FF9500" }]}>{deferredTotal}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {queueTab === "today" ? (
        <>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: hPad }]}>
            <Ionicons name="search" size={15} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Rechercher..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={[styles.filterToggle, { backgroundColor: showFilters ? "#007AFF" : "transparent", borderColor: showFilters ? "#007AFF" : colors.border }]}
            >
              <Ionicons name="funnel" size={14} color={showFilters ? "#FFF" : colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {showFilters && (
            <View style={{ paddingHorizontal: hPad, marginBottom: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["waiting","called","en_route","present","absent"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s])}
                      style={[styles.filterChip, {
                        backgroundColor: statusFilter.includes(s) ? "#007AFF" : colors.surface,
                        borderColor: statusFilter.includes(s) ? "#007AFF" : colors.border,
                      }]}
                    >
                      <Text style={[styles.filterChipText, { color: statusFilter.includes(s) ? "#FFF" : colors.textSecondary }]}>
                        {s === "waiting" ? "Attente" : s === "called" ? "Appelé" : s === "en_route" ? "En route" : s === "present" ? "Présent" : "Absent"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["normal","high","vip","urgence"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p])}
                      style={[styles.filterChip, {
                        backgroundColor: priorityFilter.includes(p) ? "#007AFF" : colors.surface,
                        borderColor: priorityFilter.includes(p) ? "#007AFF" : colors.border,
                      }]}
                    >
                      <Text style={[styles.filterChipText, { color: priorityFilter.includes(p) ? "#FFF" : colors.textSecondary }]}>
                        {p === "urgence" ? "Urgence" : p === "vip" ? "VIP" : p === "high" ? "Prioritaire" : "Normal"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Fil d'activité */}
          {activities.length > 0 && (
            <View style={{ paddingHorizontal: hPad, marginBottom: 8 }}>
              <View style={[styles.activityFeed, { borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, paddingHorizontal: 8, paddingTop: 6 }}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.activityTitle, { color: colors.textSecondary }]}>Activité</Text>
                </View>
                <ScrollView style={{ maxHeight: 80 }} nestedScrollEnabled>
                  {activities.slice(0, 20).map((event) => (
                    <View key={event.id} style={styles.activityRow}>
                      <Text style={[styles.activityTime, { color: colors.textTertiary }]}>
                        {event.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <Text style={[styles.activityTicket, { color: colors.textPrimary }]}>#{event.ticket_number}</Text>
                      <Text style={[styles.activityMessage, { color: colors.textSecondary }]} numberOfLines={1}>{event.message}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          <FlatList
            data={filteredTickets}
            renderItem={({ item, index }) => <TicketRow item={item} index={index} colors={colors} onAbsent={handleMarkAbsent} onPress={fetchClientProfile} />}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 6, paddingBottom: serviceStatus === "open" ? 200 : 24, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            showsVerticalScrollIndicator={true}
            ListHeaderComponent={filteredTickets.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={[styles.listHeaderTitle, { color: colors.textSecondary }]}>File du jour</Text>
                <View style={[styles.listHeaderBadge, { backgroundColor: smartQueue?.critical_zone ? "#FF3B3018" : "#007AFF18" }]}>
                  <Text style={[styles.listHeaderBadgeText, { color: smartQueue?.critical_zone ? "#FF3B30" : "#007AFF" }]}>
                    {filteredTickets.length} ticket{filteredTickets.length > 1 ? "s" : ""}{smartQueue?.critical_zone ? " ⚠" : ""}
                  </Text>
                </View>
              </View>
            ) : null}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="ticket-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>File vide</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {smartQueue?.critical_zone ? "Zone critique — les nouveaux tickets sont reportés" : "Aucun ticket en attente"}
                </Text>
              </View>
            )}
          />
        </>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 8, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          showsVerticalScrollIndicator={true}
        >
          {deferredDays.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket reporté</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Les tickets créés hors horaires apparaîtront ici.
              </Text>
            </View>
          ) : (
            deferredDays.map((day) => (
              <View key={day.date} style={[styles.deferredDaySection, { borderColor: "#FF950030" }]}>
                <View style={[styles.deferredDayHeader, { backgroundColor: "#FF950015" }]}>
                  <Ionicons name="calendar" size={14} color="#FF9500" />
                  <Text style={[styles.deferredDayDate, { color: "#CC7700" }]}>
                    {new Date(day.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
                  </Text>
                  <View style={styles.deferredDayBadge}>
                    <Text style={styles.deferredDayBadgeText}>{day.count}</Text>
                  </View>
                </View>
                {day.tickets.map((t, idx) => (
                  <View
                    key={t.id}
                    style={[
                      styles.deferredTicketRow,
                      { borderBottomColor: colors.border, backgroundColor: idx % 2 === 0 ? colors.surface : colors.background },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deferredTicketNumber, { color: colors.textPrimary }]}>{t.number}</Text>
                      <Text style={[styles.deferredTicketSub, { color: colors.textSecondary }]}>
                        {t.display_name ?? t.customer_name ?? "Usager anonyme"}
                      </Text>
                      <Text style={[styles.deferredTicketSub, { color: colors.textTertiary, fontSize: 10 }]}>
                        Créé le {new Date(t.created_at.replace(" ", "T") + "Z").toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <View style={[styles.deferredPriorityBadge, {
                        backgroundColor: t.priority === "urgence" ? "#FF3B3015" : t.priority === "vip" ? "#AF52DE15" : t.priority === "high" ? "#FF950015" : "#8E8E9315",
                      }]}>
                        <Text style={[styles.deferredPriorityText, {
                          color: t.priority === "urgence" ? "#FF3B30" : t.priority === "vip" ? "#AF52DE" : t.priority === "high" ? "#FF9500" : colors.textSecondary,
                        }]}>
                          {t.priority === "urgence" ? "🚨 Urgence" : t.priority === "vip" ? "⭐ VIP" : t.priority === "high" ? "🔥 Prioritaire" : "Normal"}
                        </Text>
                      </View>
                      <View style={[styles.deferredReasonBadge]}>
                        <Text style={styles.deferredReasonText}>
                          {t.defer_reason === "past_cutoff" ? "Hors délai" :
                           t.defer_reason === "non_working_day" ? "Jour non ouvrable" :
                           t.defer_reason === "holiday" ? "Jour férié" :
                           t.defer_reason === "critical_zone" ? "Zone critique" :
                           t.defer_reason === "exceptional_closure" ? "Fermeture except." :
                           "Reporté auto."}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {serviceStatus === "open" && (
        <View style={[styles.stickyButton, { backgroundColor: colors.background, borderTopColor: colors.border, paddingHorizontal: hPad }]}>
          <View style={styles.stickyRow}>
            <TouchableOpacity
              style={[styles.callButton, { flex: 1, backgroundColor: tickets.length === 0 || isActing ? colors.textSecondary : "#007AFF", opacity: tickets.length === 0 || isActing ? 0.6 : 1 }]}
              onPress={handleCallNext}
              disabled={tickets.length === 0 || isActing}
            >
              <Ionicons name="megaphone" size={18} color="#FFF" />
              <Text style={styles.callButtonText}>Appeler suivant</Text>
              {tickets.length > 0 && (
                <View style={styles.callButtonBadge}>
                  <Text style={styles.callButtonBadgeText}>{tickets.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: "#34C759" }]}
              onPress={() => setShowCreateModal(true)}
              disabled={isActing}
            >
              <Ionicons name="add" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Profil Client */}
      <Modal visible={!!clientProfileTicket} transparent animationType="slide" onRequestClose={() => { setClientProfileTicket(null); setClientProfileData(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity style={cmStyles.backdrop} activeOpacity={1} onPress={() => { setClientProfileTicket(null); setClientProfileData(null); }} />
          <View style={[cmStyles.sheet, { backgroundColor: colors.background, maxHeight: "80%" }]}>
            <View style={[cmStyles.handle, { backgroundColor: colors.border }]} />
            <View style={[cmStyles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[cmStyles.sheetTitle, { color: colors.textPrimary }]}>
                  {clientProfileTicket?.customer_name || clientProfileTicket?.display_name || `Ticket #${clientProfileTicket?.number}`}
                </Text>
                <Text style={[cmStyles.sheetSub, { color: colors.textSecondary }]}>Ticket {clientProfileTicket?.number}</Text>
              </View>
              <TouchableOpacity onPress={() => { setClientProfileTicket(null); setClientProfileData(null); }} style={cmStyles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {clientProfileLoading ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Ionicons name="hourglass-outline" size={24} color={colors.textSecondary} />
                <Text style={[cmStyles.sheetSub, { color: colors.textSecondary, marginTop: 8 }]}>Chargement...</Text>
              </View>
            ) : clientProfileData ? (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                  <View style={[styles.profileStatBox, { borderColor: colors.border }]}>
                    <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                    <Text style={[styles.profileStatValue, { color: colors.textPrimary }]}>{clientProfileData.customer_phone || "—"}</Text>
                  </View>
                  <View style={[styles.profileStatBox, { borderColor: colors.border }]}>
                    <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>Visites</Text>
                    <Text style={[styles.profileStatValue, { color: colors.textPrimary }]}>{clientProfileData.total_visits}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                  <View style={[styles.profileStatBox, { borderColor: "#FF950040", backgroundColor: "#FF950008" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Ionicons name="person-remove" size={14} color="#FF9500" />
                      <Text style={[styles.profileStatLabel, { color: "#FF9500" }]}>Absences</Text>
                    </View>
                    <Text style={[styles.profileStatValue, { color: "#FF9500" }]}>{clientProfileData.absent_count}</Text>
                  </View>
                  <View style={[styles.profileStatBox, { borderColor: "#007AFF40", backgroundColor: "#007AFF08" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Ionicons name="bar-chart" size={14} color="#007AFF" />
                      <Text style={[styles.profileStatLabel, { color: "#007AFF" }]}>Tps moy.</Text>
                    </View>
                    <Text style={[styles.profileStatValue, { color: "#007AFF" }]}>
                      {clientProfileData.avg_service_seconds != null
                        ? `${Math.floor(clientProfileData.avg_service_seconds / 60)}min ${clientProfileData.avg_service_seconds % 60}s`
                        : "—"}
                    </Text>
                  </View>
                </View>
                <Text style={[cmStyles.sectionLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Historique</Text>
                {clientProfileData.recent_tickets?.map((t: any) => {
                  const statusLabel = t.status === "closed" ? "Servi" : t.status === "absent" ? "Absent" : t.status === "called" ? "Appelé" : t.status === "en_route" ? "En route" : t.status === "present" ? "Présent" : t.status;
                  return (
                    <View key={t.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyTicket, { color: colors.textPrimary }]}>{t.number}</Text>
                        <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>{t.service_name || "—"} {t.counter_name ? `· ${t.counter_name}` : ""}</Text>
                      </View>
                      <Text style={[styles.historyStatus, { color: t.status === "closed" ? "#34C759" : t.status === "absent" ? "#FF3B30" : colors.textSecondary }]}>{statusLabel}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CreateTicketModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreateTicket}
        isCreating={isCreating}
        colors={colors}
      />

      {/* Modal de configuration du délai de priorité */}
      <Modal visible={showTimeoutModal} transparent animationType="fade" onRequestClose={() => setShowTimeoutModal(false)}>
        <TouchableOpacity style={tmStyles.backdrop} activeOpacity={1} onPress={() => setShowTimeoutModal(false)} />
        <View style={tmStyles.centeredView}>
          <View style={[tmStyles.card, { backgroundColor: colors.surface }]}>
            <View style={tmStyles.cardHeader}>
              <Ionicons name="timer-outline" size={20} color="#007AFF" />
              <Text style={[tmStyles.cardTitle, { color: colors.textPrimary }]}>Délai de priorité</Text>
            </View>
            <Text style={[tmStyles.cardSub, { color: colors.textSecondary }]}>
              Durée accordée à l’usager pour se présenter après l’appel de son ticket. Passé ce délai, il sera automatiquement marqué absent.
            </Text>
            <View style={[tmStyles.inputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[tmStyles.timeoutInput, { color: colors.textPrimary }]}
                keyboardType="number-pad"
                placeholder={`Par défaut (${Math.ceil((600) / 60)} min)`}
                placeholderTextColor={colors.textTertiary}
                value={timeoutInput}
                onChangeText={setTimeoutInput}
                maxLength={2}
              />
              <Text style={[tmStyles.unit, { color: colors.textSecondary }]}>min</Text>
            </View>
            <Text style={[tmStyles.hint, { color: colors.textTertiary }]}>Laissez vide pour utiliser la valeur par défaut · Valeur entre 1 et 60 min</Text>
            <View style={tmStyles.actions}>
              <TouchableOpacity style={[tmStyles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowTimeoutModal(false)}>
                <Text style={[tmStyles.cancelText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[tmStyles.saveBtn, { backgroundColor: isUpdatingTimeout ? "#007AFF80" : "#007AFF" }]}
                onPress={handleUpdateTimeout}
                disabled={isUpdatingTimeout}
              >
                <Text style={tmStyles.saveText}>{isUpdatingTimeout ? "Enregistrement..." : "Enregistrer"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Affluence */}
      <Modal visible={showAffluenceSheet} transparent animationType="slide" onRequestClose={() => setShowAffluenceSheet(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={cmStyles.backdrop} activeOpacity={1} onPress={() => setShowAffluenceSheet(false)} />
          <View style={[cmStyles.sheet, { backgroundColor: colors.background, maxHeight: "80%" }]}>
            <View style={[cmStyles.handle, { backgroundColor: colors.border }]} />
            <View style={[cmStyles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[cmStyles.sheetTitle, { color: colors.textPrimary }]}>Affluence</Text>
              <TouchableOpacity onPress={() => setShowAffluenceSheet(false)} style={cmStyles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {affluenceData && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <View style={[styles.affluenceStatBox, { borderColor: colors.border }]}>
                    <Text style={[styles.affluenceStatLabel, { color: colors.textSecondary }]}>En attente</Text>
                    <Text style={[styles.affluenceStatValue, { color: affluenceData.level === 'high' ? '#FF3B30' : affluenceData.level === 'medium' ? '#FF9500' : '#34C759' }]}>
                      {affluenceData.people ?? 0}
                    </Text>
                  </View>
                  <View style={[styles.affluenceStatBox, { borderColor: colors.border }]}>
                    <Text style={[styles.affluenceStatLabel, { color: colors.textSecondary }]}>Attente moy.</Text>
                    <Text style={[styles.affluenceStatValue, { color: colors.textPrimary }]}>~{affluenceData.eta_avg ?? '--'} min</Text>
                  </View>
                  <View style={[styles.affluenceStatBox, { borderColor: colors.border }]}>
                    <Text style={[styles.affluenceStatLabel, { color: colors.textSecondary }]}>Niveau</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[styles.affluenceDot, { backgroundColor: affluenceData.level === 'high' ? '#FF3B30' : affluenceData.level === 'medium' ? '#FF9500' : '#34C759' }]} />
                      <Text style={[styles.affluenceStatValue, { color: colors.textPrimary, fontSize: 14 }]}>
                        {affluenceData.level === 'high' ? 'Élevée' : affluenceData.level === 'medium' ? 'Modérée' : 'Faible'}
                      </Text>
                    </View>
                  </View>
                </View>
                        {affluenceData.hourly_data && affluenceData.hourly_data.length > 0 && (
                  <>
                    <Text style={[styles.affluenceChartTitle, { color: colors.textPrimary }]}>Créneaux d’affluence (30 jours)</Text>
                    <View style={[styles.affluenceChart, { backgroundColor: colors.surfaceSecondary }]}>
                      <View style={styles.affluenceChartBars}>
                        {affluenceData.hourly_data.map((pt: any) => {
                          const maxCount = Math.max(...affluenceData.hourly_data.map((d: any) => d.count), 1);
                          const heightPct = (pt.count / maxCount) * 100;
                          const barColor = affluenceData.peak_hours?.high?.includes(pt.hour) ? '#FF3B30'
                            : affluenceData.peak_hours?.medium?.includes(pt.hour) ? '#FF9500'
                            : colors.success + "60";
                          return (
                            <View key={pt.hour} style={styles.affluenceBarCol}>
                              <View style={styles.affluenceBarWrapper}>
                                <View style={[styles.affluenceBar, { height: `${Math.max(heightPct, 2)}%`, backgroundColor: barColor }]} />
                              </View>
                              <Text style={[styles.affluenceBarLabel, { color: colors.textTertiary }]}>
                                {String(pt.hour).padStart(2, '0')}h
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={styles.affluenceLegend}>
                        <View style={styles.affluenceLegendItem}>
                          <View style={[styles.affluenceLegendDot, { backgroundColor: '#FF3B30' }]} />
                          <Text style={[styles.affluenceLegendText, { color: colors.textTertiary }]}>Peak</Text>
                        </View>
                        <View style={styles.affluenceLegendItem}>
                          <View style={[styles.affluenceLegendDot, { backgroundColor: '#FF9500' }]} />
                          <Text style={[styles.affluenceLegendText, { color: colors.textTertiary }]}>Moyen</Text>
                        </View>
                        <View style={styles.affluenceLegendItem}>
                          <View style={[styles.affluenceLegendDot, { backgroundColor: colors.success + "60" }]} />
                          <Text style={[styles.affluenceLegendText, { color: colors.textTertiary }]}>Calme</Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}
                {affluenceData.peak_hours?.high?.length > 0 && (
                  <View style={[styles.affluenceTip, { backgroundColor: '#FF950012' }]}>
                    <Ionicons name="bulb-outline" size={16} color="#FF9500" />
                    <Text style={[styles.affluenceTipText, { color: colors.textSecondary }]}>
                      Heures d’affluence : {affluenceData.peak_hours.high.map((h: number) => `${String(h).padStart(2,'0')}h`).join(', ')}.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {AlertComponent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 10, paddingTop: Platform.OS === "ios" ? 6 : (StatusBar.currentHeight ?? 6) + 4, borderBottomWidth: 1, gap: 8 },
  backBtn: { padding: 6 },
  headerTitle: { fontWeight: "700", fontSize: 17 },
  headerSub: { fontSize: 11, marginTop: 1 },
  serviceToggle: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 4 },
  serviceToggleText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  kpiGrid: { marginBottom: 8 },
  kpiRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  kpiPill: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8, gap: 7, borderWidth: 1 },
  kpiIcon: { width: 28, height: 28, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  kpiValue: { fontWeight: "800", fontSize: 15, lineHeight: 18 },
  kpiLabel: { fontSize: 10, lineHeight: 13 },
  bannerWarning: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 9, borderWidth: 1 },
  bannerIconWarning: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#FF3B3018", justifyContent: "center", alignItems: "center" },
  bannerTitleWarning: { color: "#FF3B30", fontWeight: "800", fontSize: 13 },
  bannerSubWarning: { color: "#FF3B30CC", fontSize: 11, marginTop: 1 },
  bannerNormal: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 9, borderWidth: 1 },
  bannerIconNormal: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#34C75918", justifyContent: "center", alignItems: "center" },
  bannerTitleNormal: { color: "#34C759", fontWeight: "800", fontSize: 13 },
  bannerSubNormal: { fontSize: 11, marginTop: 1 },
  bannerChip: { backgroundColor: "#007AFF18", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1, borderColor: "#007AFF30" },
  bannerChipText: { color: "#007AFF", fontSize: 11, fontWeight: "700" },
  currentCard: { marginBottom: 6, borderRadius: 12, overflow: "hidden", padding: 12, gap: 5 },
  currentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  currentIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: "rgba(21, 12, 12, 0.15)", justifyContent: "center", alignItems: "center" },
  currentNumberContainer: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" },
  currentNumber: { color: "#FFF", fontWeight: "900", fontSize: 25 },
  currentStatusBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  currentStatusText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  currentStatusLine: { color: "rgba(255,255,255,0.82)", fontSize: 12, marginLeft: 46 },
  currentActions: { flexDirection: "row", justifyContent: "space-around", gap: 8, marginLeft: 46, marginTop: 4 },
  currentActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 8, borderRadius: 8 },
  currentActionText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 10, marginBottom: 4, marginTop: 2, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 4 },
  listHeaderTitle: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  listHeaderBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  listHeaderBadgeText: { fontSize: 12, fontWeight: "700" },
  // Nouveaux styles pour TicketRow amélioré
  ticketRow: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    borderRadius: 12, 
    marginBottom: 8, 
    borderWidth: 1, 
    padding: 12, 
    gap: 12 
  },
  ticketPosition: { 
    width: 40, 
    height: 40, 
    borderRadius: 10, 
    justifyContent: "center", 
    alignItems: "center", 
    borderWidth: 1 
  },
  ticketPositionText: { fontWeight: "800", fontSize: 16 },
  ticketContent: { flex: 1, gap: 6 },
  ticketHeaderRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  ticketNumber: { fontWeight: "700", fontSize: 15 },
  ticketPriorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ticketPriorityText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  ticketEtaBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#007AFF12", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#007AFF28" },
  ticketEtaText: { color: "#007AFF", fontSize: 9, fontWeight: "700" },
  ticketMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 2 },
  ticketSourceIcon: { width: 18, height: 18, justifyContent: "center", alignItems: "center" },
  ticketAttrs: { flexDirection: "row", gap: 4,  },
  ticketAttrIcon: { width: 18, height: 18, justifyContent: "center", alignItems: "center" },
  ticketMeta: { fontSize: 10, lineHeight: 14 },
  ticketCustomer: { fontSize: 11, fontWeight: "500" },
  ticketActions: { alignItems: "flex-end", gap: 8 },
  ticketStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  ticketStatusText: { fontSize: 10, fontWeight: "700" },
  ticketAbsentBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontWeight: "700", fontSize: 15, marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4 },
  stickyButton: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 110 : 100, borderTopWidth: 1 },
  stickyRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  callButton: { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  callButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  callButtonBadge: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  callButtonBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  createBtn: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  timeoutBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  timeoutBtnText: { fontSize: 11, fontWeight: "600" },
  countdownBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  countdownText: { color: "#FFF", fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] as any },
  tabRow: { flexDirection: "row", gap: 8, paddingVertical: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: "transparent" },
  tabBtnActive: { backgroundColor: "#007AFF18" },
  tabBtnDeferred: { backgroundColor: "#FF950018" },
  tabBtnText: { fontSize: 12, fontWeight: "600" },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 18, alignItems: "center" },
  tabBadgeText: { fontSize: 10, fontWeight: "700" },
  deferredDaySection: { marginBottom: 12, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  deferredDayHeader: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  deferredDayDate: { flex: 1, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  deferredDayBadge: { backgroundColor: "#FF9500", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  deferredDayBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  deferredTicketRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  deferredTicketNumber: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  deferredTicketSub: { fontSize: 12 },
  deferredPriorityBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  deferredPriorityText: { fontSize: 11, fontWeight: "600" },
  deferredReasonBadge: { backgroundColor: "#FF950018", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  deferredReasonText: { color: "#CC7700", fontSize: 10, fontWeight: "600" },
  filterToggle: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  filterChipText: { fontSize: 11, fontWeight: "600" },
  activityFeed: { borderRadius: 10, borderWidth: 1, overflow: "hidden", paddingBottom: 4 },
  activityTitle: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2 },
  activityTime: { fontSize: 10, fontFamily: "monospace", width: 40 },
  activityTicket: { fontSize: 10, fontWeight: "700", fontFamily: "monospace" },
  activityMessage: { fontSize: 10, flex: 1 },
  profileStatBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10 },
  profileStatLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  profileStatValue: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5 },
  historyTicket: { fontSize: 13, fontWeight: "600" },
  historyMeta: { fontSize: 10, marginTop: 1 },
  historyStatus: { fontSize: 12, fontWeight: "700" },
  affluenceStatBox: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  affluenceStatLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  affluenceStatValue: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  affluenceDot: { width: 8, height: 8, borderRadius: 4 },
  affluenceChartTitle: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  affluenceChart: { borderRadius: 12, padding: 14, marginBottom: 12 },
  affluenceChartBars: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 2 },
  affluenceBarCol: { flex: 1, alignItems: "center" },
  affluenceBarWrapper: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  affluenceBar: { width: "100%", borderRadius: 3, minHeight: 2 },
  affluenceBarLabel: { fontSize: 8, marginTop: 4 },
  affluenceLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  affluenceLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  affluenceLegendDot: { width: 8, height: 8, borderRadius: 4 },
  affluenceLegendText: { fontSize: 11 },
  affluenceTip: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12 },
  affluenceTipText: { fontSize: 12, flex: 1, lineHeight: 16 },
});

const tmStyles = StyleSheet.create({
  backdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" } as any,
  centeredView: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  card: { width: "100%", borderRadius: 18, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  timeoutInput: { flex: 1, fontSize: 22, fontWeight: "700", padding: 0 },
  unit: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 11, lineHeight: 16, marginBottom: 20 },
  actions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600" },
  saveBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});