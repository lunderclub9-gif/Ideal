# GestionPro DZ

Application de bureau Windows locale destinée aux entreprises algériennes du bâtiment, des travaux publics (BTP) et des services.

GestionPro DZ regroupe dans une application de bureau Windows la gestion des chantiers, des clients, des équipes, des achats, des stocks, du parc matériel, de la facturation et de la trésorerie. L'interface actuelle est principalement en français et utilise le dinar algérien (DZD).

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

L'application de bureau utilise Electron pour afficher l'interface et démarrer le serveur Express sur l'adresse loopback 127.0.0.1. Elle est empaquetée pour Windows x64 avec un installateur NSIS. Le serveur n'écoute pas sur le réseau local.

## Installer l'application sur Windows

Le dépôt contient désormais une configuration de génération d'un installateur Windows x64 :

- Fichier produit : `GestionPro-DZ-Setup-0.1.0.exe`.
- Installation utilisateur Windows (aucun droit administrateur normalement requis).
- Raccourcis dans le menu Démarrer et sur le Bureau.
- Fenêtre de bureau native fournie par Electron.
- Serveur Express local démarré automatiquement en arrière-plan.
- Base SQLite et documents stockés dans le dossier de données de l'utilisateur Windows.
- Désinstallation sans suppression automatique des données.

Le build Windows est automatisé par GitHub Actions. Après la réussite du workflow, l'installateur est publié dans les Releases GitHub du dépôt.

### Télécharger

Ouvrir la page [GitHub Releases](https://github.com/lunderclub9-gif/Ideal/releases/latest) et télécharger `GestionPro-DZ-Setup-0.1.0.exe`.

> Le programme n'est pas encore signé par un certificat de signature de code. Windows SmartScreen peut donc afficher un avertissement d'éditeur inconnu. Ne lancer que le fichier téléchargé depuis les Releases officielles de ce dépôt.

### Installation

1. Télécharger le fichier `.exe`.
2. Double-cliquer dessus.
3. Choisir le dossier d'installation si nécessaire.
4. Terminer l'installation ; GestionPro DZ démarre automatiquement.
5. Utiliser le raccourci du Bureau ou du menu Démarrer pour les lancements suivants.

Aucun Node.js, Python, SQLite, serveur cloud ou compte Supabase/Firebase n'est requis sur le PC cible. Les dépendances de l'application sont intégrées au programme.

## Développement et compilation

Prérequis développeur : Node.js 22 et npm.

~~~bash
npm install
npm run dev
~~~

Le mode développement ouvre le serveur local sur `http://127.0.0.1:3000`.

Commandes utiles :

| Commande | Description |
|---|---|
| `npm run dev` | Démarre Express et Vite en mode développement. |
| `npm run lint` | Vérification TypeScript avec `tsc --noEmit`. |
| `npm run build` | Construit le frontend et le serveur de production. |
| `npm run dist:win` | Génère l'installateur Windows x64 dans `release/`. |
| `npm run clean` | Supprime les dossiers de compilation et de distribution. |

Le build Windows doit être effectué sur un environnement Windows (GitHub Actions utilise `windows-latest`).

## Données locales et confidentialité

Dans la version installée, les données sont stockées dans le dossier utilisateur Windows fourni par Electron, sous :

~~~text
%APPDATA%/GestionPro-DZ/data/
├── gestionpro.db
├── Documents/
└── backups/
~~~

Le chemin exact dépend du profil Windows. La base SQLite n'est pas envoyée vers un service cloud par l'architecture du programme. Le serveur écoute uniquement sur `127.0.0.1:3000` ; ce port fixe permet de conserver les sessions locales entre les lancements.

Les données restent après une mise à jour et ne sont pas supprimées automatiquement par le désinstallateur. Effectuer régulièrement des sauvegardes externes (par exemple sur une clé USB). Avant d'utiliser des données réelles, tester une restauration de sauvegarde.

Pour transférer des données depuis une ancienne installation de développement, arrêter l'application et copier le dossier `data` vers le dossier de données GestionPro DZ indiqué ci-dessus, en conservant une sauvegarde originale.

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

- L'application de bureau génère et conserve un secret de session aléatoire propre à l'installation dans le dossier utilisateur Windows. En mode développement, définir SESSION_SECRET avec une valeur aléatoire.
- Le serveur de l'application de bureau écoute uniquement sur 127.0.0.1:3000. Le port stable permet de conserver la session locale du navigateur entre les démarrages.
- L'interface charge actuellement des polices depuis Google Fonts ; leur chargement dépend d'une connexion Internet, même si le serveur et la base de données sont locaux.
- Le périmètre fonctionnel de GestionPro DZ ne requiert pas de service d'intelligence artificielle.
- Les taux et règles fiscales fournis dans les données de démonstration ne remplacent pas une validation par un comptable algérien. Les règles doivent être vérifiées et configurées selon la situation réelle et la législation applicable.
- Le programme Windows est empaqueté avec Electron et utilise SQLite dans le dossier de données utilisateur. Les mises à jour automatiques intégrées ne sont pas configurées : installer une nouvelle version depuis GitHub Releases.
- Le dépôt ne fournit pas encore de suite de tests automatisés métier clairement identifiée. Le build et la vérification TypeScript ne suffisent pas à prouver que tous les scénarios fonctionnent.

## Structure principale du dépôt

~~~text
.
├── server.ts
├── electron/
│   └── main.cjs
├── .github/workflows/
│   └── windows-installer.yml
├── package.json
├── vite.config.ts
├── index.html
├── server/
│   ├── auth.ts
│   ├── backup.ts
│   ├── calculations.ts
│   ├── db.ts
│   └── routes.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── components/
    ├── lib/
    └── pages/
~~~

## Périmètre du projet

GestionPro DZ vise une gestion locale et intégrée des activités d'une entreprise BTP algérienne. Le périmètre fonctionnel est conçu sans dépendance à une fonctionnalité d'intelligence artificielle. Le dépôt doit toutefois être audité pour confirmer l'absence de tout appel IA et supprimer les dépendances inutilisées.

## Licence

Aucune licence open source n'a été identifiée dans les fichiers examinés. Tous droits et conditions d'utilisation restent à définir par le propriétaire du dépôt.
