# GestionPro DZ

Application de gestion intégrée destinée aux entreprises algériennes du bâtiment, des travaux publics (BTP) et des services.

GestionPro DZ regroupe dans une interface web locale la gestion des chantiers, des clients, des équipes, des achats, des stocks, du parc matériel, de la facturation et de la trésorerie. L'interface actuelle est principalement en français et utilise le dinar algérien (DZD).

> **État du projet :** dépôt en développement. Ce README décrit les fonctionnalités repérées dans le code source. Il ne constitue pas une certification de mise en production : les parcours métier, les calculs réglementaires, la sécurité et la restauration doivent encore être testés sur un environnement de validation.

## Fonctionnalités

### Pilotage et gestion commerciale
- Tableau de bord avec indicateurs de gestion.
- Gestion des clients et de leurs informations administratives.
- Gestion des chantiers, phases, tâches, responsables, échéances et retards.
- Suivi des avenants et des contrats avec échéanciers de paiement.
- Devis, proformas, bons de livraison, factures, avoirs et paiements.
- Suivi des montants encaissés et des soldes restant à recevoir.

### Personnel et paie
- Gestion des employés et de leurs informations professionnelles.
- Pointage et validation des présences.
- Préparation de la paie à partir des données de présence.
- Paramètres et indicateurs liés aux retenues et cotisations configurables.

### Achats, stocks et équipements
- Gestion des matériaux et des mouvements de stock.
- Seuils d'alerte de stock minimum.
- Gestion des fournisseurs et des bons de commande.
- Réception des achats et suivi des paiements fournisseurs.
- Gestion des véhicules et engins.
- Suivi du carburant, du kilométrage et des réparations.
- Règles de maintenance préventive.
- Affectation et retour des outils aux travailleurs.

