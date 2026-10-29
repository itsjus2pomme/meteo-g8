const REGEX_STATION = /^[A-Z0-9-]{3,10}$/;
const REGEX_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const AVANCE_MAX_MS = 5 * 60 * 1000;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

function estIdStation(valeur) {
  return typeof valeur === 'string' && REGEX_STATION.test(valeur);
}

function lireDateIso(valeur) {
  if (typeof valeur !== 'string' || !REGEX_ISO.test(valeur)) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

function aLaSeconde(date) {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function estEntierEntre(valeur, min, max) {
  return Number.isInteger(valeur) && valeur >= min && valeur <= max;
}

function validerMesure(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return { erreur: 'Le corps de la requête doit être un objet JSON' };
  }
  const { station_id, temperature, humidite, luminosite, horodatage } = corps;

  if (!estIdStation(station_id)) {
    return { erreur: 'station_id doit contenir 3 à 10 caractères (majuscules, chiffres, tiret)' };
  }
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < -40 || temperature > 60) {
    return { erreur: 'temperature doit être un nombre entre -40 et 60' };
  }
  if (!estEntierEntre(humidite, 0, 100)) {
    return { erreur: 'humidite doit être un entier entre 0 et 100' };
  }
  if (!estEntierEntre(luminosite, 0, 100)) {
    return { erreur: 'luminosite doit être un entier entre 0 et 100' };
  }
  const date = lireDateIso(horodatage);
  if (!date) {
    return { erreur: 'horodatage doit être une date ISO 8601 valide' };
  }
  if (date.getTime() > Date.now() + AVANCE_MAX_MS) {
    return { erreur: 'horodatage ne peut pas être plus de 5 minutes dans le futur' };
  }

  return { mesure: { station_id, temperature, humidite, luminosite, horodatage: aLaSeconde(date) } };
}

function lirePeriode(query) {
  const fin = query.fin === undefined ? new Date() : lireDateIso(query.fin);
  if (!fin) return { erreur: 'fin doit être une date ISO 8601 valide' };

  let debut = query.debut === undefined
    ? new Date(fin.getTime() - UN_JOUR_MS)
    : lireDateIso(query.debut);
  if (!debut) return { erreur: 'debut doit être une date ISO 8601 valide' };

  debut = aLaSeconde(debut);
  if (debut > fin) return { erreur: 'debut doit être antérieur à fin' };
  return { debut, fin };
}

module.exports = { validerMesure, lirePeriode, estIdStation };
