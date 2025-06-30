import React, { useState, useEffect, useCallback } from 'react';
import { Doctor, DoctorAssignment } from './types';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'react-toastify';

interface DoctorMenuProps {
  doctor?: Doctor;
  assignment: DoctorAssignment;
  shiftId?: string;
  shiftDate?: string;
  shiftType?: string;
  machineId?: string;
  onToggleOption?: (option: 'teleradiologie' | 'differe' | 'plusDiffere') => void;
  onDecreaseShare: () => void;
  onIncreaseShare: () => void;
  onRemove: () => void;
  onClose: () => void;
  totalShares: number;
  onUpdateException?: (doctorId: string, hours: number | null) => void;
}

export const DoctorMenu: React.FC<DoctorMenuProps> = ({
  doctor,
  assignment,
  shiftId,
  shiftDate,
  shiftType,
  machineId,
  onToggleOption,
  onDecreaseShare,
  onIncreaseShare,
  onRemove,
  onClose,
  totalShares,
  onUpdateException,
}) => {
  const [localAssignment, setLocalAssignment] = useState<DoctorAssignment>(assignment);
  const [exceptionHours, setExceptionHours] = useState<number | null>(null);
  const [showExceptionInput, setShowExceptionInput] = useState(false);
  const [tempExceptionHours, setTempExceptionHours] = useState<number>(4);
  const [isLoadingException, setIsLoadingException] = useState(false);

  useEffect(() => {
    setLocalAssignment(assignment);
  }, [assignment]);

  // Fonction checkRecurringException corrigée
  const checkRecurringException = useCallback(async (): Promise<number | null> => {
    if (!shiftDate || !shiftType || !machineId) return null;

    const dayOfWeek = new Date(shiftDate).getDay() === 0 ? 7 : new Date(shiftDate).getDay();
    
    try {
      // Changement ici : utiliser .maybeSingle() au lieu de .single() pour éviter l'erreur 406
      const { data, error } = await supabase
        .from('recurring_hour_exceptions')
        .select('exception_hours')
        .eq('day_of_week', dayOfWeek)
        .eq('shift_type', shiftType)
        .or(`machine_id.eq.${machineId},machine_id.is.null`)
        .lte('start_date', shiftDate)
        .gte('end_date', shiftDate)
        .maybeSingle(); // Utilisation de maybeSingle() au lieu de single()

      if (error) {
        console.error('Erreur vérification exception récurrente:', error);
        return null;
      }

      return data?.exception_hours || null;
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'exception récurrente:', error);
      return null;
    }
  }, [shiftDate, shiftType, machineId]);

  // Charger l'exception horaire existante au montage du composant
  useEffect(() => {
    const loadExceptionHours = async () => {
      if (!shiftId || !doctor?.id) return;
      
      setIsLoadingException(true);
      try {
        // Vérifier d'abord s'il y a une exception spécifique pour ce médecin
        const { data, error } = await supabase
          .from('shift_assignments')
          .select('exception_horaire')
          .eq('shift_id', shiftId)
          .eq('doctor_id', doctor.id)
          .maybeSingle(); // Utilisation de maybeSingle() ici aussi

        if (error) {
          console.error('Erreur lors de la récupération de l\'exception horaire:', error);
          return;
        }

        if (data?.exception_horaire) {
          // Le médecin a une exception spécifique
          setExceptionHours(data.exception_horaire);
          setTempExceptionHours(data.exception_horaire);
        } else {
          // Pas d'exception spécifique, vérifier les exceptions récurrentes
          const recurringHours = await checkRecurringException();
          if (recurringHours) {
            setExceptionHours(recurringHours);
            setTempExceptionHours(recurringHours);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'exception horaire:', error);
      } finally {
        setIsLoadingException(false);
      }
    };

    loadExceptionHours();
  }, [shiftId, doctor?.id, checkRecurringException]);

  const saveExceptionHours = async () => {
    if (!shiftId || !doctor?.id) {
      toast.error('Informations manquantes pour sauvegarder l\'exception');
      return;
    }

    console.log('Saving exception hours:', { doctorId: doctor.id, tempExceptionHours, shiftId });

    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ exception_horaire: tempExceptionHours > 0 ? tempExceptionHours : null })
        .eq('shift_id', shiftId)
        .eq('doctor_id', doctor.id);

      if (error) {
        toast.error('Erreur lors de la sauvegarde de l\'exception horaire');
        console.error('Erreur sauvegarde exception:', error);
        return;
      }

      // Recharger l'exception horaire pour confirmer la mise à jour
      const { data, error: fetchError } = await supabase
        .from('shift_assignments')
        .select('exception_horaire')
        .eq('shift_id', shiftId)
        .eq('doctor_id', doctor.id)
        .maybeSingle(); // Utilisation de maybeSingle() ici aussi

      if (fetchError) {
        console.error('Erreur lors de la récupération de l\'exception horaire après sauvegarde:', fetchError);
      }

      const newExceptionHours = data?.exception_horaire || null;
      setExceptionHours(newExceptionHours);
      setShowExceptionInput(false);
      toast.success(tempExceptionHours > 0 ? 'Exception horaire ajoutée' : 'Exception horaire supprimée');
      
      if (onUpdateException) {
        console.log('Calling onUpdateException:', { doctorId: doctor.id, hours: newExceptionHours });
        onUpdateException(doctor.id, newExceptionHours);
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error('Erreur sauvegarde:', error);
    }
  };

  const removeExceptionHours = async () => {
    if (!shiftId || !doctor?.id) return;

    console.log('Removing exception hours:', { doctorId: doctor.id, shiftId });

    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ exception_horaire: null })
        .eq('shift_id', shiftId)
        .eq('doctor_id', doctor.id);

      if (error) {
        toast.error('Erreur lors de la suppression de l\'exception horaire');
        console.error('Erreur suppression exception:', error);
        return;
      }

      setExceptionHours(null);
      setShowExceptionInput(false);
      toast.success('Exception horaire supprimée');
      
      if (onUpdateException) {
        console.log('Calling onUpdateException:', { doctorId: doctor.id, hours: null });
        onUpdateException(doctor.id, null);
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
      console.error('Erreur suppression:', error);
    }
  };

  const canIncrease = totalShares < 4;
  const showRemoveButton = localAssignment.share <= 1;

  const handleToggleOption = (option: 'teleradiologie' | 'differe' | 'plusDiffere') => {
    if (!onToggleOption) return;
    setLocalAssignment((prev) => {
      const updated = { ...prev };
      if (option === 'teleradiologie') {
        updated.teleradiologie = !prev.teleradiologie;
        if (updated.teleradiologie) updated.differe = false;
      } else if (option === 'differe') {
        updated.differe = !prev.differe;
        if (updated.differe) updated.teleradiologie = false;
      } else if (option === 'plusDiffere') {
        updated.plusDiffere = !prev.plusDiffere;
      }
      return updated;
    });
    console.log('Toggling option:', { doctorId: doctor?.id, option });
    onToggleOption(option);
  };

  const handleIncreaseShare = () => {
    if (canIncrease) {
      setLocalAssignment((prev) => ({
        ...prev,
        share: prev.share + 1
      }));
      console.log('Increasing share:', { doctorId: doctor?.id, isMaintenance: assignment.maintenance, isNoDoctor: assignment.noDoctor, newShare: localAssignment.share + 1 });
      onIncreaseShare();
    }
  };

  const handleDecreaseShare = () => {
    setLocalAssignment((prev) => ({
      ...prev,
      share: prev.share - 1
    }));
    console.log('Decreasing share:', { doctorId: doctor?.id, isMaintenance: assignment.maintenance, isNoDoctor: assignment.noDoctor, newShare: localAssignment.share - 1 });
    onDecreaseShare();
  };

  const handleRemove = () => {
    console.log('Removing:', { doctorId: doctor?.id, isMaintenance: assignment.maintenance, isNoDoctor: assignment.noDoctor });
    onRemove();
    onClose();
  };

  const handleExceptionClick = () => {
    setShowExceptionInput(!showExceptionInput);
    if (!showExceptionInput && exceptionHours) {
      setTempExceptionHours(exceptionHours);
    }
  };

  const handleCancelException = () => {
    setShowExceptionInput(false);
    setTempExceptionHours(exceptionHours || 4);
  };

  if (assignment.maintenance || assignment.noDoctor) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center" onClick={onClose}>
        <div
          className="bg-white rounded shadow-lg p-3"
          style={{ width: '200px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center font-medium mb-2">
            {assignment.maintenance ? 'Maintenance' : 'Sans Médecin'}
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-center text-sm font-medium mb-1">
              Parts: {localAssignment.share} (Total: {totalShares}/4)
            </div>
            <div className="flex gap-2">
              {showRemoveButton ? (
                <button
                  className="flex-1 p-2 rounded text-center bg-red-100 text-red-600 hover:bg-red-200"
                  onClick={handleRemove}
                >
                  Supprimer
                </button>
              ) : (
                <button
                  className="flex-1 p-2 rounded text-center bg-gray-100 hover:bg-gray-200"
                  onClick={handleDecreaseShare}
                >
                  -1
                </button>
              )}
              <button
                className={`flex-1 p-2 rounded text-center bg-gray-100 hover:bg-gray-200 ${
                  !canIncrease ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={handleIncreaseShare}
                disabled={!canIncrease}
              >
                +1
              </button>
            </div>
            <hr className="my-2" />
            <button
              className="p-2 rounded text-center bg-blue-500 text-white hover:bg-blue-600"
              onClick={onClose}
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded shadow-lg p-3"
        style={{ width: '250px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center font-medium mb-2">
          {doctor?.first_name} {doctor?.last_name}
        </div>
        <div className="flex flex-col gap-2">
          <button
            className={`p-2 rounded text-left ${
              localAssignment.teleradiologie
                ? 'bg-green-100 font-bold text-green-600'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => handleToggleOption('teleradiologie')}
          >
            {localAssignment.teleradiologie ? '✓ ' : ''} Téléradiologie
          </button>
          <button
            className={`p-2 rounded text-left ${
              localAssignment.differe
                ? 'bg-red-100 font-bold text-red-600'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => handleToggleOption('differe')}
          >
            {localAssignment.differe ? '✓ ' : ''} En différé
          </button>
          <button
            className={`p-2 rounded text-left ${
              localAssignment.plusDiffere
                ? 'bg-gray-100 font-bold text-gray-600 underline'
                : 'hover:bg-gray-100'
            }`}
            onClick={() => handleToggleOption('plusDiffere')}
          >
            {localAssignment.plusDiffere ? '✓ ' : ''} + différés
          </button>
          
          <hr className="my-2" />
          
          <button
            className={`p-2 rounded text-left text-sm ${
              exceptionHours 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            } ${isLoadingException ? 'opacity-50' : ''}`}
            onClick={handleExceptionClick}
            disabled={isLoadingException}
          >
            {isLoadingException 
              ? 'Chargement...' 
              : exceptionHours 
                ? `Exception horaire : ${exceptionHours}h` 
                : 'Exception horaire : non'
            }
          </button>

          {showExceptionInput && (
            <div className="bg-gray-50 p-2 rounded border">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-gray-600">Heures :</label>
                <input
                  type="number"
                  value={tempExceptionHours}
                  onChange={(e) => setTempExceptionHours(Number(e.target.value))}
                  className="border p-1 rounded w-16 text-sm"
                  min="0"
                  max="24"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveExceptionHours}
                  className="flex-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                >
                  Sauver
                </button>
                {exceptionHours && (
                  <button
                    onClick={removeExceptionHours}
                    className="flex-1 bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                )}
                <button
                  onClick={handleCancelException}
                  className="flex-1 bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
          
          <hr className="my-2" />
          
          <div className="text-center text-sm font-medium mb-1">
            Part: {localAssignment.share} (Total: {totalShares}/4)
          </div>
          <div className="flex gap-2">
            {showRemoveButton ? (
              <button
                className="flex-1 p-2 rounded text-center bg-red-100 text-red-600 hover:bg-red-200"
                onClick={handleRemove}
              >
                Supprimer
              </button>
            ) : (
              <button
                className="flex-1 p-2 rounded text-center bg-gray-100 hover:bg-gray-200"
                onClick={handleDecreaseShare}
              >
                -1
              </button>
            )}
            <button
              className={`flex-1 p-2 rounded text-center bg-gray-100 hover:bg-gray-200 ${
                !canIncrease ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleIncreaseShare}
              disabled={!canIncrease}
            >
              +1
            </button>
          </div>
          <hr className="my-2" />
          <button
            className="p-2 rounded text-center bg-blue-500 text-white hover:bg-blue-600"
            onClick={onClose}
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
};