'use client';

import { useRouter } from 'next/navigation';

export default function Unauthorized() {
  const router = useRouter();

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Accès non autorisé</h1>
      <p>Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.</p>
      <button
        onClick={() => router.push('/')}
        style={{ padding: '10px 20px', marginTop: '10px' }}
      >
        Retour à l&apos;accueil
      </button>
    </div>
  );
}