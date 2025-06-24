'use client';
import { useMachinesStore } from '../../../lib/store/machinesStore';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function MachinesPage() {
  const { 
    machines, 
    loading, 
    error, 
    fetchMachines, 
    addMachine, 
    updateMachine, 
    removeMachine, 
    resetError 
  } = useMachinesStore();
  
  const [formData, setFormData] = useState({
    name: '',
    site: '',
    modality: ''
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const { loading: authLoading, error: authError, role } = useAuth(['admin',]);

  // Charger les machines au démarrage
  useEffect(() => {
    if (!authLoading && !authError) {
      fetchMachines();
    }
  }, [fetchMachines, authLoading, authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMachine(editingId, formData);
      } else {
        await addMachine(formData);
      }
      resetForm();
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      site: '',
      modality: ''
    });
    setEditingId(null);
  };

  const handleEdit = (machine: any) => {
    setFormData({
      name: machine.name,
      site: machine.site || '',
      modality: machine.modality || ''
    });
    setEditingId(machine.id);
  };

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  if (loading && !editingId) return <div>Chargement...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Gestion des Machines</h1>
      
      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? 'Modifier une machine' : 'Ajouter une machine'}
        </h2>
        
        <div className="grid gap-4">
          <div>
            <label className="block mb-1 font-medium">Nom*</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1 font-medium">Site</label>
            <input
              type="text"
              value={formData.site}
              onChange={(e) => setFormData({...formData, site: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Ex: ST EX"
            />
          </div>
          
          <div>
            <label className="block mb-1 font-medium">Modalité</label>
            <select
              value={formData.modality}
              onChange={(e) => setFormData({...formData, modality: e.target.value})}
              className="w-full p-2 border rounded"
            >
              <option value="">Sélectionnez...</option>
              <option value="IRM">IRM</option>
              <option value="Scanner">Scanner</option>
              <option value="Échographie">Échographie</option>
              <option value="Radiographie">Radiographie</option>
              <option value="Mammographie">Mammographie</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'En cours...' : editingId ? 'Mettre à jour' : 'Ajouter'}
          </button>
          
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* Liste des machines */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Machines enregistrées</h2>
        
        {machines.length === 0 ? (
          <p className="text-gray-500">Aucune machine enregistrée</p>
        ) : (
          <ul className="space-y-3">
            {machines.map((machine) => (
              <li 
                key={machine.id} 
                className="p-3 bg-white border rounded-lg shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{machine.name}</h3>
                    <div className="text-sm text-gray-600">
                      {machine.site && <span>Site: {machine.site}</span>}
                      {machine.modality && <span className="ml-2">Modalité: {machine.modality}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(machine)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => removeMachine(machine.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}