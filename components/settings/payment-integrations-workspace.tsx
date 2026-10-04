"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, KeyRound, QrCode, Save, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SettingsDesktopRail } from "@/components/settings/settings-desktop-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";

type FonepayConfiguration = {
  merchant_code: string;
  api_user: string;
  api_secret: string;
  api_password: string;
  is_active: boolean;
};

const emptyConfiguration: FonepayConfiguration = {
  merchant_code: "",
  api_user: "",
  api_secret: "",
  api_password: "",
  is_active: false,
};

export function PaymentIntegrationsWorkspace() {
  const user = useAuth((state) => state.user);
  const setRestaurant = useRestaurant((state) => state.setRestaurant);
  const [configuration, setConfiguration] =
    useState<FonepayConfiguration>(emptyConfiguration);
  const [savedConfiguration, setSavedConfiguration] =
    useState<FonepayConfiguration>(emptyConfiguration);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadConfiguration = useCallback(async () => {
    if (!user?.restaurant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get(
        RestaurantApis.getById(user.restaurant_id),
      );
      const restaurant = response.data?.data;
      if (!restaurant) throw new Error("Restaurant configuration is missing");
      setRestaurant(restaurant);
      const nextConfiguration: FonepayConfiguration = {
        merchant_code: restaurant.fonepay_config?.merchant_code || "",
        api_user: restaurant.fonepay_config?.api_user || "",
        api_secret: restaurant.fonepay_config?.api_secret || "",
        api_password: restaurant.fonepay_config?.api_password || "",
        is_active: Boolean(restaurant.fonepay_config?.is_active),
      };
      setConfiguration(nextConfiguration);
      setSavedConfiguration(nextConfiguration);
    } catch (error) {
      console.error("Failed to load payment integrations", error);
      setLoadError("Payment integration settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [setRestaurant, user?.restaurant_id]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const dirty = useMemo(
    () => JSON.stringify(configuration) !== JSON.stringify(savedConfiguration),
    [configuration, savedConfiguration],
  );

  const saveConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.restaurant_id || !dirty) return;
    setSaving(true);
    try {
      await apiClient.put(
        RestaurantApis.updateFonepay(user.restaurant_id),
        configuration,
      );
      setSavedConfiguration(configuration);
      toast.success("Payment integration updated");
    } catch (error) {
      console.error("Failed to update payment integration", error);
      toast.error("Failed to update payment integration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppPage width="workspace" className="pb-28 lg:pb-8">
      <div className="2xl:flex 2xl:items-start 2xl:gap-8">
        <SettingsDesktopRail activeItemId="payment_integrations" />
        <main className="min-w-0 flex-1">
          <PageHeader
            title="Payment integrations"
            description="Connect payment providers without changing how staff take payments at checkout."
          />

          {loading ? (
            <LoadingState
              label="Loading payment integrations"
              className="mt-6"
            />
          ) : loadError ? (
            <ErrorState
              className="mt-6"
              title="Payment integrations could not be loaded"
              description={loadError}
              actionLabel="Try again"
              onAction={() => void loadConfiguration()}
            />
          ) : (
            <form
              onSubmit={saveConfiguration}
              className="mt-6 max-w-4xl space-y-8"
            >
              <section className="space-y-3" aria-labelledby="provider-status">
                <div>
                  <h2 id="provider-status" className="text-lg font-semibold">
                    Provider status
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    FonePay provides automated dynamic QR payments at checkout.
                  </p>
                </div>
                <DataList>
                  <ListRow
                    leading={<CreditCard className="h-4 w-4" />}
                    title="FonePay"
                    description={
                      configuration.merchant_code
                        ? "Merchant credentials configured"
                        : "Merchant credentials not configured"
                    }
                    value={
                      <Badge
                        variant={
                          configuration.is_active ? "default" : "secondary"
                        }
                      >
                        {configuration.is_active ? "Active" : "Inactive"}
                      </Badge>
                    }
                  />
                </DataList>
              </section>

              <section
                className="space-y-4"
                aria-labelledby="fonepay-configuration"
              >
                <div className="flex min-h-14 items-center justify-between gap-4 border-y py-3">
                  <div>
                    <h2 id="fonepay-configuration" className="font-semibold">
                      Enable FonePay
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Make dynamic QR available as a connected payment provider.
                    </p>
                  </div>
                  <Switch
                    aria-label="Enable FonePay"
                    checked={configuration.is_active}
                    onCheckedChange={(isActive) =>
                      setConfiguration({
                        ...configuration,
                        is_active: isActive,
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fonepay-merchant">
                      Merchant code (PID)
                    </Label>
                    <Input
                      id="fonepay-merchant"
                      value={configuration.merchant_code}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          merchant_code: event.target.value,
                        })
                      }
                      placeholder="Provided by FonePay"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fonepay-user">API user</Label>
                    <Input
                      id="fonepay-user"
                      value={configuration.api_user}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          api_user: event.target.value,
                        })
                      }
                      placeholder="FonePay username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fonepay-secret">API secret</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="fonepay-secret"
                        type="password"
                        className="pl-9"
                        value={configuration.api_secret}
                        onChange={(event) =>
                          setConfiguration({
                            ...configuration,
                            api_secret: event.target.value,
                          })
                        }
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fonepay-password">API password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="fonepay-password"
                        type="password"
                        className="pl-9"
                        value={configuration.api_password}
                        onChange={(event) =>
                          setConfiguration({
                            ...configuration,
                            api_password: event.target.value,
                          })
                        }
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="qr-routing">
                <div>
                  <h2 id="qr-routing" className="text-lg font-semibold">
                    QR and settlement routing
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Settlement accounts and individual QR instruments remain
                    finance-owned.
                  </p>
                </div>
                <DataList>
                  <Link
                    href="/finance/operations?tab=payment-instruments"
                    className="block"
                  >
                    <ListRow
                      leading={<QrCode className="h-4 w-4" />}
                      title="Payment instruments"
                      description="Connect QR and terminal instruments to settlement accounts"
                      interactive
                    />
                  </Link>
                  <Link
                    href="/finance/operations?tab=accounts"
                    className="block"
                  >
                    <ListRow
                      leading={<WalletCards className="h-4 w-4" />}
                      title="Settlement accounts"
                      description="Manage the bank and cash accounts that receive funds"
                      interactive
                    />
                  </Link>
                </DataList>
              </section>

              <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-xl sm:border-x lg:static lg:border-x-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!dirty || saving}
                  onClick={() => setConfiguration(savedConfiguration)}
                >
                  Discard
                </Button>
                <Button type="submit" disabled={!dirty || saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </main>
      </div>
    </AppPage>
  );
}
