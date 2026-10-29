# TP 1 - Lancement du projet et analyse de risque

## Groupe

- Groupe : G8
- Membres : Raphael / Mathys
- Dépôt : `meteo-g8`
- Raspberry de production : `rpi-d` (partagée avec G7)
- Site pour le TP3 : Site 2 (R2 / SW2)

## 1. Vérification du poste

Avant de commencer le projet, les outils demandés dans la présentation globale sont à vérifier :

- VSCode
- Node.js LTS avec npm
- MariaDB ou MySQL 8
- Git
- Client SSH
- Client REST (Thunder Client, Postman ou curl)
- Terminal série
- Arduino IDE 2 / PlatformIO pour les TP utilisant l'Arduino

Commandes utilisées pour les vérifications :

```bash
node -v
npm -v
mariadb --version
# ou : mysql --version

git --version
ssh -V
```

> Les captures d'écran de vérification seront ajoutées après la vérification réelle du poste.

---

## 2. Découverte du projet

Le projet consiste à surveiller les conditions climatiques de trois bâtiments. Chaque station mesure la température, l'humidité et la luminosité. Les mesures sont transmises à une passerelle Raspberry, puis à une API centrale, stockées en base de données et consultables depuis une interface web. Le système comporte aussi une réplication et des sauvegardes sur Proxmox. 

### 2.1 Quel équipement ajoute l'horodatage à une mesure ? Pourquoi pas l'Arduino ?

C'est la passerelle Raspberry qui ajoute l'horodatage. L'Arduino sert surtout à récupérer les valeurs des capteurs et à envoyer une trame série. La passerelle a la responsabilité d'ajouter l'identifiant de la station et la date avant l'envoi à l'API.

Le fait de mettre l'horodatage à cet endroit permet aussi d'avoir une référence de temps commune pour les données transmises vers le serveur.

### 2.2 Pourquoi utiliser l'heure UTC ?

Les mesures sont enregistrées en UTC pour éviter les problèmes liés aux heures locales et au changement d'heure. Comme les trois sites doivent envoyer leurs mesures au même serveur, utiliser une même référence facilite la comparaison et le classement des mesures dans le temps.

### 2.3 Que fait la passerelle si l'API ne répond pas ? Quel risque cela couvre-t-il ?

La passerelle conserve temporairement les mesures lorsque l'API est indisponible et les renvoie plus tard. Cela évite de perdre directement les mesures pendant une coupure réseau ou une panne du serveur.

Le risque principalement couvert est donc la perte de données ou la perte de mesures liée à une indisponibilité temporaire de l'API.

### 2.4 Pourquoi une station ne peut-elle pas joindre le VLAN UTILISATEURS ?

Le VLAN STATIONS est volontairement isolé du VLAN UTILISATEURS. Le contrat de flux indique que les stations n'ont aucun accès vers les utilisateurs. Les flux entre VLAN sont filtrés par des ACL sur le réseau Cisco.

Cette séparation limite les communications inutiles et réduit les possibilités de propagation d'une compromission d'une station vers les postes utilisateurs.

### 2.5 Trois éléments qui isolent deux groupes sur une même Raspberry

Pour G8, la Raspberry `rpi-d` est partagée avec G7. L'isolation repose notamment sur :

1. un compte Linux distinct pour chaque groupe (`g7` / `g8`) ;
2. une base de données distincte (`meteo_g7` / `meteo_g8`) avec un utilisateur SQL distinct (`app_g7` / `app_g8`) ;
3. des ports d'écoute distincts pour les services web et API.

Pour G8, les paramètres prévus sont :

| Élément | Valeur G8 |
|---|---|
| Compte Linux | `g8` |
| Base de données | `meteo_g8` |
| Utilisateur BDD | `app_g8` |
| Port API Node.js | `3008` |
| Port web HTTP | `8008` |
| Port web HTTPS | `8448` |
| Station | `ST-G8` |
| VM Proxmox | `vm-g8` |

### 2.6 Différence entre réplication et sauvegarde

La réplication consiste à maintenir une copie des données sur un autre système afin de disposer d'une autre instance des données. Elle sert notamment à améliorer la continuité de service ou à disposer d'un réplica.

