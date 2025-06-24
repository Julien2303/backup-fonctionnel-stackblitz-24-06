'use client';
import { useDoctorsStore } from '../../../lib/store/doctorsStore';
import { DoctorType } from '../../../lib/types/doctor';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function DoctorsPage() {
  const { doctors, loading, error, fetchDoctors, addDoctor, updateDoctor, removeDoctor, resetError } = useDoctorsStore();
  const { loading: authLoading, error: authError, role } = useAuth(['admin']);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    initials: '',
    email: '',
    type: 'associé' as DoctorType,
    color: '#3b82f6'
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Charger les médecins au montage
  useEffect(() => {
    if (!authLoading && !authError) {
      fetchDoctors();
    }
  }, [fetchDoctors, authLoading, authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoctor(editingId, formData);
        setEditingId(null);
      } else {
        await addDoctor(formData);
      }
      setFormData({
        first_name: '',
        last_name: '',
        initials: '',
        email: '',
        type: 'associé',
        color: '#3b82f6'
      });
    } catch (error) {
      console.error("Erreur lors de l'ajout/modification:", error);
    }
  };

  const handleEdit = (doctor: any) => {
    setFormData({
      first_name: doctor.first_name,
      last_name: doctor.last_name,
      initials: doctor.initials,
      email: doctor.email,
      type: doctor.type,
      color: doctor.color
    });
    setEditingId(doctor.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      first_name: '',
      last_name: '',
      initials: '',
      email: '',
      type: 'associé',
      color: '#3b82f6'
    });
  };

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  if (loading && !editingId) return <div className="p-4">Chargement en cours...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Gestion des Médecins</h1>
      
      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? 'Modifier un médecin' : 'Ajouter un médecin'}
        </h2>
        
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div>
            <label className="block mb-1 text-sm font-medium">Prénom</label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">Nom</label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">Initiales (3 Lettres max)</label>
            <input
              type="text"
              value={formData.initials}
              onChange={(e) => setFormData({...formData, initials: e.target.value})}
              className="w-full p-2 border rounded"
              maxLength={3}
              required
            />
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value as DoctorType})}
              className="w-full p-2 border rounded"
            >
              <option value="associé">Associé</option>
              <option value="remplaçant">Remplaçant</option>
            </select>
          </div>
          
          <div>
            <label className="block mb-1 text-sm font-medium">Couleur</label>
            <div className="flex items-center">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="h-10 w-10 cursor-pointer"
              />
              <span className="ml-2 text-sm">{formData.color}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'En cours...' : editingId ? 'Mettre à jour' : 'Ajouter le médecin'}
          </button>
          
          {editingId && (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* Liste des médecins */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Médecins enregistrés</h2>
        
        {doctors.length === 0 ? (
          <p className="text-gray-500">Aucun médecin enregistré</p>
        ) : (
          <ul className="space-y-3">
            {doctors.map((doctor) => (
              <li 
                key={doctor.id} 
                className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm"
              >
                <div className="flex items-center">
                  <div 
                    className="w-5 h-5 rounded-full mr-3 border border-gray-300"
                    style={{ backgroundColor: doctor.color }}
                  ></div>
                  <span>
                    {doctor.first_name} {doctor.last_name} 
                    <span className="text-gray-600 ml-2">
                      ({doctor.initials}) - {doctor.type}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(doctor)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    disabled={loading}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => removeDoctor(doctor.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                    disabled={loading}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}