'use client';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

// Interface pour les données brutes renvoyées par la RPC
interface RawUser {
  id: string;
  role: 'admin' | 'user' | 'gestion';
  email: string | null;
  created_at: string;
}

// Interface pour les données transformées
interface UserProfile {
  id: string;
  role: 'admin' | 'user' | 'gestion';
  email: string;
  created_at: string;
}

export default function UtilisateursPage() {
  const { loading: authLoading, error: authError, role } = useAuth(['admin']);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !authError) {
      fetchUsers();
    }
  }, [authLoading, authError]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Typage explicite du résultat de la requête RPC
      const { data, error } = await supabase.rpc('get_users_with_profiles') as { data: RawUser[] | null; error: any };

      if (error) {
        throw error;
      }

      // Transformer les données
      const transformedData = data?.map((user: RawUser) => ({
        id: user.id,
        role: user.role, // Pas besoin d'assertion grâce au typage de RawUser
        email: user.email || 'Email non disponible',
        created_at: user.created_at,
      })) || [];

      setUsers(transformedData);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user' | 'gestion') => {
    try {
      setUpdatingUser(userId);
      setError(null);

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Mettre à jour l'état local
      setUsers(users.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      ));
    } catch (err) {
      console.error('Erreur lors de la mise à jour du rôle:', err);
      setError('Impossible de mettre à jour le rôle');
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'gestion':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'gestion':
        return 'Gestion';
      case 'user':
        return 'Utilisateur';
      default:
        return role;
    }
  };

  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Accès</h1>
        <p className="text-gray-600">Gérez les rôles et permissions des utilisateurs</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchUsers}
            className="mt-2 text-red-600 underline hover:text-red-800"
          >
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des utilisateurs...</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Utilisateurs ({users.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôle actuel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modifier le rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Créé le
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(
                          user.role
                        )}`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          updateUserRole(user.id, e.target.value as 'admin' | 'user' | 'gestion')
                        }
                        disabled={updatingUser === user.id}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="user">Utilisateur</option>
                        <option value="gestion">Gestion</option>
                        <option value="admin">Administrateur</option>
                      </select>
                      {updatingUser === user.id && (
                        <div className="mt-1 flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-xs text-gray-500">Mise à jour...</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun utilisateur trouvé</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}