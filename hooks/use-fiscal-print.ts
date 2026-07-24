"use client";

import { useCallback, useState } from "react";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { fiscalApi } from "@/lib/fiscal/api";
import type {
  FiscalDocument,
  PrintAuthorization,
  PrintAuthorizationInput,
} from "@/lib/fiscal/types";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return getApiErrorMessage(error, "The fiscal print job failed.");
}

export function useFiscalPrint(document: FiscalDocument | null) {
  const [printing, setPrinting] = useState(false);
  const [lastAuthorization, setLastAuthorization] =
    useState<PrintAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);

  const print = useCallback(
    async ({
      authorizationInput,
      dispatch,
    }: {
      authorizationInput?: PrintAuthorizationInput;
      dispatch: (authorization: PrintAuthorization) => Promise<void>;
    }): Promise<PrintAuthorization> => {
      if (!document) {
        throw new Error("The immutable fiscal document is not ready.");
      }

      setPrinting(true);
      setError(null);
      let authorization: PrintAuthorization | null = null;
      try {
        authorization = await fiscalApi.authorizePrint(document.id, {
          ...authorizationInput,
          client_job_id:
            authorizationInput?.client_job_id ||
            (typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `web-${document.id}-${Date.now()}`),
        });
        setLastAuthorization(authorization);

        try {
          await dispatch(authorization);
        } catch (dispatchError) {
          const failureReason = errorMessage(dispatchError);
          try {
            await fiscalApi.completePrint(authorization.authorization_id, {
              authorization_token: authorization.authorization_token,
              succeeded: false,
              failure_reason: failureReason,
            });
          } catch (completionError) {
            console.error(
              "[fiscal-print] Could not record failed print attempt",
              completionError,
            );
          }
          throw dispatchError;
        }

        await fiscalApi.completePrint(authorization.authorization_id, {
          authorization_token: authorization.authorization_token,
          succeeded: true,
        });
        return authorization;
      } catch (printError) {
        const message = errorMessage(printError);
        setError(message);
        throw new Error(message);
      } finally {
        setPrinting(false);
      }
    },
    [document],
  );

  return { print, printing, error, lastAuthorization };
}
