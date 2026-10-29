SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS meteo_g8
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE meteo_g8;

CREATE TABLE IF NOT EXISTS stations (
  id            VARCHAR(10)  PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  emplacement   VARCHAR(150),
  cle_api_hash  CHAR(64)     NULL,
  cree_le       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mesures (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  station_id   VARCHAR(10)      NOT NULL,
  temperature  DECIMAL(4,1)     NOT NULL,
  humidite     TINYINT UNSIGNED NOT NULL,
  luminosite   TINYINT UNSIGNED NOT NULL,
  horodatage   DATETIME         NOT NULL,
  recu_le      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mesures_station FOREIGN KEY (station_id) REFERENCES stations(id),
  INDEX idx_station_date (station_id, horodatage)
) ENGINE=InnoDB;

INSERT IGNORE INTO stations (id, nom, emplacement) VALUES
  ('ST-G8',    'Station du groupe G8', 'Site 2'),
  ('ST-TEST1', 'Station de test 1',    'Poste de développement'),
  ('ST-TEST2', 'Station de test 2',    'Poste de développement');