La sauvegarde consiste à créer une copie destinée à pouvoir restaurer les données après une suppression, une corruption, une panne ou un autre incident. Une sauvegarde est donc utilisée dans une logique de restauration, alors qu'une réplication garde principalement une copie synchronisée ou proche de l'original.

---

## 3. Schéma détaillé du site

Le schéma du groupe G8 représente le **site 2** utilisé pour le TP3, avec le routeur R2 et le switch SW2. L'Arduino communique avec la passerelle par USB série ; l'énoncé ne lui attribue donc pas d'adresse IP propre.

### Adressage retenu pour le site 2

| VLAN | Nom | Réseau | Adresse utile |
|---|---|---|---|
| 10 | STATIONS | `10.2.10.0/24` | Réseau réservé aux stations, passerelle `.254` |
| 20 | SERVEURS | `10.2.20.0/24` | Raspberry serveur en `.10`, passerelle `.254` |
| 30 | UTILISATEURS | `10.2.30.0/24` | DHCP de `.100` à `.199`, passerelle `.254` |
| 99 | ADMINISTRATION | `10.2.99.0/24` | SW2 en `.2`, poste d'administration en `.10`, passerelle `.254` |
| 999 | PARKING | Aucun réseau | Ports inutilisés et désactivés |

L'interconnexion des trois sites utilise `172.16.0.0/24`. Le routeur R2 utilise `172.16.0.2` sur son interface d'interconnexion. Le routage demandé est OSPF en zone 0.

Le schéma complet est fourni dans `schema-site.drawio` et dans `schema-site.png`.

---

## 4. Matrice des flux

> Les deux premiers flux sont repris directement du contrat d'interface. Pour la réplication et les sauvegardes, le document de départ demande de les identifier mais ne fixe pas le protocole ni le port : ces informations seront donc précisées au TP7 plutôt que d'en inventer une valeur.

| Flux | Source | Destination | Protocole | Port | Chiffré |
|---|---|---|---|---|---|
| Envoi des trames | Arduino | Passerelle | Série USB | Sans objet | Non |
| Envoi des mesures | Passerelle | Serveur | HTTP | 80 | Non, HTTPS au TP6 |
| Consultation web | Poste utilisateur | Serveur web | HTTP | 80 | Non, HTTPS au TP6 |
| Administration | Poste administration | Routeurs / switchs / serveurs | SSH | 22 | Oui |
| Administration web | Poste administration | Serveur web | HTTP/HTTPS | 80 / 443 | HTTPS au TP6 |
| API vers base | API Node.js | MariaDB | MariaDB | Non précisé dans l'énoncé | À préciser |
| Réplication | Serveur | VM Proxmox | Non précisé dans l'énoncé | Non précisé | À préciser au TP7 |
| Sauvegarde | Serveur | VM Proxmox | Non précisé dans l'énoncé | Non précisé | À préciser au TP7 |
| Routage inter-sites | R1 / R2 / R3 | R1 / R2 / R3 | OSPF (protocole IP 89) | Sans objet | Non |

### Flux inter-VLAN à respecter

| Source | Destination | Autorisé |
|---|---|---|
| STATIONS | SERVEURS | HTTP 80 et HTTPS 443 uniquement |
| UTILISATEURS | SERVEURS | HTTP 80 et HTTPS 443 uniquement |
| ADMINISTRATION | Tous | Tout, dont SSH 22 |
| STATIONS | UTILISATEURS | Rien |
| Autres flux | SERVEURS et ADMINISTRATION | Rien |

---

## 5. Analyse de risque

### 5.1 Biens essentiels

| N° | Bien essentiel | Pourquoi est-il important ? |
|---|---|---|
| BE1 | Fiabilité des mesures | Les données doivent rester cohérentes pour que la surveillance climatique soit exploitable. |
| BE2 | Disponibilité du service | L'interface et l'API doivent rester accessibles pour consulter les mesures. |
| BE3 | Conservation des mesures | L'historique doit pouvoir être conservé et restauré en cas d'incident. |
| BE4 | Confidentialité des accès d'administration | Les comptes et accès d'administration ne doivent pas être exposés à des personnes non autorisées. |

