const express = require('express');
const pool = require('../db');
const { lirePeriode, estIdStation } = require('../validation');

const router = express.Router();

const arrondir = (valeur) => (valeur === null ? null : Math.round(Number(valeur) * 10) / 10);

router.get('/', async (req, res) => {
  const { station } = req.query;
  if (!estIdStation(station)) {
    return res.status(400).json({ erreur: 'Paramètre station obligatoire et valide' });
  }

  const periode = lirePeriode(req.query);
  if (periode.erreur) return res.status(400).json({ erreur: periode.erreur });

  const [[s]] = await pool.execute(
    `SELECT COUNT(*) AS nombre,
            MIN(temperature) AS t_min, MAX(temperature) AS t_max, AVG(temperature) AS t_moy,
            MIN(humidite)    AS h_min, MAX(humidite)    AS h_max, AVG(humidite)    AS h_moy,
            MIN(luminosite)  AS l_min, MAX(luminosite)  AS l_max, AVG(luminosite)  AS l_moy
       FROM mesures
      WHERE station_id = ? AND horodatage BETWEEN ? AND ?`,
    [station, periode.debut, periode.fin]
  );

  res.json({
    station,
    debut: periode.debut.toISOString(),
    fin: periode.fin.toISOString(),
    nombre: s.nombre,
    temperature: { min: s.t_min, max: s.t_max, moyenne: arrondir(s.t_moy) },
    humidite:    { min: s.h_min, max: s.h_max, moyenne: arrondir(s.h_moy) },
    luminosite:  { min: s.l_min, max: s.l_max, moyenne: arrondir(s.l_moy) }
  });
});

module.exports = router;
