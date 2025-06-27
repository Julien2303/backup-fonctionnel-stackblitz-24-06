'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Doctor, Machine, DoctorAssignment } from './types';
import { groupDoctorsByType } from './utils';
import { supabase } from '@/lib/supabase/client';
import ReactDOM from 'react-dom';

interface AssignmentCellProps {
  day: string;
  slot: string;
  machine: Machine;
  doctors: Doctor[];
  assignments: any[];
  expandedCell: { day: string; slot: string; machineId: string } | null;
  setExpandedCell: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string } | null>>;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string; doctorId: string | null; isMaintenance?: boolean; isNoDoctor?: boolean; updateExceptionHours?: (doctorId: string, hours: number | null) => void } | null>>;
  handleAssignDoctor: (day: string, slot: string, machineId: string, doctorId: string | null, isMaintenance?: boolean, isNoDoctor?: boolean) => void;
  decreaseDoctorShare: (params: { day: string; slot: string; machineId: string; doctorId: string | null; isMaintenance?: boolean; isNoDoctor?: boolean }) => void;
  conges: Record<string, string[]>;
}

export const AssignmentCell: React.FC<AssignmentCellProps> = ({
  day,
  slot,
  machine,
  doctors,
  assignments,
  expandedCell,
  setExpandedCell,
  setSelectedDoctor,
  handleAssignDoctor,
  decreaseDoctorShare,
  conges,
}) => {
  const assignedDoctors = assignments.find(a => 
    a.day === day && a.slot === slot && a.machineId === machine.id
  )?.doctors || [];

  const totalShares = assignedDoctors.reduce((sum: number, d: DoctorAssignment) => sum + d.share, 0);
  const uniqueDoctorIds = new Set(assignedDoctors.map((d: DoctorAssignment) => 
    d.doctorId || (d.maintenance ? 'MAINT' : d.noDoctor ? 'NO_DOCTOR' : '')
  ));
  const uniqueDoctorCount = uniqueDoctorIds.size;
  const canAddMore = totalShares < 4 && uniqueDoctorCount < 4;
  
  const isExpanded = expandedCell?.day === day && 
                    expandedCell?.slot === slot && 
                    expandedCell?.machineId === machine.id;

  const menuRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLDivElement>(null); // Changé de HTMLTableCellElement à HTMLDivElement
  const [exceptionHoursMap, setExceptionHoursMap] = useState<Record<string, number | null>>({});

  const updateExceptionHours = (doctorId: string, hours: number | null) => {
    console.log('Updating exception hours:', { doctorId, hours });
    setExceptionHoursMap(prev => {
      const newMap = { ...prev, [doctorId]: hours };
      console.log('New exception hours map:', newMap);
      return newMap;
    });
  };

  useEffect(() => {
    const loadExceptionHours = async () => {
      const shift = assignments.find(a => a.day === day && a.slot === slot && a.machineId === machine.id);
      if (!shift || !shift.id) return;

      const doctorIds = assignedDoctors
        .filter((d: DoctorAssignment) => d.doctorId)
        .map((d: DoctorAssignment) => d.doctorId);

      if (doctorIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('shift_assignments')
          .select('doctor_id, exception_horaire')
          .eq('shift_id', shift.id)
          .in('doctor_id', doctorIds);

        if (error) {
          console.error('Erreur lors de la récupération des exceptions horaires:', error);
          return;
        }

        const exceptionMap: Record<string, number | null> = {};
        data.forEach((item: { doctor_id: string; exception_horaire: number | null }) => {
          exceptionMap[item.doctor_id] = item.exception_horaire;
        });
        console.log('Loaded exception hours map:', exceptionMap);
        setExceptionHoursMap(exceptionMap);
      } catch (error) {
        console.error('Erreur lors du chargement des exceptions horaires:', error);
      }
    };

    loadExceptionHours();
  }, [assignments, day, slot, machine.id, assignedDoctors]);

  const handleAddDoctor = () => {
    console.log('Opening assignment menu for:', { day, slot, machineId: machine.id, totalShares, uniqueDoctorCount });
    setExpandedCell({ day, slot, machineId: machine.id });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setExpandedCell(null);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, setExpandedCell]);

  const handleValidate = () => {
    console.log('Menu validated');
    setExpandedCell(null);
  };

  const renderDoctorInitials = (doctorAssignment: DoctorAssignment, index: number) => {
    const widthPercentage = totalShares > 0 ? (doctorAssignment.share / totalShares) * 100 : 100;
  
    if (doctorAssignment.maintenance) {
      return (
        <div 
          key={`doctor-assignment-MAINT-${day}-${slot}-${machine.id}-${index}`}
          className={`flex items-center justify-center h-full cursor-pointer doctor-initials ${
            index < assignedDoctors.length - 1 ? 'border-r border-gray-200' : ''
          }`}
          style={{ 
            backgroundColor: '#d1d5db',
            width: `${widthPercentage}%` 
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDoctor({ day, slot, machineId: machine.id, doctorId: null, isMaintenance: true, updateExceptionHours });
          }}
        >
          <span className="text-sm font-medium text-gray-800">
            MAINT
          </span>
        </div>
      );
    }
  
    if (doctorAssignment.noDoctor) {
      return (
        <div 
          key={`doctor-assignment-NO_DOCTOR-${day}-${slot}-${machine.id}-${index}`}
          className={`flex items-center justify-center h-full cursor-pointer doctor-initials ${
            index < assignedDoctors.length - 1 ? 'border-r border-gray-200' : ''
          }`}
          style={{ 
            backgroundColor: '#d1d5db',
            width: `${widthPercentage}%` 
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDoctor({ day, slot, machineId: machine.id, doctorId: null, isNoDoctor: true, updateExceptionHours });
          }}
        >
          {/* Pas de texte pour SANS_DOCTEUR */}
        </div>
      );
    }
  
    const doctor = doctors.find(d => d.id === doctorAssignment.doctorId);
    if (!doctor) return null;
  
    const initialsLength = doctor.initials?.length || 0;
    let fontSizeClass = 'text-sm';
  
    if (widthPercentage < 25 || (initialsLength > 8 && widthPercentage < 50)) {
      fontSizeClass = 'text-[0.5rem]';
    } else if (widthPercentage < 40 || (initialsLength > 5 && widthPercentage < 60)) {
      fontSizeClass = 'text-[0.65rem]';
    } else if (initialsLength > 8) {
      fontSizeClass = 'text-xs';
    }
  
    const exceptionHours = doctorAssignment.doctorId ? exceptionHoursMap[doctorAssignment.doctorId] : null;
  
    console.log('Rendering doctor initials:', {
      doctorId: doctorAssignment.doctorId,
      initials: doctor.initials,
      teleradiologie: doctorAssignment.teleradiologie,
      differe: doctorAssignment.differe,
      plusDiffere: doctorAssignment.plusDiffere,
      exceptionHours
    });
  
    const textClass = [
      fontSizeClass,
      'font-medium',
      doctorAssignment.teleradiologie ? 'font-bold text-green-600' : '',
      doctorAssignment.differe ? 'font-bold text-red-600' : '',
      doctorAssignment.plusDiffere ? 'underline' : ''
    ].filter(Boolean).join(' ');
  
    const hasException = exceptionHours !== null && exceptionHours > 0;
  
    return (
      <div 
        key={`doctor-assignment-${doctorAssignment.doctorId}-${day}-${slot}-${machine.id}`}
        className={`flex items-center justify-center h-full cursor-pointer doctor-initials relative group ${
          index < assignedDoctors.length - 1 ? 'border-r border-gray-200' : ''
        }`}
        style={{ 
          backgroundColor: doctor.color,
          width: `${widthPercentage}%` 
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedDoctor({ day, slot, machineId: machine.id, doctorId: doctorAssignment.doctorId, updateExceptionHours });
        }}
      >
        <span className={textClass}>
          {doctor.initials}
          {hasException && <span className="text-black text-xs relative top-[-0.2rem]">*</span>}
        </span>
        {hasException && (
          <div className="absolute z-10 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-full mb-1">
            Exception horaire : {exceptionHours}h
          </div>
        )}
      </div>
    );
  };

  if (isExpanded) {
    const groupedDoctors = groupDoctorsByType(doctors);

    return ReactDOM.createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50" onClick={() => setExpandedCell(null)}>
        <div
          ref={menuRef}
          className="bg-white border-2 border-gray-300 rounded-lg shadow-2xl"
          style={{ 
            minWidth: '750px',
            maxWidth: '90vw'
          }}
          onClick={(e) => {
            console.log('Menu div clicked');
            e.stopPropagation();
          }}
        >
          <div className="bg-gray-100 px-4 py-2 rounded-t-lg border-b">
            <h3 className="font-semibold text-gray-800 text-center">
              Assignation des médecins - {machine.name} ({day} {slot})
            </h3>
          </div>

          <div className="flex gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-3 text-blue-700 text-center underline">
                Associés
              </div>
              <div className="space-y-2">
                {groupedDoctors['associé']?.map(doctor => {
                  const assignedDoctor = assignedDoctors.find((d: DoctorAssignment) => d.doctorId === doctor.id);
                  const isAssigned = assignedDoctor !== undefined;
                  const shareCount = assignedDoctor?.share || 0;
                  const canAddMoreShares = isAssigned && uniqueDoctorCount > 1 && canAddMore;
                  const isOnLeave = conges[day]?.includes(doctor.initials);

                  return (
                    <div key={doctor.id} className="flex items-center gap-1">
                      {isAssigned && (
                        <button
                          className="px-2 py-1 text-sm rounded-l bg-red-100 hover:bg-red-200 text-red-700 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            decreaseDoctorShare({ 
                              day, 
                              slot, 
                              machineId: machine.id, 
                              doctorId: doctor.id 
                            });
                          }}
                        >
                          −
                        </button>
                      )}
                      <button
                        className={`px-3 py-2 text-sm rounded-r flex-1 flex items-center justify-center font-medium ${
                          isOnLeave
                            ? 'bg-gray-300 opacity-50 cursor-not-allowed text-gray-600'
                            : isAssigned 
                              ? canAddMoreShares
                                ? 'border-2 border-gray-400 hover:bg-gray-100 text-gray-800'
                                : 'border-2 border-gray-400 opacity-50 cursor-not-allowed text-gray-600' 
                              : canAddMore 
                                ? 'bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700' 
                                : 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-100'
                        }`}
                        style={{ 
                          backgroundColor: isAssigned && !isOnLeave ? doctor.color : undefined,
                          color: isAssigned && !isOnLeave ? '#000' : undefined
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOnLeave && (canAddMore || (isAssigned && canAddMoreShares))) {
                            handleAssignDoctor(day, slot, machine.id, doctor.id);
                          }
                        }}
                        disabled={isOnLeave || !(canAddMore || (isAssigned && canAddMoreShares))}
                        title={isOnLeave ? 'En congés' : ''}
                      >
                        {doctor.initials}
                        {isAssigned && shareCount > 1 && (
                          <span className="ml-1 text-xs font-bold">×{shareCount}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-3 text-green-700 text-center underline">
                Remplaçants
              </div>
              <div className="space-y-2">
                {groupedDoctors['remplaçant']?.map(doctor => {
                  const assignedDoctor = assignedDoctors.find((d: DoctorAssignment) => d.doctorId === doctor.id);
                  const isAssigned = assignedDoctor !== undefined;
                  const shareCount = assignedDoctor?.share || 0;
                  const canAddMoreShares = isAssigned && uniqueDoctorCount > 1 && canAddMore;
                  const isOnLeave = conges[day]?.includes(doctor.initials);

                  return (
                    <div key={doctor.id} className="flex items-center gap-1">
                      {isAssigned && (
                        <button
                          className="px-2 py-1 text-sm rounded-l bg-red-100 hover:bg-red-200 text-red-700 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            decreaseDoctorShare({ 
                              day, 
                              slot, 
                              machineId: machine.id, 
                              doctorId: doctor.id 
                            });
                          }}
                        >
                          −
                        </button>
                      )}
                      <button
                        className={`px-3 py-2 text-sm rounded-r flex-1 flex items-center justify-center font-medium ${
                          isOnLeave
                            ? 'bg-gray-300 opacity-50 cursor-not-allowed text-gray-600'
                            : isAssigned 
                              ? canAddMoreShares
                                ? 'border-2 border-gray-400 hover:bg-gray-100 text-gray-800'
                                : 'border-2 border-gray-400 opacity-50 cursor-not-allowed text-gray-600' 
                              : canAddMore 
                                ? 'bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700' 
                                : 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-100'
                        }`}
                        style={{ 
                          backgroundColor: isAssigned && !isOnLeave ? doctor.color : undefined,
                          color: isAssigned && !isOnLeave ? '#000' : undefined
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOnLeave && (canAddMore || (isAssigned && canAddMoreShares))) {
                            handleAssignDoctor(day, slot, machine.id, doctor.id);
                          }
                        }}
                        disabled={isOnLeave || !(canAddMore || (isAssigned && canAddMoreShares))}
                        title={isOnLeave ? 'En congés' : ''}
                      >
                        {doctor.initials}
                        {isAssigned && shareCount > 1 && (
                          <span className="ml-1 text-xs font-bold">×{shareCount}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-3 text-purple-700 text-center underline">
                Autre
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  {assignedDoctors.some((d: DoctorAssignment) => d.maintenance) && (
                    <button
                      className="px-2 py-1 text-sm rounded-l bg-red-100 hover:bg-red-200 text-red-700 font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        decreaseDoctorShare({ 
                          day, 
                          slot, 
                          machineId: machine.id, 
                          doctorId: null,
                          isMaintenance: true
                        });
                      }}
                    >
                      −
                    </button>
                  )}
                  <button
  className={`px-3 py-2 text-sm rounded-r flex-1 flex items-center justify-center font-medium ${
    assignedDoctors.some((d: DoctorAssignment) => d.maintenance)
      ? canAddMore && uniqueDoctorCount > 1
        ? 'border-2 border-gray-400 hover:bg-gray-100 text-gray-800'
        : 'border-2 border-gray-400 opacity-50 cursor-not-allowed text-gray-600'
      : canAddMore 
        ? 'bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700' 
        : 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-100'
  }`}
  style={{ backgroundColor: assignedDoctors.some((d: DoctorAssignment) => d.maintenance) ? '#d1d5db' : undefined }}
  onClick={(e) => {
    e.stopPropagation();
    if (canAddMore || (assignedDoctors.some((d: DoctorAssignment) => d.maintenance) && uniqueDoctorCount > 1)) {
      handleAssignDoctor(day, slot, machine.id, null, true, false);
    }
  }}
  disabled={!(canAddMore || (assignedDoctors.some((d: DoctorAssignment) => d.maintenance) && uniqueDoctorCount > 1))}
