<div align="center">

<img src="https://img.shields.io/badge/SmartQueue-Système%20de%20File%20d'Attente%20Intelligent-0D2B55?style=for-the-badge&logoColor=white" alt="SmartQueue"/>

# SmartQueue
### Système Intelligent de Gestion de Files d'Attente en Temps Réel

**Temps Réel · SaaS · Multi-plateforme · Multi-rôles**

[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-54.0-000020?style=flat-square&logo=expo)](https://expo.dev)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![Laravel](https://img.shields.io/badge/Laravel-12.x-FF2D20?style=flat-square&logo=laravel)](https://laravel.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql)](https://mysql.com)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=flat-square&logo=redis)](https://redis.io)
[![Reverb](https://img.shields.io/badge/Laravel%20Reverb-WebSocket-FF2D20?style=flat-square&logo=laravel)](https://reverb.laravel.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square)]()
[![Status](https://img.shields.io/badge/Status-Production%20Ready-green?style=flat-square)]()

---

> **SmartQueue** digitalise complètement l'expérience d'attente. Les usagers prennent leur ticket à distance,  
> suivent leur position en temps réel, et sont notifiés automatiquement — fini les heures perdues dans les salles d'attente.

---

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Architecture](#-architecture)
- [Stack technique](#-stack-technique)
- [Fonctionnalités](#-fonctionnalités-détaillées)
- [Structure du projet](#-structure-du-projet)
- [Démarrage rapide](#-démarrage-rapide)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [WebSocket / Temps Réel](#-websocket--temps-réel)
- [Modèle de données](#-modèle-de-données)
- [Sécurité](#-sécurité)
- [Déploiement](#-déploiement)
- [Tests](#-tests)
- [Roadmap](#-roadmap)
- [Contribution](#-contribution)
- [Licence](#-licence)

---

## 🎯 Vue d'ensemble

SmartQueue est une plateforme SaaS complète de gestion de files d'attente virtuelles, conçue pour les établissements recevant du public (hôpitaux, mairies, banques, commerces, etc.).

### Trois acteurs principaux

| Rôle | Description | Interfaces |
|------|-------------|------------|
| **Usager** | Prend un ticket à distance, suit sa position, reçoit des notifications | App mobile (React Native), Web |
| **Agent** | Gère la file en temps réel, appelle les tickets, gère les absences | Dashboard Web React |
| **Administrateur** | Configure les services, consulte les statistiques, gère les agents | Dashboard Web React |
| **Super Admin** | Gère les établissements clients, abonnements, monitoring SaaS | Dashboard Web React |

---

## 🏗 Architecture

SmartQueue est architecturé comme un **monorepo** moderne avec trois composantes principales :

```
┌─────────────────────────────────────────────────────────────────┐
│                        SMARTQUEUE PLATFORM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │   MOBILE    │    │    WEB      │    │      API REST       │   │
│  │  React Native│    │   React 18  │◄──►│    Laravel 12       │   │
│  │   (Expo)    │    │   + Vite    │    │   + Sanctum Auth    │   │
│  │             │    │             │    │                     │   │
│  │ • Expo SDK  │    │ • Redux     │    │ • MySQL 8           │   │
│  │ • Push Notif│    │ • Tailwind  │    │ • Redis             │   │
│  │ • QR Scanner│    │ • Recharts  │    │ • Laravel Reverb    │   │
│  │ • Maps      │    │ • shadcn/ui │    │ • Queues            │   │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘   │
│         │                  │                      │               │
│         └──────────────────┴──────────────────────┘               │
│                            │                                      │
│                    ┌───────▼────────┐                           │
│                    │  WebSocket       │                           │
│                    │  Laravel Reverb  │                           │
│                    │  Port 6001       │                           │
│                    └─────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Communication temps réel (WebSocket)

Laravel Reverb fournit les canaux de diffusion temps réel :
- **Canal privé ticket.{id}** : mises à jour individuelles d'un ticket
- **Canal présence service.{id}** : état de la file pour agents et usagers

Les événements diffusés incluent : `TicketCalled`, `TicketUpdated`, `ServiceTicketEnqueued`, `ServiceStatsUpdated`, `UserEnRoute`.

---

## 🛠 Stack technique

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| **Mobile** | React Native + Expo | 0.81 / SDK 54 | Application cross-platform (iOS/Android) |
| **Web Front** | React + Vite | 18.2 / 5.x | Dashboards agent/admin/super_admin |
| **UI Library** | shadcn/ui + Radix | latest | Composants UI accessibles |
| **State** | Redux Toolkit + Zustand | 2.x / 5.x | Gestion d'état global |
| **API** | Laravel + Sanctum | 12.x | Authentification, API REST sécurisée |
| **WebSocket** | Laravel Reverb | 1.6 | Serveur WebSocket temps réel |
| **Base de données** | MySQL | 8.0 | Stockage relationnel principal |
| **Cache/Queue** | Redis | 7.x | Cache, sessions, queues de jobs |
| **Notifications** | Expo Notifications + Twilio | - | Push mobile et SMS |
| **QR Codes** | simple-qrcode | 4.2 | Génération de QR codes dynamiques |
| **PDF** | laravel-dompdf | 3.1 | Génération de rapports PDF |
| **Docker** | Docker Compose | 3.8 | Orchestration conteneurs |

---

## ✨ Fonctionnalités détaillées

### 👤 Espace Usager (Mobile + Web)

| Fonctionnalité | Description |
|----------------|-------------|
| **Prise de ticket** | Réservation depuis l'app ou scan QR code en borne |
| **Géolocalisation** | Carte des établissements proches, distance et temps estimé |
| **Suivi temps réel** | Position dans la file, nombre d'attente, temps estimé |
| **Notifications** | Push (FCM) + SMS quand le tour approche |
| **Différé de position** | Échanger sa place avec le suivant (24h de grâce) |
| **Historique** | Consultation des tickets passés |
| **Préférences alertes** | Configuration des seuils de notification |
| **Statut d'affluence** | Indicateur visuel vert/orange/rouge |
| **Recommandations** | Suggestions d'horaires moins chargés |
| **En route** | Signalement "en route" avec calcul ETA |

### 🎧 Espace Agent (Dashboard Web)

| Fonctionnalité | Description |
|----------------|-------------|
| **Appel suivant** | Bouton pour appeler le prochain ticket (priorité > ancienneté) |
| **Gestion file** | Vue complète : waiting, called, absent, deferred |
| **Marquer absent** | Défère automatiquement pendant 24h si possible |
| **Rappel ticket** | Rappeler un ticket absent ou différé |
| **Fermeture file** | Pause ou fermeture d'urgence d'un service |
| **Guichets** | Ouverture/fermeture de guichet individuel |
| **Dashboard temps réel** | Stats du jour, performance personnelle |

### 🏢 Espace Admin Établissement (Dashboard Web)

| Fonctionnalité | Description |
|----------------|-------------|
| **Gestion services** | CRUD services, capacité, horaires, durée moyenne |
| **Gestion agents** | Affectation des agents aux services |
| **Gestion guichets** | Configuration des comptoirs physiques |
| **QR Codes** | Génération, affichage, téléchargement QR par service |
| **Statistiques** | Temps moyen, taux d'absence, performance |
| **Export rapports** | CSV et PDF des activités |
| **Broadcast push** | Envoi de notifications à tous les usagers |
| **Logs notifications** | Traçabilité des notifications envoyées |

### 🌐 Espace Super Admin SaaS (Dashboard Web)

| Fonctionnalité | Description |
|----------------|-------------|
| **Établissements** | Gestion multi-établissements clients |
| **Abonnements** | Plans Basic/Pro/Enterprise, facturation |
| **Monitoring** | Vue d'ensemble santé de la plateforme |
| **Analytics globaux** | Stats agrégées cross-établissements |

---

## 📁 Structure du projet

```
SmartQueue/
│
├── backend/                          # API Laravel 12
│   ├── app/
│   │   ├── Events/                   # Événements WebSocket
│   │   ├── Http/Controllers/Api/     # Contrôleurs API
│   │   │   ├── Admin/               # Endpoints admin
│   │   │   ├── Agent/               # Endpoints agent
│   │   │   └── Saas/                # Endpoints super admin
│   │   ├── Jobs/                    # Jobs async (notifications)
│   │   ├── Models/                  # Modèles Eloquent
│   │   ├── Notifications/           # Notifications personnalisées
│   │   ├── Policies/                # Autorisations
│   │   ├── Services/                # Logique métier (TicketService)
│   │   └── OpenApi/                 # Documentation OpenAPI/Swagger
│   ├── config/
│   ├── database/
│   │   ├── migrations/               # 30+ migrations
│   │   └── seeders/                  # Seeders avec données de test
│   ├── routes/
│   │   └── api.php                   # Routes API REST complètes
│   └── Dockerfile
│
├── frontend/                         # Dashboard React 18 + Vite
│   ├── src/
│   │   ├── api/                      # Clients API
│   │   ├── components/               # Composants réutilisables
│   │   │   ├── layout/               # Layouts (AppLayout, AuthLayout)
│   │   │   └── ui/                   # Composants shadcn/ui
│   │   ├── hooks/                    # Custom hooks
│   │   ├── pages/                    # Pages par rôle
│   │   │   ├── admin/                # Agents, Services, Stats
│   │   │   ├── agent/                # AgentDashboard
│   │   │   ├── dashboard/            # Dashboards utilisateur
│   │   │   ├── saas/                 # Super admin
│   │   │   └── auth/                 # Login, Register
│   │   ├── router/                   # Configuration React Router
│   │   └── store/                    # Redux store
│   ├── package.json
│   └── Dockerfile
│
├── react-native/                     # App Mobile React Native + Expo
│   └── smartqueue/
│       ├── app/                      # Routes Expo Router
│       │   ├── (tabs)/               # Navigation principale
│       │   └── agent/                # Interface agent mobile
│       ├── src/
│       │   ├── api/                  # API client
│       │   ├── components/           # Composants RN
│       │   ├── hooks/                # Hooks personnalisés
│       │   ├── screens/              # Écrans par feature
│       │   │   ├── auth/             # Login, Register
│       │   │   ├── explore/          # Carte, établissements
│       │   │   ├── tickets/          # Gestion tickets
│       │   │   └── profile/          # Profil, préférences
│       │   ├── navigation/           # Configuration navigation
│       │   └── store/                # Zustand store
│       └── package.json
│
├── docker-compose.yml                # Backend + Reverb + MySQL + Redis
└── README.md                         # Ce fichier
```

---

## 🚀 Démarrage rapide

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) ≥ 24.x
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.x
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) ≥ 20.x (pour le développement frontend)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (pour le mobile)

### Installation complète

**1. Cloner le repository**

```bash
git clone https://github.com/votre-org/smartqueue.git
cd SmartQueue
```

**2. Configurer les variables d'environnement**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp react-native/smartqueue/.env.example react-native/smartqueue/.env
```

**3. Lancer l'infrastructure (Backend + DB + Reverb)**

```bash
docker compose up --build -d
```

Services démarrés :
| Service | Port | Description |
|---------|------|-------------|
| Backend API | `8080` | API Laravel |
| Reverb WS | `6001` | Serveur WebSocket |
| MySQL | `3306` | Base de données |
| Redis | `6379` | Cache & queues |

**4. Initialiser la base de données**

```bash
docker compose exec backend php artisan migrate --seed
```

**5. Lancer le frontend (dans un nouveau terminal)**

```bash
cd frontend
npm install
npm run dev
```

→ Dashboard accessible sur http://localhost:5173

**6. Lancer l'app mobile (dans un nouveau terminal)**

```bash
cd react-native/smartqueue
npm install
npx expo start
```

→ Scanner le QR code avec l'app Expo Go sur votre téléphone.

---
## ⚙ Configuration

### Variables d'environnement backend (`backend/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `APP_URL` | URL de l'application | `http://localhost:8000` |
| `DB_CONNECTION` | Driver DB | `mysql` |
| `DB_HOST` | Hôte MySQL | `db` (Docker) |
| `DB_DATABASE` | Nom de la base | `smartqueue` |
| `DB_USERNAME` | Utilisateur MySQL | `user` |
| `DB_PASSWORD` | Mot de passe MySQL | `secret` |
| `REDIS_HOST` | Hôte Redis | `redis` |
| `REVERB_APP_KEY` | Clé app Reverb | `smartqueue_key` |
| `REVERB_APP_SECRET` | Secret Reverb | `smartqueue_secret` |
| `REVERB_HOST` | Hôte Reverb | `localhost` |
| `REVERB_PORT` | Port Reverb | `6001` |
| `SUPER_ADMIN_EMAIL` | Email super admin | `superadmin@example.com` |
| `SUPER_ADMIN_PASSWORD` | Mot de passe | `password` |

### Variables frontend (`frontend/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL de l'API | `http://localhost:8080` |
| `VITE_REVERB_APP_KEY` | Clé Reverb | `smartqueue_key` |
| `VITE_REVERB_HOST` | Hôte Reverb | `localhost` |
| `VITE_REVERB_PORT` | Port Reverb | `6001` |

---

## 📡 API Reference

Documentation complète OpenAPI/Swagger disponible sur `/api/documentation` une fois le backend lancé.

### 🔐 Authentification

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| `POST` | `/api/auth/register` | Inscription usager | Non |
| `POST` | `/api/auth/login` | Connexion (Sanctum token) | Non |
| `POST` | `/api/auth/logout` | Déconnexion | Oui |
| `POST` | `/api/auth/google` | Login OAuth Google | Non |
| `POST` | `/api/auth/google/register` | Inscription OAuth Google | Non |
| `POST` | `/api/auth/devices/register` | Enregistrer device FCM | Oui |

### 🏢 Établissements & Services

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| `GET` | `/api/establishments` | Liste avec géolocalisation | Non |
| `GET` | `/api/establishments/nearby` | Établissements proches | Non |
| `GET` | `/api/establishments/search?q={query}` | Recherche | Non |
| `GET` | `/api/establishments/{id}` | Détail établissement | Non |
| `GET` | `/api/establishments/{id}/services` | Services de l'établissement | Non |
| `GET` | `/api/services/{id}` | Détail service | Non |
| `GET` | `/api/services/{id}/affluence` | Statut d'affluence | Non |
| `GET` | `/api/services/{id}/recommendations` | Suggestions horaires | Non |

### 🎫 Tickets (Usager)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| `POST` | `/api/tickets` | Créer un ticket | Oui |
| `GET` | `/api/tickets/me` | Mes tickets actifs | Oui |
| `GET` | `/api/tickets/active` | Tickets actifs (alias) | Oui |
| `GET` | `/api/tickets/history` | Historique | Oui |
| `GET` | `/api/tickets/{ticket}` | Détail ticket | Oui |
| `PATCH` | `/api/tickets/{ticket}` | Annuler ticket | Oui |

### 🎧 Agent - Gestion des files

| Méthode | Endpoint | Description | Rôle |
|---------|----------|-------------|------|
| `POST` | `/api/services/{service}/call-next` | Appeler prochain ticket | agent, admin |
| `POST` | `/api/services/{service}/open` | Ouvrir service | agent, admin |
| `POST` | `/api/services/{service}/close` | Fermer service | agent, admin |
| `GET` | `/api/services/{service}/queue` | Vue complète file | agent, admin |
| `POST` | `/api/tickets/{ticket}/mark-absent` | Marquer absent | agent, admin |
| `POST` | `/api/tickets/{ticket}/recall` | Rappeler ticket | agent, admin |
| `POST` | `/api/tickets/{ticket}/close` | Clôturer ticket | agent, admin |
| `POST` | `/api/tickets/{ticket}/cancel` | Annuler (agent) | agent, admin |
| `POST` | `/api/tickets/{ticket}/priority` | Changer priorité | agent, admin |
| `POST` | `/api/tickets/{ticket}/defer` | Défer ticket | agent, admin |
| `POST` | `/api/counters/{counter}/open` | Ouvrir guichet | agent, admin |
| `POST` | `/api/counters/{counter}/close` | Fermer guichet | agent, admin |

### 🏢 Admin - Gestion établissement

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET/POST` | `/api/admin/establishments` | CRUD établissements |
| `GET/POST` | `/api/admin/services` | CRUD services |
| `GET/POST` | `/api/admin/agents` | Gestion agents |
| `GET/POST` | `/api/admin/counters` | Gestion guichets |
| `GET` | `/api/admin/stats/overview` | Vue d'ensemble stats |
| `GET` | `/api/admin/stats/services/{id}` | Stats par service |
| `GET` | `/api/admin/tickets` | Liste tickets |
| `GET` | `/api/admin/tickets/stats` | Stats tickets |
| `POST` | `/api/admin/services/{id}/qr-code` | Générer QR code |
| `GET` | `/api/admin/services/{id}/qr-code/download` | Télécharger QR |
| `POST` | `/api/admin/push/broadcast` | Broadcast notification |
| `GET` | `/api/admin/notification-logs` | Logs notifications |

### 🌐 Super Admin SaaS

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET/POST` | `/api/saas/establishments` | Gestion multi-établissements |
| `GET` | `/api/saas/subscriptions` | Liste abonnements |
| `PUT` | `/api/saas/establishments/{id}/subscription` | Modifier abonnement |
| `GET` | `/api/saas/monitoring/overview` | Monitoring plateforme |

### 🔔 Notifications & Préférences

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/notifications` | Mes notifications |
| `GET` | `/api/notifications/unread-count` | Compteur non lues |
| `POST` | `/api/notifications/mark-all-read` | Tout marquer lu |
| `POST` | `/api/notifications/{id}/read` | Marquer lu |
| `GET/PUT` | `/api/notification-preferences` | Préférences notifs |
| `GET/PUT` | `/api/user/alert-preferences` | Préférences alertes |

---

## 🔌 WebSocket / Temps Réel

### Configuration Laravel Echo (Frontend)

```typescript
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT,
  wssPort: import.meta.env.VITE_REVERB_PORT,
  forceTLS: false,
  enabledTransports: ['ws', 'wss'],
  authEndpoint: `${import.meta.env.VITE_API_BASE_URL}/api/broadcasting/auth`,
  auth: {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
});
```

### Canaux et Événements

| Canal | Type | Événements | Description |
|-------|------|------------|-------------|
| `ticket.{id}` | Privé | `TicketCalled`, `TicketUpdated` | Mise à jour individuelle ticket |
| `service.{id}` | Présence | `ServiceTicketCalled`, `ServiceTicketEnqueued`, `ServiceTicketAbsent`, `ServiceStatsUpdated` | État global de la file |

### Exemple d'abonnement

```typescript
// Abonnement aux updates d'un ticket
const channel = echo.private(`ticket.${ticketId}`);
channel.listen('TicketCalled', (e) => {
  console.log('Ticket appelé:', e.ticket);
});

// Abonnement au canal de service (agents)
const presenceChannel = echo.join(`service.${serviceId}`);
presenceChannel.listen('ServiceStatsUpdated', (e) => {
  console.log('Stats mises à jour:', e);
});
```

---

## 🗄 Modèle de données

### Schéma relationnel

```sql
-- Utilisateurs (usagers, agents, admins, super_admin)
users (
  id BIGINT PK AUTO_INCREMENT,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  role ENUM('user','agent','admin','super_admin') DEFAULT 'user',
  establishment_id BIGINT NULL FK,
  google_id VARCHAR(255) NULL,
  avatar VARCHAR(255) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  pending_subscription JSON NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Établissements clients
establishments (
  id BIGINT PK AUTO_INCREMENT,
  name VARCHAR(255),
  address TEXT,
  category VARCHAR(50) NULL,
  lat DECIMAL(10,8) NULL,
  lng DECIMAL(11,8) NULL,
  open_at TIME NULL,
  close_at TIME NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Services (files d'attente)
services (
  id BIGINT PK AUTO_INCREMENT,
  establishment_id BIGINT FK,
  name VARCHAR(255),
  avg_service_time_minutes INT DEFAULT 5,
  capacity INT NULL,
  status ENUM('open','closed','paused') DEFAULT 'closed',
  priority_support BOOLEAN DEFAULT FALSE,
  qr_code_token VARCHAR(255) NULL,
  qr_code_url TEXT NULL,
  qr_generated_at TIMESTAMP NULL,
  opening_time TIME NULL,
  closing_time TIME NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Guichets physiques
counters (
  id BIGINT PK AUTO_INCREMENT,
  establishment_id BIGINT FK,
  name VARCHAR(255),
  status ENUM('open','closed') DEFAULT 'closed',
  agent_id BIGINT NULL FK,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tickets
tickets (
  id BIGINT PK AUTO_INCREMENT,
  user_id BIGINT FK,
  service_id BIGINT FK,
  counter_id BIGINT NULL FK,
  number VARCHAR(50),
  status ENUM('waiting','called','absent','closed','canceled','expired') DEFAULT 'waiting',
  priority ENUM('normal','high','vip') DEFAULT 'normal',
  position INT,
  source ENUM('app','qr_scan') DEFAULT 'app',
  valid_date DATE,
  called_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  absent_at TIMESTAMP NULL,
  deferred_at TIMESTAMP NULL,
  deferral_count INT DEFAULT 0,
  is_swapped BOOLEAN DEFAULT FALSE,
  swapped_with_ticket_id BIGINT NULL,
  original_called_at TIMESTAMP NULL,
  grace_period_expires_at TIMESTAMP NULL,
  has_recalled BOOLEAN DEFAULT FALSE,
  en_route_at TIMESTAMP NULL,
  estimated_travel_minutes INT NULL,
  last_distance_m INT NULL,
  last_seen_at TIMESTAMP NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Abonnements SaaS
subscriptions (
  id BIGINT PK AUTO_INCREMENT,
  establishment_id BIGINT FK,
  plan ENUM('basic','pro','enterprise') DEFAULT 'basic',
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  payment_method VARCHAR(50) NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Logs notifications envoyées
notification_logs (
  id BIGINT PK AUTO_INCREMENT,
  user_id BIGINT FK,
  ticket_id BIGINT NULL FK,
  channel ENUM('push','sms','email'),
  status ENUM('pending','sent','failed'),
  content TEXT,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Préférences notifications
notification_preferences (
  id BIGINT PK AUTO_INCREMENT,
  user_id BIGINT FK,
  push_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  email_enabled BOOLEAN DEFAULT TRUE,
  notify_when_called BOOLEAN DEFAULT TRUE,
  notify_when_absent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Analytics events
analytics_events (
  id BIGINT PK AUTO_INCREMENT,
  type VARCHAR(50),
  service_id BIGINT FK,
  ticket_id BIGINT NULL FK,
  user_id BIGINT NULL FK,
  metadata JSON NULL,
  created_at TIMESTAMP
);
```

### Cycle de vie d'un ticket

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ WAITING │───►│ CALLED  │───►│ ABSENT  │───►│ CLOSED  │
│ (file)  │    │(appelé) │    │(absent) │    │(terminé)│
└────┬────┘    └────┬────┘    └────┬────┘    └─────────┘
     │              │              │
     │ cancel       │ defer        │ recall
     ▼              │ (24h)        │
┌─────────┐         │              ▼
│ CANCELED│         │         ┌─────────┐
│(annulé) │◄────────┴─────────│ CALLED  │
└─────────┘                      │(rappelé)│
                                 └─────────┘
```

---

## 🔒 Sécurité

### Authentification

- **Laravel Sanctum** : Tokens API stateless
- **OAuth Google** : Authentification sociale
- **Middleware rôles** : `role:agent,admin`, `role:super_admin`
- **Policies** : Vérification des permissions par ressource

### Autorisation

| Rôle | Permissions |
|------|-------------|
| `user` | CRUD ses propres tickets, notifications |
| `agent` | Gérer les files assignées, appeler tickets |
| `admin` | CRUD établissement, services, agents, stats |
| `super_admin` | Gestion SaaS, tous les établissements |

### Broadcast sécurisé

- Canal `ticket.{id}` : vérification propriétaire du ticket
- Canal `service.{id}` : agents/admins ou usagers avec ticket actif

---

## 🚢 Déploiement

### Production avec Docker

```bash
# Générer la clé APP_KEY
docker compose exec backend php artisan key:generate

# Mettre à jour .env pour production
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.smartqueue.example.com

# Migrer la base
docker compose exec backend php artisan migrate --force

# Optimiser Laravel
docker compose exec backend php artisan optimize
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache
```

### Variables essentielles production

```env
APP_KEY=base64:...          # Générée avec key:generate
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.domain.com

DB_HOST=...                 # DB production
DB_PASSWORD=...             # Mot de passe fort

REVERB_HOST=reverb.domain.com
REVERB_PORT=443
REVERB_SCHEME=https

# Throttling
RATE_LIMIT_PER_MINUTE=60
```

### Checklist déploiement

- [ ] Clé APP_KEY générée et unique
- [ ] HTTPS activé avec certificats valides
- [ ] Variables d'environnement configurées
- [ ] Base de données migrée
- [ ] Redis configuré et accessible
- [ ] Rate limiting activé
- [ ] Logs configurés (stderr pour Docker)
- [ ] Sauvegardes automatiques configurées
- [ ] Monitoring en place (healthchecks)

---

## 🧪 Tests

### Backend (Laravel)

```bash
# Lancer tous les tests
docker compose exec backend php artisan test

# Avec couverture
docker compose exec backend php artisan test --coverage

# Tests spécifiques
docker compose exec backend php artisan test --filter=TicketTest
```

### Frontend (React)

```bash
cd frontend
npm run build        # Vérifier le build
npm run lint         # ESLint
```

### Mobile (React Native)

```bash
cd react-native/smartqueue
npm run lint         # ESLint
npx tsc --noEmit     # Type checking
```

---

## 📈 Roadmap

| Statut | Fonctionnalité | Version |
|--------|----------------|---------|
| ✅ | Authentification complète (Sanctum, OAuth) | v1.0 |
| ✅ | Gestion des tickets temps réel | v1.0 |
| ✅ | Dashboard Agent & Admin | v1.0 |
| ✅ | Notifications Push & SMS | v1.0 |
| ✅ | QR Code scanning | v1.0 |
| ✅ | Déféré de position | v1.0 |
| ✅ | Analytics & exports | v1.0 |
| 🔄 | Borne physique (kiosk mode) | v1.1 |
| 📋 | ML prédiction d'affluence | v2.0 |
| 📋 | Intégrations calendriers | v2.0 |
| 📋 | App iOS/Android native build | v2.0 |

---

## 🤝 Contribution

Les contributions sont les bienvenues !

```bash
# 1. Fork et clone
git clone https://github.com/votre-username/smartqueue.git

# 2. Branche feature
git checkout -b feature/nouvelle-fonctionnalite

# 3. Commits conventionnels
git commit -m "feat(tickets): ajout du système de priorité dynamique"
git commit -m "fix(ws): correction reconnexion WebSocket"
git commit -m "docs(api): mise à jour endpoints notifications"

# 4. Push et PR
git push origin feature/nouvelle-fonctionnalite
```

Conventions : [Conventional Commits](https://www.conventionalcommits.org/)
- `feat:` nouvelle fonctionnalité
- `fix:` correction bug
- `docs:` documentation
- `refactor:` refactoring
- `test:` tests

---

## 📄 Licence

Distribué sous licence **MIT**. Voir [LICENSE](LICENSE).

**Modèle Open-Core** : Le noyau (gestion de file, tickets, interface usager) reste open source. Les modules avancés (analytics ML, intégrations tierces) peuvent faire l'objet d'une offre commerciale.

---

<div align="center">

**SmartQueue — Parce que le temps de chacun a de la valeur.**

Built with ❤️ using Laravel, React, and React Native

</div>
