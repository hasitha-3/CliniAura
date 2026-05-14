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
      // Check if not already in queue unacknowledged
      const exists = newAlerts.find(a => a.patientId === patientId && !a.acknowledged);
      if (!exists) {
        newAlerts.push({
          id: Date.now().toString(),
          patientId,
          message: alertMsg,
          timestamp: new Date(),
          acknowledged: false,
          priorityScore: 10 // Mock priority
        });
      }
    }

    return { beds: newBeds, alerts: newAlerts };
  }),

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