>
  MAINT
  {assignedDoctors.find((d: DoctorAssignment) => d.maintenance)?.share > 1 && (
    <span className="ml-1 text-xs font-bold">×{assignedDoctors.find((d: DoctorAssignment) => d.maintenance)?.share}</span>
  )}
</button>
                </div>

                <div className="flex items-center gap-1">
                  {assignedDoctors.some((d: DoctorAssignment) => d.noDoctor) && (
                    <button
                      className="px-2 py-1 text-sm rounded-l bg-red-100 hover:bg-red-200 text-red-700 font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        decreaseDoctorShare({ 
                          day, 
                          slot, 
                          machineId: machine.id, 
                          doctorId: null,
                          isNoDoctor: true
                        });
                      }}
                    >
                      −
                    </button>
                  )}
                 <button
  className={`px-3 py-2 text-sm rounded-r flex-1 flex items-center justify-center font-medium ${
    assignedDoctors.some((d: DoctorAssignment) => d.noDoctor)
      ? canAddMore && uniqueDoctorCount > 1
        ? 'border-2 border-gray-400 hover:bg-gray-100 text-gray-800'
        : 'border-2 border-gray-400 opacity-50 cursor-not-allowed text-gray-600'
      : canAddMore 
        ? 'bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700' 
        : 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-100'
  }`}
  style={{ backgroundColor: assignedDoctors.some((d: DoctorAssignment) => d.noDoctor) ? '#d1d5db' : undefined }}
  onClick={(e) => {
    e.stopPropagation();
    if (canAddMore || (assignedDoctors.some((d: DoctorAssignment) => d.noDoctor) && uniqueDoctorCount > 1)) {
      handleAssignDoctor(day, slot, machine.id, null, false, true);
    }
  }}
  disabled={!(canAddMore || (assignedDoctors.some((d: DoctorAssignment) => d.noDoctor) && uniqueDoctorCount > 1))}
