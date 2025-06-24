// lib/auth.ts
import { supabase } from './supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AuthResult {
  loading: boolean;
  error: string | null;
  role: string | null;
}

export function useAuth(allowedRoles: string[]) {
  const router = useRouter();
  const [authResult, setAuthResult] = useState<AuthResult>({
    loading: true,
    error: null,
    role: null,
  });

  useEffect(() => {
    async function checkAuth() {
      try {
        // Vérifier la session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log('Session dans useAuth:', session);

        if (!session) {
          console.log('Aucune session, redirection vers /login');
          router.push('/login');
          return;
        }

        // Vérifier le profil
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          console.error('Erreur profil:', profileError);
          setAuthResult({ loading: false, error: 'Profil non trouvé', role: null });
          router.push('/unauthorized');
          return;
        }

        // Vérifier si le rôle est autorisé
        if (!allowedRoles.includes(profile.role)) {
          console.log('Rôle non autorisé:', profile.role);
          setAuthResult({ loading: false, error: 'Accès non autorisé', role: profile.role });
          router.push('/unauthorized');
          return;
        }

        console.log('Authentification réussie, rôle:', profile.role);
        setAuthResult({ loading: false, error: null, role: profile.role });
      } catch (err) {
        console.error('Erreur dans useAuth:', err);
        setAuthResult({ loading: false, error: 'Erreur inattendue', role: null });
        router.push('/unauthorized');
      }
    }

    checkAuth();
  }, [router]);

  return authResult;
}