const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const express = require('express');
const routesMesures = require('./routes/mesures');
const routesStations = require('./routes/stations');
const routesStats = require('./routes/stats');

const app = express();

app.use(express.json());

app.use('/api/mesures', routesMesures);
app.use('/api/stations', routesStations);
app.use('/api/stats', routesStats);

app.use((req, res) => {
  res.status(404).json({ erreur: 'Route inexistante' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erreur: 'JSON invalide' });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ erreur: 'Erreur interne' });
});

const port = Number(process.env.PORT) || 3008;
app.listen(port, () => {
  console.log(`API météo G8 à l'écoute sur le port ${port}`);
});
