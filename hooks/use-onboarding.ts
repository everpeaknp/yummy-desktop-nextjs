import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import {
  ONBOARDING_WIZARD_STEP_COUNT,
  ONBOARDING_WIZARD_STORAGE_KEY,
  createEmptyDraft,
  draftFromRestaurant,
  type OnboardingDraft,
  type PaymentMethodKey,
} from "@/lib/onboarding";

type DraftUpdater =
  | OnboardingDraft
  | ((prev: OnboardingDraft) => OnboardingDraft);

type StepUpdater = number | ((prev: number) => number);

export type OnboardingMode = "idle" | "create" | "replay";

interface OnboardingState {
  userId: number | null;
  mode: OnboardingMode;
  step: number;
  draft: OnboardingDraft;
  fieldErrors: Record<string, string>;

  setStep: (step: StepUpdater) => void;
  nextStep: () => void;
  prevStep: () => void;
  setDraft: (updater: DraftUpdater) => void;
  patch: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  togglePayment: (value: PaymentMethodKey) => void;
  setFieldErrors: (errors: Record<string, string>) => void;
  clearFieldError: (key: string) => void;
  clearFieldErrors: () => void;
  initSession: (opts: {
    userId?: number | null;
    email?: string;
    replay?: boolean;
    restaurant?: Record<string, unknown> | null;
  }) => void;
  reset: (email?: string) => void;
}

function clampStep(step: number) {
  return Math.min(Math.max(step, 0), ONBOARDING_WIZARD_STEP_COUNT - 1);
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      userId: null,
      mode: "idle",
      step: 0,
      draft: createEmptyDraft(),
      fieldErrors: {},

      setStep: (step) =>
        set((state) => ({
          step: clampStep(typeof step === "function" ? step(state.step) : step),
        })),

      nextStep: () =>
        set((state) => ({
          step: clampStep(state.step + 1),
          fieldErrors: {},
        })),

      prevStep: () =>
        set((state) => ({
          step: clampStep(state.step - 1),
          fieldErrors: {},
        })),

      setDraft: (updater) =>
        set((state) => ({
          draft: typeof updater === "function" ? updater(state.draft) : updater,
        })),

      patch: (key, value) =>
        set((state) => {
          const fieldErrors = { ...state.fieldErrors };
          delete fieldErrors[String(key)];
          return {
            draft: { ...state.draft, [key]: value },
            fieldErrors,
          };
        }),

      togglePayment: (value) =>
        set((state) => {
          const fieldErrors = { ...state.fieldErrors };
          delete fieldErrors.payments;
          const exists = state.draft.payments.includes(value);
          return {
            fieldErrors,
            draft: {
              ...state.draft,
              payments: exists
                ? state.draft.payments.filter((p) => p !== value)
                : [...state.draft.payments, value],
            },
          };
        }),

      setFieldErrors: (errors) => set({ fieldErrors: errors }),

      clearFieldError: (key) =>
        set((state) => {
          if (!state.fieldErrors[key]) return state;
          const fieldErrors = { ...state.fieldErrors };
          delete fieldErrors[key];
          return { fieldErrors };
        }),

      clearFieldErrors: () => set({ fieldErrors: {} }),

      initSession: ({ userId = null, email = "", replay = false, restaurant = null }) => {
        const state = get();

        if (replay) {
          set({
            userId,
            mode: "replay",
            step: 0,
            fieldErrors: {},
            draft: restaurant
              ? draftFromRestaurant(restaurant, email)
              : createEmptyDraft(email),
          });
          return;
        }

        // Resume persisted create draft for the same user.
        if (
          state.mode === "create" &&
          state.userId != null &&
          userId != null &&
          state.userId === userId
        ) {
          set({
            mode: "create",
            draft: {
              ...state.draft,
              email: email || state.draft.email,
            },
            fieldErrors: {},
          });
          return;
        }

        set({
          userId,
          mode: "create",
          step: 0,
          fieldErrors: {},
          draft: createEmptyDraft(email),
        });
      },

      reset: (email = "") => {
        set({
          userId: null,
          mode: "idle",
          step: 0,
          draft: createEmptyDraft(email),
          fieldErrors: {},
        });
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(ONBOARDING_WIZARD_STORAGE_KEY);
        }
      },
    }),
    {
      name: ONBOARDING_WIZARD_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return {
          getItem: (name) => window.localStorage.getItem(name),
          setItem: (name, value) => {
            // Only persist first-time create progress — never overwrite with replay/idle.
            try {
              const parsed = JSON.parse(value) as { state?: { mode?: string } };
              if (parsed?.state?.mode !== "create") return;
            } catch {
              return;
            }
            window.localStorage.setItem(name, value);
          },
          removeItem: (name) => window.localStorage.removeItem(name),
        };
      }),
      partialize: (state) => ({
        userId: state.userId,
        mode: state.mode,
        step: state.step,
        draft: state.draft,
      }),
    }
  )
);

/** Wait for zustand-persist rehydration before reading wizard draft. */
export function useOnboardingHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useOnboarding.persist;
    if (!persistApi) {
      setHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
