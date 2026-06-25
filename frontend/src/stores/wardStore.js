import { create } from 'zustand';

const useWardStore = create((set, get) => ({
  beds: [],
  alerts: [],

  updateVitals: (patientId, vitals, alertMsg) => set((state) => {
    // 1. Update Bed Vitals
    let newBeds = [...state.beds];
    const bedIndex = newBeds.findIndex(b => b.patientId === patientId);
    
    if (bedIndex >= 0) {
      const existing = newBeds[bedIndex];

      // Skip re-render if vitals values haven't changed (prevents glitch from identical polls)
      if (vitals && existing.latestVitals && !alertMsg) {
        const prev = existing.latestVitals;
        if (
          prev.heartRate === vitals.heartRate &&
          prev.spO2 === vitals.spO2 &&
          prev.bloodPressureSys === vitals.bloodPressureSys &&
          prev.bloodPressureDia === vitals.bloodPressureDia &&
          prev.respirationRate === vitals.respirationRate
        ) {
          return state; // Nothing changed — skip re-render entirely
        }
      }

      const newHistory = vitals ? [...(existing.history || []), vitals].slice(-120) : existing.history || [];
      const latest = vitals ? vitals : existing.latestVitals;
      newBeds[bedIndex] = { ...existing, latestVitals: latest, history: newHistory };
    } else {
      newBeds.push({ 
        patientId, 
        latestVitals: vitals || null, 
        history: vitals ? [vitals] : [] 
      });
    }

    // 2. Add to Alert Queue if present
    let newAlerts = [...state.alerts];
    if (alertMsg) {
      // Remove any existing identical alert for this patient to prevent duplicates
      newAlerts = newAlerts.filter(a => !(a.patientId === patientId && a.message === alertMsg));
      newAlerts.push({
        id: Date.now().toString(),
        patientId,
        message: alertMsg,
        timestamp: new Date(),
        acknowledged: false,
        priorityScore: 10
      });
    }

    return { beds: newBeds, alerts: newAlerts };
  }),

  clearAlertsForPatient: (patientId) => set((state) => ({
    alerts: state.alerts.map(a => a.patientId === patientId ? { ...a, acknowledged: true } : a)
  })),

  acknowledgeAlert: (alertId) => set((state) => {
    return {
      alerts: state.alerts.map(a => a.id === alertId ? { ...a, acknowledged: true } : a)
    };
  }),

  getActiveAlerts: () => {
    return get().alerts.filter(a => !a.acknowledged).sort((a, b) => b.priorityScore - a.priorityScore);
  }
}));

export default useWardStore;