>
  Sans Médecin
  {assignedDoctors.find((d: DoctorAssignment) => d.noDoctor)?.share > 1 && (
    <span className="ml-1 text-xs font-bold">×{assignedDoctors.find((d: DoctorAssignment) => d.noDoctor)?.share}</span>
  )}
</button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t bg-gray-50 px-4 py-3 rounded-b-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {uniqueDoctorCount === 1
                  ? "Un seul médecin assigné (max 1 part)"
                  : totalShares < 4 
                    ? `Total: ${totalShares}/4 parts` 
                    : "Maximum 4 parts par case atteint"}
              </div>
              <div className="flex gap-3">
                <button 
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCell(null);
                  }}
                >
                  Fermer
                </button>
                <button 
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleValidate();
                  }}
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (assignedDoctors.length === 0) {
    return (
      <div
        ref={cellRef}
        className="p-0 border relative"
        style={{ minWidth: '100px', height: slot === 'Soir' ? '40px' : '60px' }}
        onClick={handleAddDoctor}
      >
        <button
          className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      className="p-0 border relative"
      style={{ minWidth: '100px', height: slot === 'Soir' ? '40px' : '60px' }}
      onClick={handleAddDoctor}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 flex flex-row">
          {assignedDoctors.map((doctorAssignment: DoctorAssignment, index: number) =>
            renderDoctorInitials(doctorAssignment, index)
          )}
        </div>
        {canAddMore && (
          <button
            className="absolute bottom-0 right-0 p-0.5 text-xs bg-gray-100 rounded-tl hover:bg-gray-200 z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleAddDoctor();
            }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
};