// MachineFilter.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Machine } from './types';

interface MachineFilterProps {
  machines: Machine[];
  selectedMachines: string[];
  toggleMachine: (machineId: string) => void;
  toggleSite: (site: string) => void;
}

export const MachineFilter: React.FC<MachineFilterProps> = ({
  machines,
  selectedMachines,
  toggleMachine,
  toggleSite,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Regrouper les machines par site
  const siteGroups = Array.from(
    new Set(
      machines
        .filter((m) => m.site !== undefined)
        .map((m) => m.site!)
    )
  );

  // Machines sans site
  const machinesWithoutSite = machines.filter((m) => !m.site);

  // Vérifier si toutes les machines d'un site sont sélectionnées
  const isSiteSelected = (site: string) => {
    const siteMachines = machines.filter((m) => m.site === site);
    return siteMachines.every((m) => selectedMachines.includes(m.id));
  };

  // Gérer la fermeture du menu en cas de clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white hover:bg-gray-100 text-gray-800 py-0.5 px-2 border border-gray-300 rounded shadow text-xs flex items-center"
        aria-expanded={isOpen}
      >
        FILTRE
        <svg
          className={`ml-1 h-4 w-4 transform ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border"
          data-dropdown-open="true"
        >
          <div className="p-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Filtrer par machine/site</h3>
            
            {/* Sites groupés */}
            {siteGroups.map((site) => (
              <div key={site} className="mb-2">
                <div className="flex items-center mb-1">
                  <input
                    type="checkbox"
                    id={`site-${site}`}
                    checked={isSiteSelected(site)}
                    onChange={() => toggleSite(site)}
                    className="mr-2"
                  />
                  <label htmlFor={`site-${site}`} className="text-sm font-medium">
                    {site}
                  </label>
                </div>
                <div className="ml-6">
                  {machines
                    .filter((m) => m.site === site)
                    .map((machine) => (
                      <div key={machine.id} className="flex items-center mb-1">
                        <input
                          type="checkbox"
                          id={`machine-${machine.id}`}
                          checked={selectedMachines.includes(machine.id)}
                          onChange={() => toggleMachine(machine.id)}
                          className="mr-2"
                        />
                        <label htmlFor={`machine-${machine.id}`} className="text-sm">
                          {machine.name}
                        </label>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* Machines sans site */}
            {machinesWithoutSite.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center mb-1">
                  <label className="text-sm font-medium">Sans site</label>
                </div>
                <div className="ml-6">
                  {machinesWithoutSite.map((machine) => (
                    <div key={machine.id} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={`machine-${machine.id}`}
                        checked={selectedMachines.includes(machine.id)}
                        onChange={() => toggleMachine(machine.id)}
                        className="mr-2"
                      />
                      <label htmlFor={`machine-${machine.id}`} className="text-sm">
                        {machine.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};