### Finance et administration
- Suivi de la caisse et des comptes bancaires.
- Transferts internes, mouvements et clôtures de caisse.
- Enregistrement des dépenses.
- Indicateurs fiscaux configurables (TVA, CNAS, IRG, IBS et autres règles présentes dans l'application).
- Centre de documents et classement des pièces jointes.
- Rapports.
- Paramètres de l'entreprise, utilisateurs, rôles et journal d'audit.
- Importation de données Excel/CSV avec aperçu avant confirmation.
- Création et restauration d'archives ZIP comprenant la base SQLite et les documents.

## Technologies

- **Frontend :** React 19, TypeScript, Vite 8, Tailwind CSS 4.
- **Backend :** Node.js, Express 4 et TypeScript exécuté avec tsx.
- **Base de données :** SQLite avec better-sqlite3, mode WAL et clés étrangères activées.
- **Autres composants :** Motion, Lucide React, SheetJS (XLSX), AdmZip et Multer.

L'architecture actuelle est une application web servie localement par Express. Le dépôt ne contient pas, à la date de rédaction, de configuration Tauri ou Electron : il ne faut donc pas la présenter comme un installateur Windows natif.

## Prérequis

- Node.js 22 LTS recommandé (ou une version compatible avec Vite 8).
- npm.
- Windows, Linux ou macOS pour le développement, sous réserve de la disponibilité des outils de compilation nécessaires à better-sqlite3.

## Installation et lancement en développement

Depuis la racine du dépôt :

~~~bash
npm install
npm run dev
~~~

Le serveur démarre sur :

~~~text
http://localhost:3000
~~~

Le port est actuellement défini en dur à 3000 dans server.ts.

## Vérifications et build

Vérification TypeScript (script nommé lint dans le dépôt) :

~~~bash
npm run lint
~~~

Build de production du frontend :

~~~bash
npm run build
~~~

Lancement du serveur en mode production après le build :

**Windows PowerShell**
~~~powershell
$env:NODE_ENV = "production"
npm start
~~~

**Linux / macOS**
~~~bash
NODE_ENV=production npm start
~~~

Puis ouvrir http://localhost:3000.

Scripts disponibles :

| Commande | Description |
|---|---|
| npm run dev | Démarre le serveur Express avec Vite en mode développement. |
| npm start | Démarre le serveur Node.js. Définir NODE_ENV=production après le build pour servir dist. |
| npm run build | Construit les fichiers frontend dans dist. |
| npm run preview | Lance l'aperçu Vite du build frontend. |
| npm run lint | Exécute tsc --noEmit (vérification TypeScript, pas un linter stylistique). |
| npm run clean | Supprime dist et server.js via une commande shell Unix. |

## Données locales et sauvegardes

Au démarrage, l'application crée le dossier data/ à la racine du répertoire de travail si nécessaire.

| Chemin | Contenu |
|---|---|
| data/gestionpro.db | Base de données SQLite. |
| data/Documents/ | Documents téléversés et classés par catégorie. |
| data/backups/ | Archives ZIP de sauvegarde. |

La base est configurée avec SQLite WAL et l'activation des clés étrangères. Le code de sauvegarde crée un instantané SQLite avec VACUUM INTO, vérifie PRAGMA integrity_check, ajoute les documents au ZIP et inclut un manifeste avec une empreinte SHA-256 de la base.

**Important :** conservez des copies de sauvegarde hors de l'ordinateur principal. Avant toute utilisation réelle, testez la restauration sur une copie de l'environnement et vérifiez que les documents associés sont présents et lisibles. Ne manipulez pas directement le fichier SQLite pendant que le serveur fonctionne.

## Comptes de démonstration

Le code d'initialisation crée des comptes de démonstration lorsque la table des utilisateurs est vide :

| Rôle | Identifiant | Mot de passe initial |
|---|---|---|
| Administrateur | admin | admin123 |
| Comptable | comptable | compta123 |
| Chef de chantier | chef | chef123 |
| Magasinier | magasinier | stock123 |
| Chauffeur | chauffeur | driver123 |

> **Sécurité :** ces identifiants sont publics et réservés aux essais locaux. Ne les utilisez jamais sur une instance contenant des données réelles. Remplacez-les avant toute démonstration externe ou mise en service. Les mots de passe sont hachés avec scrypt dans le code, mais cela ne rend pas sûrs des mots de passe initiaux connus.

## Rôles et autorisations

Les rôles présents dans le code sont :
- Administrateur / propriétaire.
- Comptable.
- Chef de chantier.
- Magasinier.
- Chauffeur / opérateur.

Les autorisations sont vérifiées côté serveur par des permissions associées aux rôles. L'interface masque également les modules auxquels l'utilisateur n'a pas accès.

## Configuration et points de vigilance

- La variable SESSION_SECRET doit être définie avec une valeur aléatoire forte avant tout déploiement. Le code contient actuellement une valeur de secours si cette variable est absente.
- Le serveur écoute actuellement sur 0.0.0.0:3000. Ne l'exposez pas à un réseau public sans configuration de sécurité et de pare-feu appropriée.
- L'interface charge actuellement des polices depuis Google Fonts ; leur chargement dépend d'une connexion Internet, même si le serveur et la base de données sont locaux.
- Le paquet @google/genai figure dans les dépendances du projet. Aucune fonctionnalité IA n'est décrite dans ce README ; cette dépendance doit être auditée et retirée si elle n'est pas utilisée, conformément au périmètre sans IA.
- Les taux et règles fiscales fournis dans les données de démonstration ne remplacent pas une validation par un comptable algérien. Les règles doivent être vérifiées et configurées selon la situation réelle et la législation applicable.
- L'application utilise actuellement un serveur Express et une base locale dans data/. Une installation Windows native Tauri, le stockage dans le répertoire de données utilisateur de Windows, la gestion des mises à jour et les tests de reprise après coupure restent à confirmer ou à réaliser.
- Le dépôt ne fournit pas encore de suite de tests automatisés métier clairement identifiée. Le build et la vérification TypeScript ne suffisent pas à prouver que tous les scénarios fonctionnent.

## Structure principale du dépôt

~~~text
.
├── server.ts                 # Démarrage Express + Vite
├── package.json              # Dépendances et scripts
├── vite.config.ts            # Configuration Vite / React / Tailwind
├── index.html
├── server/
│   ├── auth.ts               # Authentification et permissions
│   ├── backup.ts             # Sauvegarde et restauration ZIP
│   ├── calculations.ts       # Calculs métier et fiscaux
│   ├── db.ts                 # SQLite et migrations
│   ├── routes.ts             # API Express
│   └── seed.ts               # Données initiales de démonstration
└── src/
    ├── App.tsx               # Navigation et assemblage des modules
    ├── main.tsx              # Point d'entrée React
    ├── components/           # Composants d'interface
    ├── lib/                  # Client API et utilitaires
    └── pages/                # Pages métier
~~~

## Périmètre du projet

GestionPro DZ vise une gestion locale et intégrée des activités d'une entreprise BTP algérienne. Le périmètre fonctionnel est conçu sans dépendance à une fonctionnalité d'intelligence artificielle. Le dépôt doit toutefois être audité pour confirmer l'absence de tout appel IA et supprimer les dépendances inutilisées.

## Licence

Aucune licence open source n'a été identifiée dans les fichiers examinés. Tous droits et conditions d'utilisation restent à définir par le propriétaire du dépôt.
