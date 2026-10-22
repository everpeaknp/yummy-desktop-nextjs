"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Loader2, Pencil, Plus, QrCode } from "lucide-react";
import jsQR from "jsqr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import type {
  PaymentInstrument,
  PaymentInstrumentInput,
} from "@/types/accounting";

type PaymentBank = {
  id: number;
  name: string;
  bank_type: string;
  is_active: boolean;
};

type InstrumentRow = PaymentInstrument & { bank_name?: string | null };

const instrumentTypesByMethod: Record<
  string,
  { value: string; label: string }[]
> = {
  card: [{ value: "terminal", label: "Card terminal" }],
  digital: [
    { value: "qr", label: "QR" },
    { value: "static_qr", label: "Static QR" },
    { value: "wallet", label: "Wallet" },
    { value: "bank_qr", label: "Bank QR" },
  ],
  fonepay: [
    { value: "qr", label: "Dynamic QR" },
    { value: "static_qr", label: "Static QR" },
    { value: "bank_qr", label: "Bank QR" },
  ],
};

function readList<T>(response: { data?: { data?: unknown } }): T[] {
  return Array.isArray(response.data?.data) ? (response.data.data as T[]) : [];
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PaymentInstrumentsPanel({
  restaurantId,
  businessLine,
}: {
  restaurantId: number;
  businessLine: "restaurant" | "hotel";
}) {
  const user = useAuth((state) => state.user);
  const canManage = hasPermission(user, "finance.payment_instruments.manage");
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [banks, setBanks] = useState<PaymentBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InstrumentRow | null>(null);
  const [method, setMethod] = useState("card");
  const [instrumentType, setInstrumentType] = useState("terminal");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [bankId, setBankId] = useState("none");
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  const [checkoutDetail, setCheckoutDetail] = useState("");
  const [scanningQr, setScanningQr] = useState(false);
  const [readingQrImage, setReadingQrImage] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);
  const [dynamicFonepay, setDynamicFonepay] = useState(false);
  const migratedLegacyRef = useRef(false);
  const isCard = method === "card";
  const isCheckoutQr =
    !isCard && ["qr", "bank_qr", "static_qr"].includes(instrumentType);
  const isDynamicFonepay =
    method === "fonepay" && instrumentType === "qr" && dynamicFonepay;

  useEffect(() => {
    if (!scanningQr || !open || !isCheckoutQr || isDynamicFonepay) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const video = qrVideoRef.current;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        timer = window.setInterval(() => {
          if (!context || video.readyState < 2) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const payload = jsQR(image.data, image.width, image.height)?.data.trim();
          if (payload) {
            if (payload.length > 500) {
              toast.error("This QR payload is too long for a payment instrument.");
            } else {
              setCheckoutDetail(payload);
            }
            setScanningQr(false);
          }
        }, 250);
      } catch {
        if (!stopped) {
          setScanningQr(false);
          toast.error("Could not open the camera. Upload a QR image instead.");
        }
      }
    };
    void start();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [scanningQr, open, isCheckoutQr, isDynamicFonepay]);

  const readQrImage = async (file?: File) => {
    if (!file) return;
    setReadingQrImage(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(bitmap, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const payload = jsQR(image.data, image.width, image.height)?.data.trim();
        if (!payload) {
          toast.error("No QR code found in that image.");
        } else if (payload.length > 500) {
          toast.error("This QR payload is too long for a payment instrument.");
        } else {
          setCheckoutDetail(payload);
          setScanningQr(false);
        }
      } finally {
        bitmap.close();
      }
    } catch {
      toast.error("Could not read that QR image. Try another image.");
    } finally {
      setReadingQrImage(false);
    }
  };
  const basePermittedTypes =
    instrumentTypesByMethod[method] ?? instrumentTypesByMethod.card;
  // Existing rows may use a historical type. Keep it visible during editing so
  // the user can deliberately replace it with a valid current type.
  const permittedTypes = basePermittedTypes.some(
    (item) => item.value === instrumentType,
  )
    ? basePermittedTypes
    : [
        {
          value: instrumentType,
          label: `Legacy type: ${titleCase(instrumentType)} — change it`,
        },
        ...basePermittedTypes,
      ];

  const changeMethod = (nextMethod: string) => {
    setScanningQr(false);
    const permitted =
      instrumentTypesByMethod[nextMethod] ?? instrumentTypesByMethod.card;
    setMethod(nextMethod);
    if (nextMethod !== "fonepay") setDynamicFonepay(false);
    if (!permitted.some((item) => item.value === instrumentType)) {
      setInstrumentType(permitted[0].value);
    }
  };

  const changeInstrumentType = (nextType: string) => {
    setScanningQr(false);
    setInstrumentType(nextType);
    if (method !== "fonepay" || nextType !== "qr") setDynamicFonepay(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!migratedLegacyRef.current && canManage) {
        await apiClient.post(
          AccountingApis.migrateLegacyPaymentInstruments(
            restaurantId,
            businessLine,
          ),
        );
        migratedLegacyRef.current = true;
      }
      const [instrumentResponse, bankResponse] = await Promise.all([
        apiClient.get(
          AccountingApis.paymentInstruments({
            restaurantId,
            businessLine,
            activeOnly: false,
          }),
        ),
        apiClient.get(AccountingApis.paymentBanks(restaurantId)),
      ]);
      setInstruments(readList<InstrumentRow>(instrumentResponse));
      setBanks(
        readList<PaymentBank>(bankResponse).filter((bank) => bank.is_active),
      );
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "Could not load payment instruments.",
      );
    } finally {
      setLoading(false);
    }
  }, [businessLine, canManage, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const duplicate = useMemo(
    () =>
      instruments.find(
        (instrument) =>
          instrument.id !== editing?.id &&
          instrument.payment_method.toLowerCase() === method &&
          instrument.name.trim().toLowerCase() === name.trim().toLowerCase(),
      ),
    [editing?.id, instruments, method, name],
  );

  const openEditor = (instrument?: InstrumentRow) => {
    const metadata =
      instrument?.metadata_json && typeof instrument.metadata_json === "object"
        ? instrument.metadata_json
        : {};
    setEditing(instrument ?? null);
    setMethod(instrument?.payment_method ?? "card");
    setInstrumentType(instrument?.instrument_type ?? "terminal");
    setName(instrument?.name ?? "");
    setProvider(instrument?.provider ?? "");
    setBankId(instrument?.bank_id ? String(instrument.bank_id) : "none");
    setCheckoutEnabled(metadata.checkout_enabled !== false);
    setCheckoutDetail(String(metadata.identifier ?? metadata.payload ?? ""));
    setDynamicFonepay(metadata.provider_integration === "fonepay_dynamic_qr");
    setOpen(true);
  };

  const closeEditor = () => {
    setScanningQr(false);
    setOpen(false);
    setEditing(null);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Instrument name is required.");
      return;
    }
    if (duplicate) {
      toast.error(
        `${name.trim()} already exists and is ${duplicate.is_active ? "active" : "inactive"}.`,
      );
      return;
    }
    if (isDynamicFonepay && bankId === "none") {
      toast.error("Select the FonePay settlement account.");
      return;
    }
    if (
      !isDynamicFonepay &&
      isCheckoutQr &&
      checkoutEnabled &&
      !checkoutDetail.trim()
    ) {
      toast.error(
        "Add the QR payment payload before saving -- checkout needs it to render the QR code. " +
          'Turn off "Available at checkout" instead if it\'s not ready yet.',
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        instrument_type: instrumentType,
        name: name.trim(),
        provider: provider.trim() || null,
        bank_id: bankId === "none" ? null : Number(bankId),
        settlement_cycle_days: 1,
        is_active: true,
        metadata_json: {
          checkout_enabled: checkoutEnabled,
          ...(isCard && checkoutDetail.trim()
            ? { identifier: checkoutDetail.trim() }
            : {}),
          ...(!isDynamicFonepay && isCheckoutQr && checkoutDetail.trim()
            ? { payload: checkoutDetail.trim() }
            : {}),
          ...(isDynamicFonepay
            ? { provider_integration: "fonepay_dynamic_qr" }
            : {}),
        },
      };
      if (editing) {
        await apiClient.patch(
          AccountingApis.updatePaymentInstrument(editing.id),
          payload,
        );
        toast.success("Payment instrument updated.");
      } else {
        await apiClient.post(AccountingApis.createPaymentInstrument(), {
          ...payload,
          restaurant_id: restaurantId,
          business_line: businessLine,
          payment_method: method,
        } satisfies PaymentInstrumentInput);
        toast.success("Payment instrument created.");
      }
      closeEditor();
      await load();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "Could not save payment instrument.",
      );
    } finally {
      setSaving(false);
    }
  };

  const setInstrumentActive = async (
    instrument: InstrumentRow,
    isActive: boolean,
  ) => {
    const action = isActive ? "reactivate" : "archive";
    if (
      !window.confirm(
        `${action[0].toUpperCase()}${action.slice(1)} payment instrument "${instrument.name}"?`,
      )
    )
      return;
    setSaving(true);
    try {
      await apiClient.patch(
        AccountingApis.updatePaymentInstrument(instrument.id),
        { is_active: isActive },
      );
      toast.success(
        isActive
          ? `Reactivated ${instrument.name}.`
          : `Archived ${instrument.name}.`,
      );
      await load();
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail ||
          error.response?.data?.message ||
          `Could not ${action} payment instrument.`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && instruments.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Payment methods</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {instruments.filter((item) => item.is_active).length} active of{" "}
            {instruments.length} configured for checkout and settlement.
          </p>
        </div>
        {canManage ? (
          <Button
            className="h-11 shrink-0 rounded-xl"
            onClick={() => openEditor()}
            disabled={saving}
          >
            <Plus className="mr-2 h-4 w-4" /> Add instrument
          </Button>
        ) : null}
      </div>

      {instruments.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No payment instruments are configured.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {instruments.map((instrument) => (
            <Card
              key={instrument.id}
              className={cn(
                "rounded-none border-0 shadow-none",
                !instrument.is_active && "opacity-60",
              )}
            >
              <CardContent className="flex min-h-16 items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 gap-3">
                  {instrument.payment_method === "card" ? (
                    <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{instrument.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {titleCase(instrument.payment_method)} ·{" "}
                      {titleCase(instrument.instrument_type)}
                      {instrument.bank_name ? ` · ${instrument.bank_name}` : ""}
                      {instrument.is_active ? " · Enabled" : " · Disabled"}
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditor(instrument)}
                      disabled={saving}
                      aria-label={`Edit ${instrument.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void setInstrumentActive(
                          instrument,
                          !instrument.is_active,
                        )
                      }
                      disabled={saving}
                    >
                      {instrument.is_active ? "Archive" : "Reactivate"}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {instrument.is_active ? "Active" : "Inactive"}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeEditor())}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit payment instrument" : "Add payment instrument"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={method}
                onValueChange={changeMethod}
                disabled={Boolean(editing)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="fonepay">Fonepay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instrument type</Label>
              <Select
                value={instrumentType}
                onValueChange={changeInstrumentType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permittedTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="instrument-name">Instrument name</Label>
              <Input
                id="instrument-name"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nabil POS 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instrument-provider">Provider</Label>
              <Input
                id="instrument-provider"
                maxLength={120}
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                placeholder="Nabil, Fonepay, Esewa"
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement bank</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Automatic default</SelectItem>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={String(bank.id)}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {method === "fonepay" && instrumentType === "qr" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>FonePay dynamic QR connection</Label>
                <Select
                  value={dynamicFonepay ? "yes" : "no"}
                  onValueChange={(value) => setDynamicFonepay(value === "yes")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">
                      Use this for FonePay&apos;s generated QR
                    </SelectItem>
                    <SelectItem value="no">Manual QR only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Exactly one active instrument can receive automated FonePay
                  collections. Its settlement bank is the accounting
                  destination.
                </p>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-detail">
                {isDynamicFonepay
                  ? "Dynamic QR payload"
                  : isCard
                    ? "Terminal or merchant identifier"
                    : isCheckoutQr
                      ? "QR payment payload"
                      : "Checkout detail (optional)"}
              </Label>
              <Input
                id="checkout-detail"
                maxLength={500}
                value={checkoutDetail}
                onChange={(event) => setCheckoutDetail(event.target.value)}
                disabled={isDynamicFonepay}
                readOnly={isCheckoutQr && !isDynamicFonepay}
                placeholder={
                  isDynamicFonepay
                    ? "Generated separately by FonePay for every sale"
                    : isCard
                      ? "Terminal ID or last four digits"
                      : isCheckoutQr
                      ? "Scan or upload the payment QR"
                        : "Optional checkout detail"
                }
              />
              {isCheckoutQr && !isDynamicFonepay ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => setScanningQr((value) => !value)} disabled={saving}>
                      {scanningQr ? "Stop camera" : "Scan QR"}
                    </Button>
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => qrFileRef.current?.click()} disabled={saving || readingQrImage}>
                      {readingQrImage ? "Reading image…" : "Upload QR image"}
                    </Button>
                    <input ref={qrFileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-label="Choose payment QR image" onChange={(event) => { void readQrImage(event.target.files?.[0]); event.target.value = ""; }} />
                  </div>
                  {scanningQr ? <video ref={qrVideoRef} muted playsInline aria-label="Payment QR camera preview" className="aspect-video w-full rounded-lg bg-muted object-cover" /> : null}
                </>
              ) : null}
              {isDynamicFonepay ? (
                <p className="text-xs text-muted-foreground">
                  FonePay generates a fresh QR for every sale; no static payload
                  is stored in this instrument.
                </p>
              ) : isCheckoutQr && !checkoutDetail.trim() ? (
                <p className="text-xs text-amber-600">
                  A QR needs its payment payload before checkout can offer it.
                </p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Available at checkout</Label>
              <Select
                value={checkoutEnabled ? "yes" : "no"}
                onValueChange={(value) => setCheckoutEnabled(value === "yes")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">
                    Yes — cashiers can select it
                  </SelectItem>
                  <SelectItem value="no">
                    No — finance/settlement only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editing ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
