import { useState, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { annualPrice, formatFcfa, usePlans } from "@/lib/plans";

// ─── DESIGN SYSTEM ──────────────────────────────────────────────────────────
const T = {
  dark: {
    bg: "#000000",
    surface: "#212529",
    surfaceHover: "#12121A",
    border: "rgba(255,255,255,0.06)",
    borderAccent: "rgba(0,113,227,0.3)",
    text: "#F5F5F7",
    textMid: "#86868B",
    textSub: "#424245",
    accent: "#0071E3",
    accentBg: "rgba(0,113,227,0.1)",
    accentStrong: "#0077ED",
    green: "#32D74B",
    red: "#FF453A",
    orange: "#FF9F0A",
    purple: "#BF5AF2",
    navBg: "rgba(0,0,0,0.8)",
    glow: "rgba(0,113,227,0.1)",
    },
  light: {
    bg: "#F5F6F7",
    surface: "#FFFFFF",
    surfaceHover: "#FBFBFD",
    border: "rgba(0,0,0,0.06)",
    borderAccent: "rgba(0,113,227,0.2)",
    text: "#1D1D1F",
    textMid: "#6E6E73",
    textSub: "#86868B",
    accent: "#0066CC",
    accentBg: "rgba(0,102,204,0.05)",
    accentStrong: "#004499",
    green: "#248A3D",
    red: "#E30000",
    orange: "#F56300",
    purple: "#892AD1",
    navBg: "rgba(245,245,247,0.8)",
    glow: "rgba(0,102,204,0.03)",
  },
};

const Icons = {
  Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  ArrowRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Check: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Layout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Smartphone: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  Terminal: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Clock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  MapPin: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

const QueueVisual = ({ t }: { t: any }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative w-full max-w-[360px] aspect-[4/5] rounded-[32px] border-[6px] shadow-2xl overflow-hidden p-6 mx-auto transition-colors duration-500"
    style={{ 
      background: t.surface, 
      borderColor: t.border 
    }}
  >
    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-4 rounded-b-xl transition-colors duration-500" 
         style={{ background: t.border }} />
    <div className="mt-4 space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Live</p>
          <h4 className="text-base font-bold transition-colors duration-500" style={{ color: t.text }}>Guichet Central</h4>
        </div>
        <div className="text-right">
          <p className="text-[9px] mb-0.5 transition-colors duration-500" style={{ color: t.textMid }}>Attente</p>
          <p className="text-xl font-black text-green-400">~8m</p>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { id: '204', status: 'En cours', active: true },
          { id: '205', status: 'Votre tour', highlight: true },
          { id: '206', status: 'Suivant', blur: false },
        ].map((item, i) => (
          <motion.div key={item.id} initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 + 0.3 }}
            className="p-3 rounded-xl flex items-center justify-between border transition-colors duration-500"
            style={{ 
              background: item.active ? t.accentBg : 'rgba(255,255,255,0.05)',
              borderColor: item.active ? t.borderAccent : t.border
            }}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold transition-colors duration-500`}
                   style={{ 
                     background: item.active ? t.accent : 'rgba(255,255,255,0.1)',
                     color: item.active ? '#fff' : t.textMid 
                   }}>{item.id}</div>
              <div>
                <p className="text-xs font-bold transition-colors duration-500" style={{ color: t.text }}>{item.status}</p>
                <p className="text-[9px] transition-colors duration-500" style={{ color: t.textSub }}>Service A</p>
              </div>
            </div>
            {item.active && <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </motion.div>
        ))}
      </div>
      <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 3, repeat: Infinity }} 
                   className="p-3 rounded-xl shadow-lg transition-colors duration-500"
                   style={{ background: t.accent, boxShadow: `0 10px 25px -5px ${t.accent}20` }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md transition-colors duration-500" 
               style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Icons.Smartphone />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white transition-colors duration-500">C'est bientôt à vous</p>
            <p className="text-[8px] text-white/70 transition-colors duration-500">Position n°2 dans la file.</p>
          </div>
        </div>
      </motion.div>
    </div>
  </motion.div>
);

const FeatureCard = ({ icon: Icon, title, desc, t, delay }: any) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay }}
      className="p-6 rounded-3xl border group hover:border-blue-500/20 transition-all duration-500" style={{ background: t.surface, borderColor: t.border }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500" style={{ color: t.accent, background: t.accentBg }}><Icon /></div>
      <h3 className="text-lg font-bold mb-2 tracking-tight" style={{ color: t.text }}>{title}</h3>
      <p className="text-xs leading-relaxed" style={{ color: t.textMid }}>{desc}</p>
    </motion.div>
  );
};

const Features = ({ t }: { t: any }) => {
  const items = [
    { 
      icon: Icons.Zap, 
      title: "Tickets Virtuels instantanés", 
      desc: "Plus besoin de bornes physiques coûteuses. Vos clients scannent un QR Code et reçoivent leur ticket directement sur leur smartphone.",
      accent: t.orange 
    },
    { 
      icon: Icons.Bell, 
      title: "Notifications Temps Réel", 
      desc: "Alertes intelligentes via SMS ou Push pour prévenir l'usager quand son tour approche, lui permettant de vaquer à ses occupations.",
      accent: t.purple 
    },
    { 
      icon: Icons.BarChart, 
      title: "Statistiques détaillées", 
      desc: "Identifiez vos heures de pointe, suivez l'attente, les absences et la satisfaction, et ajustez l'affectation de vos agents.",
      accent: t.accent 
    },
    { 
      icon: Icons.Clock, 
      title: "Gestion Multi-Guichets", 
      desc: "Distribuez intelligemment les flux entre vos différents services et agents pour une fluidité maximale et un temps d'attente minimal.",
      accent: t.green 
    },
    { 
      icon: Icons.MapPin, 
      title: "Géo-localisation", 
      desc: "Les usagers trouvent les établissements les plus proches et consultent l'affluence en temps réel avant même de se déplacer.",
      accent: t.red 
    },
    { 
      icon: Icons.Shield, 
      title: "Accès cloisonnés", 
      desc: "Chaque établissement ne voit que ses services, agents et tickets ; les agents n'agissent que sur les files qui leur sont confiées.",
      accent: t.textMid 
    }
  ];

  return (
    <section id="features" className="py-24 px-6" style={{ background: t.bg }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Avantages & Fonctionnalités</p>
            <h2 className="text-[clamp(28px,5vw,48px)] font-black tracking-tight leading-[1.1]" style={{ color: t.text }}>
              L'excellence opérationnelle <br />
              <span className="opacity-40">pour chaque interaction.</span>
            </h2>
            <p className="text-sm md:text-base leading-relaxed max-w-lg" style={{ color: t.textMid }}>
              SmartQueue transforme l'attente en une expérience positive et productive, tout en optimisant vos ressources internes.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-[24px] border border-border group hover:border-blue-500/30 transition-all"
                style={{ background: t.surface, borderColor: t.border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: f.accent + '15', color: f.accent }}>
                  <f.icon />
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: t.text }}>{f.title}</h3>
                <p className="text-[11px] leading-relaxed" style={{ color: t.textMid }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── SECTIONS ───────────────────────────────────────────────────────────────

const Hero = ({ t }: { t: any }) => (
  <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 px-6 overflow-hidden">
    <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />
    <div className="absolute bottom-1/4 -right-20 w-[300px] h-[300px] bg-purple-600/5 blur-[80px] rounded-full pointer-events-none" />
    <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div className="text-left space-y-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/30 backdrop-blur-sm" style={{ borderColor: t.border, background: t.surface + '80' }}>
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: t.textMid }}>Files d'attente virtuelles</span>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[clamp(32px,6vw,64px)] font-black leading-[1.05] tracking-tight" style={{ color: t.text }}>
          La file d'attente,<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-300">enfin réinventée.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="max-w-[460px] text-base md:text-lg leading-relaxed font-medium" style={{ color: t.textMid }}>
          Finissez-en avec l'attente debout. Offrez à vos usagers la liberté de prendre un ticket depuis n'importe où.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-3 pt-2">
          <Link to="/signup" className="px-6 py-3.5 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-600/10" style={{ background: t.accent }}>Démarrer l'essai gratuit</Link>
          <a href="#ecosystem" className="px-6 py-3.5 border border-border rounded-xl font-bold text-sm hover:bg-surface transition-all" style={{ color: t.text}}>Découvrir l'écosystème</a>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-wrap gap-x-8 gap-y-3 pt-8 border-t border-border" style={{ borderColor: t.border }}>
          {["Ticket par QR code", "Alertes push et SMS", "Position en temps réel"].map((label) => (
            <div key={label} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: t.textMid }}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-500"><Icons.Check /></span>
              {label}
            </div>
          ))}
        </motion.div>
      </div>
      <div className="flex justify-center"><QueueVisual t={t} /></div>
    </div>
  </section>
);

const HowItWorks = ({ t }: { t: any }) => {
  const steps = [
    {
      step: "01",
      title: "Prise de ticket",
      desc: "Le client scanne un QR Code ou accède à l'interface web pour obtenir un ticket virtuel instantanément.",
      icon: Icons.Smartphone,
      color: t.accent
    },
    {
      step: "02", 
      title: "Suivi en temps réel",
      desc: "Le client consulte sa position dans la file et reçoit des notifications quand son tour approche.",
      icon: Icons.Bell,
      color: t.purple
    },
    {
      step: "03",
      title: "Gestion par l'agent",
      desc: "L'agent appelle le prochain ticket depuis son interface web ou mobile, gère les absences et les rappels, avec des statistiques en direct.",
      icon: Icons.Terminal,
      color: t.green
    },
    {
      step: "04",
      title: "Analytics & Optimisation",
      desc: "Les administrateurs analysent les performances et optimisent les ressources via le tableau de bord.",
      icon: Icons.BarChart,
      color: t.orange
    }
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 " style={{ background:t.surface }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Comment ça marche ?</p>
          <h2 className="text-[clamp(24px,4vw,42px)] font-black tracking-tight" style={{ color: t.text }}>
            Simple en 4 étapes.<br />
            <span className="opacity-40">Du ticket à l'analyse.</span>
          </h2>
          <p className="max-w-2xl mx-auto text-base md:text-lg leading-relaxed" style={{ color: t.textMid }}>
            Une expérience fluide pour vos usagers et un contrôle total pour vos équipes. Découvrez comment SmartQueue révolutionne la gestion des files d'attente.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative group"
            >
              {/* Numéro d'étape */}
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shadow-lg z-10"
                   style={{ background: step.color, color: '#fff' }}>
                {step.step}
              </div>
              
              {/* Carte */}
              <div className="p-8 shadow-xl  rounded-2xl border h-full relative overflow-hidden"
                   style={{ background: t.surface, borderColor: t.border }}>
                
                {/* Icône */}
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                     style={{ background: step.color + '15', color: step.color }}>
                  <step.icon />
                </div>
                
                {/* Contenu */}
                <h3 className="text-lg font-bold mb-3" style={{ color: t.text }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: t.textMid }}>
                  {step.desc}
                </p>
                
                {/* Ligne de connexion */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5"
                       style={{ background: t.border }} />
                )}
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* CTA */}
        <div className="text-center mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex gap-4"
          >
            <Link 
              to="/signup" 
              className="px-8 py-4 text-white rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg"
              style={{ background: t.accent }}
            >
              Démarrer l'essai gratuit
            </Link>
            <a 
              href="#features" 
              className="px-8 py-4 border rounded-xl font-bold hover:bg-surface transition-all"
              style={{ color: t.text, borderColor: t.border }}
            >
              Voir les fonctionnalités
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Ecosystem = ({ t }: { t: any }) => {
  const roles = [
    { icon: Icons.Layout, title: "Admins", role: "Créateurs", desc: "Configurez vos établissements, services et guichets en quelques clics. Gérez vos abonnements et accédez aux analytics globaux.", color: t.purple },
    { icon: Icons.Terminal, title: "Agents", role: "Opérateurs", desc: "Interface web et mobile pour appeler les tickets, gérer les absences et les priorités, et suivre la file en temps réel.", color: t.accent },
    { icon: Icons.Smartphone, title: "Usagers", role: "Clients", desc: "Application mobile intuitive pour prendre un ticket, suivre sa position et recevoir des alertes de proximité.", color: t.green },
  ];
  return (
    <section id="ecosystem" className="py-24 px-6 border-y border-border" >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Un écosystème complet</p>
          <h2 className="text-[clamp(24px,4vw,42px)] font-black tracking-tight" style={{ color: t.text }}>Une solution, trois expériences.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role, i) => (
            <motion.div key={i} whileHover={{ y: -5 }} className="p-8 rounded-[32px] border flex flex-col h-full" style={{ background: t.surface, borderColor: t.border }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm" style={{ background: role.color + '15', color: role.color }}>
                <role.icon />
              </div>
              <div className="mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-50" style={{ color: t.text }}>{role.role}</span>
                <h3 className="text-xl font-black" style={{ color: t.text }}>{role.title}</h3>
              </div>
              <p className="text-xs leading-relaxed flex-grow" style={{ color: t.textMid }}>{role.desc}</p>
              <div className="mt-8 pt-6 border-t border-border" >
                <Link to="/signup" className="text-[10px] font-bold flex items-center gap-2 hover:gap-3 transition-all" style={{ color: role.color }}>
                  En savoir plus <Icons.ArrowRight />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FAQ = ({ t }: { t: any }) => {
  const faqs = [
    {
      q: "Comment fonctionne SmartQueue ?",
      a: "Les usagers prennent un ticket depuis l'application mobile ou en scannant le QR code du service, suivent leur position en temps réel et sont prévenus quand leur tour approche. Les agents appellent les tickets depuis leur tableau de bord web ou mobile."
    },
    {
      q: "Comment les usagers sont-ils notifiés ?",
      a: "Par notification push dans l'application mobile, et par SMS lorsque l'envoi de SMS est activé pour la plateforme. L'usager confirme qu'il est en route ou déjà sur place depuis l'application."
    },
    {
      q: "Que se passe-t-il si un usager ne se présente pas ?",
      a: "L'agent le marque absent : il peut être rappelé jusqu'au nombre de tentatives défini pour le service, puis son ticket expire. Le délai de présentation est réglable par service."
    },
    {
      q: "Puis-je configurer mes horaires ?",
      a: "Oui : horaires par jour de la semaine, jours fériés et fermetures exceptionnelles. Un ticket pris hors horaires est automatiquement reporté au prochain jour d'ouverture."
    },
    {
      q: "Quelles données sont collectées ?",
      a: "Le nom, l'e-mail et le téléphone de l'usager, l'historique de ses tickets et, s'il l'autorise, sa position pour estimer son temps de trajet. L'usager peut supprimer son compte depuis l'application."
    },
    {
      q: "Comment démarrer ?",
      a: "Créez votre compte, choisissez une offre puis configurez votre établissement, vos services et vos agents depuis le tableau de bord. La période d'essai démarre immédiatement."
    }
  ];

  return (
    <section id="faq" className="py-24 px-6" style={{ background: t.surface }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Questions fréquentes</p>
          <h2 className="text-[clamp(24px,4vw,42px)] font-black tracking-tight" style={{ color: t.text }}>Vous avez des questions ?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }} 
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl shadow-sm border" 
              style={{ background: t.surface, borderColor: t.border }}
            >
              <h3 className="text-base font-bold mb-3" style={{ color: t.text }}>{faq.q}</h3>
              <p className="text-xs leading-relaxed" style={{ color: t.textMid }}>{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Pricing = ({ t }: { t: any }) => {
  const { catalog, error } = usePlans();
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Tarification</p>
          <h2 className="text-[clamp(24px,4vw,42px)] font-black tracking-tight" style={{ color: t.text }}>Simple. Sans surprise.</h2>
          {catalog && (
            <p className="text-sm" style={{ color: t.textMid }}>
              {catalog.trial_days} jours d'essai · {catalog.annual_discount_percent > 0 ? `-${catalog.annual_discount_percent}% en paiement annuel` : 'Facturation mensuelle'}
            </p>
          )}
        </div>
        {error && (
          <p className="text-center text-sm" style={{ color: t.textMid }}>
            Les offres sont momentanément indisponibles. <Link to="/signup" className="underline">Créez votre compte</Link> pour les consulter.
          </p>
        )}
        {!catalog && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 rounded-[32px] border animate-pulse" style={{ background: t.surface, borderColor: t.border }} />
            ))}
          </div>
        )}
        {catalog && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {catalog.plans.map((p) => (
              <div key={p.id} className={`p-8 rounded-[32px] border flex flex-col ${p.popular ? 'shadow-xl md:scale-[1.02]' : ''}`} style={{ background: p.popular ? t.accentStrong : t.surface, borderColor: p.popular ? 'transparent' : t.border }}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${p.popular ? 'text-white/60' : 'text-blue-500'}`}>{p.name}</p>
                <p className={`text-xs mb-3 ${p.popular ? 'text-white/70' : ''}`} style={{ color: p.popular ? undefined : t.textMid }}>{p.description}</p>
                <div className="flex items-baseline flex-wrap gap-1 mb-1">
                  <span className="text-3xl font-black" style={{ color: p.popular ? '#fff' : t.text }}>{new Intl.NumberFormat('fr-FR').format(p.monthly_price)}</span>
                  <span className={`text-xs ${p.popular ? 'text-white/60' : 'text-gray-500'}`}>{catalog.currency} / mois</span>
                </div>
                {catalog.annual_discount_percent > 0 && (
                  <p className={`text-[10px] mb-4 ${p.popular ? 'text-white/60' : 'text-gray-500'}`}>ou {formatFcfa(annualPrice(catalog, p))} / an</p>
                )}
                <div className="space-y-3 mb-8 flex-grow">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${p.popular ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'}`}><Icons.Check /></div>
                      <span className="text-[11px] font-medium" style={{ color: p.popular ? '#fff' : t.textMid }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/signup" className={`w-full py-3 rounded-xl font-bold text-xs text-center transition-all ${p.popular ? 'bg-white text-blue-600 hover:scale-[1.02]' : 'text-white hover:opacity-90'}`} style={{ background: p.popular ? '#fff' : t.accent }}>Choisir cette offre</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ─── PAGE COMPONENT ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const { theme } = useTheme();
  const t = T[theme as keyof typeof T] || T.dark;
  
  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans ${theme === 'dark' ? 'bg-black text-white' : 'bg-[#F5F6F7] text-[#1D1D1F]'}`}>
      <style>{`
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(134, 134, 139, 0.2); border-radius: 10px; }
        ::selection { background: rgba(0, 113, 227, 0.2); }
      `}</style>
      <nav className="fixed top-0 w-full z-[100] border-b border-white/20 backdrop-blur-xl transition-all " style={{ background: t.navBg }}>
        <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="text-xl font-black tracking-tighter flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black" style={{ background: t.accent }}>SQ</div>
              <span>SmartQueue</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {[['features', 'Fonctionnalités'], ['ecosystem', 'Écosystème'], ['pricing', 'Tarifs'], ['faq', 'FAQ']].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="text-[12px] font-semibold hover:opacity-50 transition-opacity" style={{ color: t.textMid }}>{label}</a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login" className="hidden sm:block px-4 py-2 text-[12px] font-bold hover:opacity-50 transition-opacity" style={{ color: t.text }}>Connexion</Link>
            <Link to="/signup" className="px-5 py-2 text-white rounded-lg text-[12px] font-bold shadow-lg shadow-blue-600/10 hover:scale-105 transition-all" style={{ background: t.accent }}>S'inscrire</Link>
          </div>
        </div>
      </nav>
      <main>
        <Hero t={t} />
        <Ecosystem t={t} />
        <HowItWorks t={t} />
        <Features t={t} />
        <Pricing t={t} />
        <FAQ t={t} />
        <section className="py-32 px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto rounded-[48px] p-12 md:p-20 text-center text-white space-y-8 relative overflow-hidden" style={{ background: t.accent }}>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-none">Prêt à transformer votre accueil ?</h2>
            <p className="text-sm text-white/80 max-lg mx-auto">Rejoignez les établissements qui modernisent leur expérience usager chaque jour.</p>
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <Link to="/signup" className="px-8 py-4 bg-white text-blue-600 rounded-xl font-black text-sm hover:scale-105 transition-transform">Démarrer maintenant</Link>
              <Link to="/login" className="px-8 py-4 bg-white/10 backdrop-blur-md rounded-xl font-black text-sm hover:bg-white/20 transition-all">J'ai déjà un compte</Link>
            </div>
          </motion.div>
        </section>
      </main>
      <footer className="py-16 px-6 border-t border-border" style={{ borderColor: t.border , background:t.surface}}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 text-[11px] font-bold" style={{ color: t.textMid }}>
          <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[8px] font-black" style={{ background: t.accent }}>SQ</div><span>© {new Date().getFullYear()} SmartQueue</span></div>
          <div className="flex gap-10">
            <Link to="/login" className="hover:text-blue-500">Connexion</Link><Link to="/signup" className="hover:text-blue-500">Créer un compte</Link><a href="#faq" className="hover:text-blue-500">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
