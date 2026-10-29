const express = require('express');
const pool = require('../db');
const { validerMesure, lirePeriode, estIdStation } = require('../validation');

const router = express.Router();

const LIMITE_DEFAUT = 500;
const LIMITE_MAX = 5000;

router.post('/', async (req, res) => {
  const { erreur, mesure } = validerMesure(req.body);
  if (erreur) return res.status(400).json({ erreur });

  const [stations] = await pool.execute('SELECT id FROM stations WHERE id = ?', [mesure.station_id]);
  if (stations.length === 0) {
    return res.status(400).json({ erreur: 'Station inconnue' });
  }

  const [resultat] = await pool.execute(
    'INSERT INTO mesures (station_id, temperature, humidite, luminosite, horodatage) VALUES (?, ?, ?, ?, ?)',
    [mesure.station_id, mesure.temperature, mesure.humidite, mesure.luminosite, mesure.horodatage]
  );

  res.status(201).json({ id: resultat.insertId, ...mesure });
});

router.get('/', async (req, res) => {
  const { station, limite } = req.query;

  if (station !== undefined && !estIdStation(station)) {
    return res.status(400).json({ erreur: 'Paramètre station invalide' });
  }

  let nombreMax = LIMITE_DEFAUT;
  if (limite !== undefined) {
    nombreMax = Number(limite);
    if (!/^\d+$/.test(limite) || nombreMax < 1 || nombreMax > LIMITE_MAX) {
      return res.status(400).json({ erreur: `limite doit être un entier entre 1 et ${LIMITE_MAX}` });
    }
  }

  const periode = lirePeriode(req.query);
  if (periode.erreur) return res.status(400).json({ erreur: periode.erreur });

  let sql = `SELECT id, station_id, temperature, humidite, luminosite, horodatage
               FROM mesures
              WHERE horodatage BETWEEN ? AND ?`;
  const parametres = [periode.debut, periode.fin];
  if (station !== undefined) {
    sql += ' AND station_id = ?';
    parametres.push(station);
  }
  sql += ' ORDER BY horodatage ASC, id ASC LIMIT ?';
  parametres.push(String(nombreMax));

  const [mesures] = await pool.execute(sql, parametres);
  res.json(mesures);
});

module.exports = router;
