import { create } from 'zustand';
import type { Profile, BloodRequest } from '@/types';

interface AppState {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;

  activeRequests: BloodRequest[];
  setActiveRequests: (requests: BloodRequest[]) => void;
  addRequest: (request: BloodRequest) => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),

  activeRequests: [],
  setActiveRequests: (activeRequests) => set({ activeRequests }),
  addRequest: (request) =>
    set((state) => ({ activeRequests: [request, ...state.activeRequests] })),
}));
