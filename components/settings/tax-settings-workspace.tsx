"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Edit,
  MoreVertical,
  Percent,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  TaxDialog,
  type TaxConfiguration,
} from "@/components/manage/taxes/tax-dialog";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useFiscalProfile } from "@/hooks/use-fiscal-profile";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { RestaurantApis, TaxConfigApis } from "@/lib/api/endpoints";

export function TaxSettingsWorkspace() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const fetchRestaurant = useRestaurant((state) => state.fetchRestaurant);
  const {
    profile: fiscalProfile,
    isActiveVat,
    loading: fiscalProfileLoading,
  } = useFiscalProfile(Boolean(user?.restaurant_id));
  const [taxes, setTaxes] = useState<TaxConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTax, setSelectedTax] = useState<TaxConfiguration | null>(null);

  const fetchTaxes = useCallback(async () => {
    if (!user?.restaurant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get(
        TaxConfigApis.list(user.restaurant_id),
      );
      if (response.data.status === "success") {
        setTaxes(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch taxes:", error);
      setLoadError("Tax configuration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    void fetchTaxes();
  }, [fetchTaxes]);

  const handleToggleTax = async (enabled: boolean) => {
    if (!user?.restaurant_id || isActiveVat || fiscalProfileLoading) return;
    try {
      await apiClient.put(RestaurantApis.update(user.restaurant_id), {
        tax_enabled: enabled,
      });
      await fetchRestaurant(true);
      toast.success(`Tax calculation ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update tax setting");
    }
  };

  const handleDelete = async (id: number) => {
    if (isActiveVat) return;
    if (!window.confirm("Remove this tax from future orders?")) return;
    try {
      await apiClient.delete(TaxConfigApis.delete(id));
      toast.success("Tax configuration removed");
      await fetchTaxes();
    } catch {
      toast.error("Failed to delete tax");
    }
  };

  const openCreate = () => {
    setSelectedTax(null);
    setIsDialogOpen(true);
  };

  return (
    <AppPage width="workspace" className="pb-24 lg:pb-8">
      <div className="2xl:flex 2xl:items-start 2xl:gap-8">
        <SettingsDesktopRail activeItemId="tax_configuration" />
        <main className="min-w-0 flex-1">
          <PageHeader
            title="Taxes & fees"
            description="Manage tax rules applied to new orders. Existing transactions are not changed."
            actions={
              <Button
                onClick={openCreate}
                disabled={
                  fiscalProfileLoading || isActiveVat || taxes.length > 0
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                {taxes.length > 0 ? "Tax configured" : "Add tax"}
              </Button>
            }
          />

          <div className="mt-6 max-w-4xl space-y-8">
            {isActiveVat ? (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>VAT is compliance-managed</AlertTitle>
                <AlertDescription>
                  The active {fiscalProfile?.fiscal_billing_mode ?? "VAT"}{" "}
                  profile locks tax enablement and rate changes.
                </AlertDescription>
              </Alert>
            ) : null}

            <section className="space-y-3" aria-labelledby="tax-calculation">
              <div>
                <h2 id="tax-calculation" className="text-lg font-semibold">
                  Tax calculation
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This switch controls whether configured tax applies to new
                  orders.
                </p>
              </div>
              <DataList>
                <ListRow
                  leading={<Percent className="h-4 w-4" />}
                  title="Apply tax to new orders"
                  description={
                    isActiveVat
                      ? "Required by the active fiscal profile"
                      : restaurant?.tax_enabled
                        ? "Tax calculation is enabled"
                        : "Tax calculation is disabled"
                  }
                  value={
                    <Switch
                      aria-label="Apply tax to new orders"
                      checked={
                        isActiveVat ? true : Boolean(restaurant?.tax_enabled)
                      }
                      disabled={isActiveVat || fiscalProfileLoading}
                      onCheckedChange={(enabled) =>
                        void handleToggleTax(enabled)
                      }
                    />
                  }
                />
              </DataList>
            </section>

            <section className="space-y-3" aria-labelledby="configured-taxes">
              <div>
                <h2 id="configured-taxes" className="text-lg font-semibold">
                  Configured taxes and fees
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nepal workspaces currently support one standard percentage
                  rule.
                </p>
              </div>

              {loading ? (
                <LoadingState label="Loading tax settings" />
              ) : loadError ? (
                <ErrorState
                  title="Tax settings could not be loaded"
                  description={loadError}
                  actionLabel="Try again"
                  onAction={() => void fetchTaxes()}
                />
              ) : taxes.length === 0 ? (
                <EmptyState
                  title="No tax configured"
                  description="Add a tax rule when tax should apply to new orders."
                  actionLabel={isActiveVat ? undefined : "Add tax"}
                  onAction={isActiveVat ? undefined : openCreate}
                />
              ) : (
                <DataList>
                  {taxes.map((tax) => (
                    <ListRow
                      key={tax.id}
                      leading={<Percent className="h-4 w-4" />}
                      title={tax.name}
                      description={`Standard percentage · ${tax.rate}%`}
                      value={
                        <Badge
                          variant={tax.is_active ? "default" : "secondary"}
                        >
                          {tax.is_active ? "Active" : "Inactive"}
                        </Badge>
                      }
                      action={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              aria-label={`Actions for ${tax.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={isActiveVat}
                              onClick={() => {
                                setSelectedTax(tax);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isActiveVat}
                              onClick={() => void handleDelete(tax.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                    />
                  ))}
                </DataList>
              )}
            </section>
          </div>

          {user?.restaurant_id && !isActiveVat ? (
            <TaxDialog
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              tax={selectedTax}
              restaurantId={user.restaurant_id}
              onSuccess={fetchTaxes}
            />
          ) : null}
        </main>
      </div>
    </AppPage>
  );
}
