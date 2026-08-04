/** @type {import('next').NextConfig} */
const nextConfig = {
  // Zugriff auf den Dev-Server ueber die LAN-IP (z.B. zum Testen am Handy).
  // Betrifft nur `next dev`, im Production-Build hat das keine Wirkung.
  allowedDevOrigins: ['192.168.2.192'],
  images: {
    // TMDB-Profilbilder (Phase 4). Wir laden sie im Client per fetch und
    // speichern sie als Blob, daher reicht die Remote-Freigabe fuer <img>.
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }],
  },
};

export default nextConfig;
