# TP 4 - Serveur et API · Carnet de bord G8

## Partie 1 · Base de données locale

### Étapes réalisées

1. Création de la base `meteo_g8` et des tables `stations` et `mesures`, conformes au contrat d'interface (section 4), sans la table `utilisateurs` (TP 6). Script : [`api/sql/schema.sql`](api/sql/schema.sql).
2. Insertion de la station du groupe `ST-G8` et de deux stations de test `ST-TEST1` et `ST-TEST2`.
3. Création de l'utilisateur `app_g8` avec uniquement `SELECT`, `INSERT`, `UPDATE`, `DELETE` sur `meteo_g8`. Script : [`api/sql/user.sql`](api/sql/user.sql).

Le mot de passe de `app_g8` n'est pas versionné : le script contient `__MOT_DE_PASSE__`, remplacé à l'exécution. Le vrai mot de passe est uniquement dans `api/.env` (ignoré par Git, modèle dans `api/.env.example`).

```bash
mysql -u root -p < api/sql/schema.sql
sed "s/__MOT_DE_PASSE__/<mot_de_passe>/g" api/sql/user.sql | mysql -u root -p
```

### Vérifications

| Test (connecté en `app_g8`) | Résultat attendu | Résultat |
|---|---|---|
| `SHOW GRANTS` | `SELECT, INSERT, UPDATE, DELETE ON meteo_g8.*` uniquement | OK |
| `SHOW DATABASES` | Seule `meteo_g8` est visible | OK |
| `INSERT` / `SELECT` / `UPDATE` / `DELETE` sur `mesures` | Autorisés | OK |
| `INSERT` d'une mesure pour une station inexistante | Refusé par la clé étrangère (erreur 1452) | OK |
| `DROP TABLE mesures` | Refusé (erreur 1142) | OK |
| `CREATE TABLE` | Refusé (erreur 1142) | OK |
| `SELECT` sur `mysql.user` | Refusé (erreur 1142) | OK |
| Relance de `schema.sql` | Aucune erreur, aucune donnée supprimée | OK |

### Problème rencontré

Lors du `GRANT`, MariaDB (XAMPP) a renvoyé `Got error 176 "Read page with wrong checksum" from storage engine Aria`. La table système `mysql.db` était corrompue (`CHECK TABLE mysql.db` → `Corrupt`). Résolution : sauvegarde des fichiers `db.*`, puis `REPAIR TABLE mysql.db`, puis nouvelle exécution du script utilisateur.

### Questions

**Pourquoi l'API ne se connecte-t-elle pas avec le compte `root` ?**

C'est le principe du moindre privilège. `root` a tous les droits sur toutes les bases du serveur. Si l'API est compromise (injection SQL, fuite du fichier `.env`), un attaquant pourrait supprimer ou modifier toutes les bases, créer des comptes ou lire celles de l'autre groupe sur la Raspberry partagée (risques R6 et R9 du TP 1). Avec `app_g8`, il est limité à lire et écrire des lignes dans `meteo_g8` : il ne peut ni supprimer de table, ni modifier la structure, ni atteindre une autre base. Un compte dédié permet aussi de changer son mot de passe ou de le désactiver sans toucher à l'administration.

**À quoi sert l'index `idx_station_date` ?**

Il indexe le couple `(station_id, horodatage)` de la table `mesures`. Les routes de l'API filtrent presque toujours par station puis par période (`/api/mesures?station=&debut=&fin=`, `/api/stats`, `/api/stations/:id/derniere`) et trient par horodatage. Sans index, MariaDB parcourrait toute la table, qui grossit de 8 640 lignes par jour et par station (une mesure toutes les 10 s). Avec l'index, il va directement aux mesures de la station, déjà classées par date. La dernière mesure ou une plage de dates sont donc retrouvées rapidement. Cet index sert aussi pour la clé étrangère `fk_mesures_station`.

## Partie 2 · Développement de l'API

### Organisation

```
api/
  src/
    app.js          application Express, route 404 JSON, gestion des erreurs, démarrage
    db.js           pool de connexions mysql2 (timezone 'Z', session MariaDB en UTC)
    validation.js   contrôle d'une mesure reçue et des paramètres debut / fin
    routes/
      mesures.js    POST /api/mesures, GET /api/mesures
      stations.js   GET /api/stations, GET /api/stations/:id/derniere
      stats.js      GET /api/stats
  sql/
    schema.sql
    user.sql
  .env.exemple
  package.json
```

Installation et lancement :

```bash
cd api
npm install
cp .env.exemple .env     # puis renseigner DB_PASSWORD
npm start                # API sur le port 3008
```

### Choix techniques

- **Requêtes paramétrées** : toutes les valeurs passent par `pool.execute(sql, [valeurs])` avec des `?`. Les seules parties de SQL ajoutées dynamiquement (filtre `station_id`, `ORDER BY`, `LIMIT`) sont des chaînes fixes écrites dans le code, jamais des données de la requête.
- **UTC** : `timezone: 'Z'` dans le pool, et `SET time_zone = '+00:00'` à chaque connexion pour que `CURRENT_TIMESTAMP` (`recu_le`, `cree_le`) soit aussi en UTC.
- **Erreurs** : un gestionnaire central renvoie `500 { "erreur": "Erreur interne" }`. Le détail (message et pile) est écrit dans le journal du serveur avec la date, la méthode et l'URL. Un JSON mal formé renvoie `400 { "erreur": "JSON invalide" }`.
- **404** : toute route inconnue renvoie `{ "erreur": "Route inexistante" }`.
- **Statistiques** : une seule requête `COUNT / MIN / MAX / AVG`, moyennes arrondies à 0,1. Sans mesure sur la période, `nombre` vaut 0 et les valeurs `null`.
- `GET /api/stations` ne renvoie pas `cle_api_hash` : même haché, un secret n'a pas à sortir de l'API.
- `limite` hors de 1 à 5000 renvoie 400 plutôt que d'être corrigée silencieusement.