### 5.2 Biens supports

| N° | Bien support |
|---|---|
| BS1 | Arduino Uno |
| BS2 | Capteur DHT11 |
| BS3 | LDR + résistance |
| BS4 | Raspberry passerelle / production |
| BS5 | Réseau Cisco : routeurs et switches |
| BS6 | API Node.js / Express |
| BS7 | Base MariaDB |
| BS8 | Serveur Nginx |
| BS9 | Postes utilisateurs et poste d'administration |
| BS10 | VM Proxmox |
| BS11 | Réseau inter-sites et routage OSPF |
| BS12 | Dépôt Git du groupe |

### 5.3 Sources de risque

Les sources de risque retenues sont :

- utilisateur malveillant présent sur le réseau ;
- personne externe essayant d'accéder au système ;
- erreur de configuration d'un groupe ;
- erreur de manipulation sur une Raspberry partagée ;
- panne matérielle ;
- coupure réseau ;
- panne de stockage ;
- mauvais paramétrage des ACL ;
- compromission d'un service web ;
- suppression ou corruption accidentelle des données.

### 5.4 Scénarios de risque

La note est calculée avec `Risque = Gravité × Vraisemblance`.

| N° | Scénario | Bien essentiel touché | G | V | Niveau | Mesure prévue | TP |
|---|---|---|---:|---:|---:|---|---|
| R1 | Une personne sur le réseau envoie de fausses mesures en se faisant passer pour une station | BE1 Fiabilité des mesures | 3 | 3 | 9 | Authentification par clé et filtrage des flux | TP3 + TP6 |
| R2 | La carte SD de la Raspberry serveur tombe en panne | BE3 Conservation des mesures | 4 | 2 | 8 | Réplication et sauvegardes | TP7 |
| R3 | Une coupure réseau empêche la passerelle d'envoyer les mesures | BE3 Conservation des mesures | 3 | 3 | 9 | Mise en file locale sur la passerelle puis renvoi | TP2 |
| R4 | Une erreur d'ACL laisse passer du trafic des stations vers les utilisateurs | BE4 Confidentialité des accès / BE2 Disponibilité | 3 | 2 | 6 | Vérification des ACL et tests de filtrage | TP3 |
| R5 | Un mot de passe d'administration est communiqué à une autre personne | BE4 Confidentialité des accès | 4 | 2 | 8 | Comptes séparés, accès SSH et bonnes pratiques de gestion des secrets | TP3 + TP6 |
| R6 | Une faille de l'application web permet de modifier ou consulter des données non prévues | BE1 Fiabilité / BE4 Confidentialité | 4 | 2 | 8 | Audit, validation des entrées et authentification | TP6 |
| R7 | L'API est indisponible à cause d'un arrêt du service Node.js | BE2 Disponibilité | 3 | 2 | 6 | Vérification du service, journalisation et remise en service | TP4 + TP6 |
| R8 | Une requête mal formée provoque une erreur API et empêche l'enregistrement d'une mesure | BE2 Disponibilité / BE1 Fiabilité | 3 | 2 | 6 | Validation des champs et gestion propre des erreurs | TP4 + TP6 |
| R9 | Un groupe modifie par erreur la configuration ou les fichiers du groupe voisin sur la Raspberry partagée | BE2 Disponibilité / BE3 Conservation | 3 | 2 | 6 | Comptes, bases et ports séparés ; droits d'accès adaptés | TP4 |
| R10 | Une mauvaise configuration du routage inter-sites coupe la communication entre sites | BE2 Disponibilité | 3 | 2 | 6 | Configuration et vérification d'OSPF | TP3 |
| R11 | Un capteur DHT11 ou la LDR ne fonctionne plus et provoque des mesures erronées | BE1 Fiabilité des mesures | 2 | 3 | 6 | Détection des erreurs et journalisation des défauts | TP2 |
| R12 | La base MariaDB est corrompue après une mauvaise manipulation | BE3 Conservation des mesures | 4 | 2 | 8 | Sauvegardes et procédure de restauration | TP7 |
| R13 | Une personne non autorisée obtient l'accès au serveur web en raison d'une configuration trop permissive | BE4 Confidentialité des accès | 4 | 2 | 8 | Durcissement Nginx/serveur et contrôle des accès | TP6 |
| R14 | Une sauvegarde est inutilisable au moment de restaurer les données | BE3 Conservation des mesures | 4 | 2 | 8 | Vérification régulière de la restauration | TP7 |

