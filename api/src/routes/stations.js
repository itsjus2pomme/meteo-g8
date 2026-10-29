const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const [stations] = await pool.execute(
    'SELECT id, nom, emplacement, cree_le FROM stations ORDER BY id'
  );
  res.json(stations);
});

router.get('/:id/derniere', async (req, res) => {
  const [mesures] = await pool.execute(
    `SELECT id, station_id, temperature, humidite, luminosite, horodatage
       FROM mesures
      WHERE station_id = ?
      ORDER BY horodatage DESC, id DESC
      LIMIT 1`,
    [req.params.id]
  );
  if (mesures.length === 0) {
    return res.status(404).json({ erreur: 'Aucune mesure pour cette station' });
  }
  res.json(mesures[0]);
});

module.exports = router;