### Tests réalisés (curl)

| Requête | Attendu | Obtenu |
|---|---|---|
| POST mesure valide | 201 + mesure avec `id` | 201 |
| POST station inconnue (`ST-G99`) | 400 | 400 |
| POST `station_id` en minuscules / tentative d'injection `ST-G8' OR 1=1 --` | 400 | 400 |
| POST température 70, ou en chaîne `"21"` | 400 | 400 |
| POST humidité 48.5 / luminosité 101 | 400 | 400 |
| POST horodatage +10 min / date impossible | 400 | 400 |
| POST champ manquant / JSON mal formé | 400 | 400 |
| GET /api/stations | 200, 3 stations | 200 |
| GET /api/stations/ST-G8/derniere | 200, mesure la plus récente | 200 |
| GET /api/stations/ST-TEST2/derniere (aucune mesure) | 404 | 404 |
| GET /api/mesures (sans paramètre) | 200, dernières 24 h, ordre croissant | 200 |
| GET /api/mesures?station=ST-G8&debut=…&limite=2 | 200, 2 mesures | 200 |
| GET /api/mesures?limite=0 / limite=9999 | 400 | 400 |
| GET /api/mesures?debut après fin / debut=hier | 400 | 400 |
| GET /api/stats?station=ST-G8 | 200, format du contrat | 200 |
| GET /api/stats sans station | 400 | 400 |
| GET /api/inexistante | 404 JSON | 404 |
| Base inaccessible (mauvais mot de passe) | 500 `Erreur interne`, détail dans le journal | 500 |

### Problèmes rencontrés

- **Décalage de 2 h sur `cree_le`** : MariaDB tournait à l'heure de Paris, donc `CURRENT_TIMESTAMP` enregistrait l'heure locale, relue ensuite comme de l'UTC par l'API. Correction : `SET time_zone = '+00:00'` dans `schema.sql` et à chaque connexion du pool.
- **Accents abîmés (« dÃ©veloppement »)** : sous Windows, le client `mysql` lit les fichiers en `cp850`. Correction : `SET NAMES utf8mb4;` en tête de `schema.sql`.

## Partie 3 · Tests

Tests réalisés avec Thunder Client, API démarrée en local sur le port 3008.

| N° | Cas | Code attendu | Code obtenu |
|---|---|---|---|
| 1 | Mesure valide | 201 | 201 |
| 2 | Champ humidite absent | 400 | 400 |
| 3 | Température à 99 | 400 | 400 |
| 4 | Station inconnue | 400 | 400 |
| 5 | Corps qui n'est pas du JSON | 400 | 400 |
| 6 | Dernière mesure d'une station inconnue | 404 | 404 |
| 7 | Historique avec une date debut invalide | 400 | 400 |
| 8 | Liste des stations | 200 | 200 |
| 9 | Dernière mesure de ST-G8 | 200 | 200 |
| 10 | Historique de ST-G8 (24 h par défaut) | 200 | 200 |
| 11 | Statistiques de ST-G8 | 200 | 200 |
| 12 | Horodatage 10 min dans le futur | 400 | 400 |
| 13 | Humidité décimale (48.5) | 400 | 400 |
| 14 | Luminosité à 101 | 400 | 400 |
| 15 | Température envoyée en texte ("21") | 400 | 400 |
| 16 | station_id en minuscules (st-g8) | 400 | 400 |
| 17 | Tentative d'injection SQL dans station_id | 400 | 400 |
| 18 | Historique avec limite=9999 | 400 | 400 |
| 19 | Historique avec debut postérieur à fin | 400 | 400 |
| 20 | Statistiques sans paramètre station | 400 | 400 |
| 21 | Route inexistante | 404 | 404 |

Résultat : 21 / 21.

### Simulateur (5 minutes)

Simulateur lancé vers `http://localhost:3008` pour la station ST-G8 pendant 5 minutes : 30 mesures envoyées, 30 réponses 201.

| | Nombre | Température min / max / moy | Humidité min / max / moy | Luminosité min / max / moy |
|---|---|---|---|---|
| Calcul du simulateur | 30 | 19.8 / 21.8 / 20.9 | 47 / 59 / 53.2 | 45 / 67 / 55.8 |
| Requête SQL directe | 30 | 19.8 / 21.8 / 20.9 | 47 / 59 / 53.2 | 45 / 67 / 55.8 |
| `GET /api/stats` (avant correction) | 29 | 19.8 / 21.8 / 20.9 | 47 / 59 / 53.3 | 45 / 67 / 55.7 |
| `GET /api/stats` (après correction) | 30 | 19.8 / 21.8 / 20.9 | 47 / 59 / 53.2 | 45 / 67 / 55.8 |

**Problème trouvé** : la colonne `horodatage` est un `DATETIME` sans millisecondes. La première mesure (13:02:44.247) était enregistrée 13:02:44, donc exclue d'une période commençant à 13:02:44.244. Correction : l'horodatage reçu et le début de période sont ramenés à la seconde dans `validation.js`.