---

## 6. Matrice gravité × vraisemblance

Les valeurs correspondent au niveau calculé pour les scénarios précédents.

| Gravité \ Vraisemblance | 1 | 2 | 3 | 4 |
|---|---:|---:|---:|---:|
| **1** | - | - | - | - |
| **2** | - | - | R11 | - |
| **3** | - | R4, R7, R8, R9, R10 | R1, R3 | - |
| **4** | - | R2, R5, R6, R12, R13, R14 | - | - |

Les risques de niveau 9 à 16 ont un traitement obligatoire. Les risques de niveau 4 à 8 ont un traitement recommandé. Le registre servira ensuite de fil conducteur pour les autres TP.

---

## 7. Plan de traitement

| Risque | Niveau | Traitement | Mise en œuvre |
|---|---:|---|---|
| R1 | 9 | Obligatoire | Authentifier les stations, filtrer les flux et protéger l'API |
| R2 | 8 | Recommandé | Mettre en place réplication + sauvegardes |
| R3 | 9 | Obligatoire | Conserver les mesures sur la passerelle tant que l'API est indisponible |
| R4 | 6 | Recommandé | Vérifier les ACL avec des tests de flux |
| R5 | 8 | Recommandé | Utiliser des comptes séparés et protéger les accès d'administration |
| R6 | 8 | Recommandé | Auditer et corriger l'API/interface web |
| R7 | 6 | Recommandé | Contrôler le service Node.js et les erreurs |
| R8 | 6 | Recommandé | Valider toutes les données reçues |
| R9 | 6 | Recommandé | Maintenir la séparation des comptes, bases et ports |
| R10 | 6 | Recommandé | Vérifier la configuration OSPF et la connectivité inter-sites |
| R11 | 6 | Recommandé | Gérer les erreurs capteurs et journaliser les défauts |
| R12 | 8 | Recommandé | Sauvegarder et tester la restauration |
| R13 | 8 | Recommandé | Durcir le serveur et sécuriser Nginx/HTTPS |
| R14 | 8 | Recommandé | Tester régulièrement qu'une sauvegarde peut réellement être restaurée |

---

## 8. Préparation de la restitution

### Risques présentés

**R1 - Fausses mesures**

Une personne présente sur le réseau pourrait essayer d'envoyer des données en utilisant l'identifiant d'une station. Comme les données sont au cœur du projet, leur fiabilité est importante. La réponse prévue est de filtrer les flux et d'ajouter une authentification des stations au TP6.

**R3 - Coupure entre la passerelle et l'API**

Si l'API ne répond plus, les mesures risquent d'être perdues. La passerelle doit donc les conserver temporairement et les renvoyer quand la communication revient.

**R2 - Panne du stockage de la Raspberry**

Une panne de la carte SD peut rendre la base indisponible ou provoquer une perte de données. La réplication et les sauvegardes prévues au TP7 doivent limiter l'impact et permettre une restauration.

### Retour d'un autre groupe

À compléter après la restitution croisée avec un risque réellement identifié par l'autre groupe.

---

## 9. Conclusion

Ce TP permet de définir le fonctionnement général du système avant de commencer les parties matérielles et logicielles. L'analyse met surtout en évidence les risques liés à la perte des mesures, à la disponibilité de l'API et à l'accès non autorisé aux données ou aux équipements.

Les résultats de ce TP seront réutilisés pour les TP suivants, notamment pour les ACL du réseau, la sécurisation de l'API et de l'application web, puis la réplication et les sauvegardes.

---

## 10. Captures à ajouter avant le rendu

- Capture de `node -v` / `npm -v`
- Capture de `git --version`
- Capture de `mariadb --version` ou `mysql --version`
- Capture de `ssh -V`
- Capture du dépôt Git `meteo-g8`
- Capture/export du schéma Draw.io
- Capture de la matrice des risques si demandée par le formateur
- Capture ou preuve demandée pendant la séance

