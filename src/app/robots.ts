import type { MetadataRoute } from 'next';

/**
 * Die App ist oeffentlich erreichbar, soll aber nicht auffindbar sein: kein
 * Zugangsschutz, aber auch kein Eintrag in Suchmaschinen.
 *
 * Das ist Verschleierung, kein Schutz — wer die Adresse hat, kommt rein.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
