"use client";

import { useCallback, useEffect, useState } from "react";

import { KOTDesigner } from "@/components/manage/settings/kot-designer";
import { PrinterManagement } from "@/components/manage/settings/printer-management";
import { ReceiptDesigner } from "@/components/manage/settings/receipt-designer";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";

type HardwareWorkspaceKind = "printers" | "receipt" | "kot";

const WORKSPACE_COPY: Record<
  HardwareWorkspaceKind,
  { title: string; description: string; activeItemId: string }
> = {
  printers: {
    title: "Printers",
    description:
      "Manage printer connections, receipt output, and kitchen station routing.",
    activeItemId: "printer_management",
  },
  receipt: {
    title: "Receipt designer",
    description:
      "Arrange the content and formatting used by printed bills and receipts.",
    activeItemId: "receipt_designer",
  },
  kot: {
    title: "KOT designer",
    description:
      "Arrange the content and formatting used by printed kitchen tickets.",
    activeItemId: "kot_designer",
  },
};

export function HardwareDocumentsSettingsWorkspace({
  kind,
}: {
  kind: HardwareWorkspaceKind;
}) {
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantLoading = useRestaurant((state) => state.loading);
  const [template, setTemplate] = useState<
    Array<Record<string, unknown>> | undefined
  >();
  const [receiptDocumentSettings, setReceiptDocumentSettings] = useState<
    Record<string, Record<string, unknown>> | undefined
  >();
  const [templateLoading, setTemplateLoading] = useState(kind !== "printers");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const copy = WORKSPACE_COPY[kind];

  const loadTemplate = useCallback(async () => {
    if (kind === "printers" || !restaurant?.id) return;
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const response = await apiClient.get(
        `/restaurants/${restaurant.id}/templates`,
      );
      const data = response.data?.data;
      setTemplate(
        kind === "receipt"
          ? data?.receipt_template || []
          : data?.kot_template || [],
      );
      if (kind === "receipt") {
        setReceiptDocumentSettings(data?.receipt_document_settings || {});
      }
    } catch (error) {
      console.error(`Failed to load ${kind} template`, error);
      setTemplateError(
        kind === "receipt"
          ? "The receipt layout could not be loaded."
          : "The kitchen ticket layout could not be loaded.",
      );
    } finally {
      setTemplateLoading(false);
    }
  }, [kind, restaurant?.id]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <div className="2xl:flex 2xl:items-start 2xl:gap-8">
        <SettingsDesktopRail activeItemId={copy.activeItemId} />
        <main className="min-w-0 flex-1">
          <PageHeader title={copy.title} description={copy.description} />

          <div className="mt-5 min-w-0 lg:mt-6">
            {restaurantLoading ? (
              <LoadingState label={`Loading ${copy.title.toLowerCase()}`} />
            ) : !restaurant ? (
              <ErrorState
                title="Restaurant context is unavailable"
                description="Select a restaurant before changing hardware or document settings."
              />
            ) : kind === "printers" ? (
              <PrinterManagement restaurantId={restaurant.id} />
            ) : templateLoading ? (
              <LoadingState label={`Loading ${copy.title.toLowerCase()}`} />
            ) : templateError ? (
              <ErrorState
                title={`${copy.title} could not be loaded`}
                description={templateError}
                actionLabel="Try again"
                onAction={() => void loadTemplate()}
              />
            ) : kind === "receipt" ? (
              <ReceiptDesigner
                restaurantId={restaurant.id}
                initialTemplate={template}
                initialDocumentSettings={receiptDocumentSettings}
              />
            ) : (
              <KOTDesigner
                restaurantId={restaurant.id}
                initialTemplate={template}
              />
            )}
          </div>
        </main>
      </div>
    </AppPage>
  );
}
