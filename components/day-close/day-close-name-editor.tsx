"use client";

import { useRef, useState } from "react";
import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DayCloseNameEditor({ id, name, onSaved }: {
  id: number;
  name?: string;
  onSaved: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (!editing) {
    return (
      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => {
        setDraft(name ?? "");
        setError(null);
        setEditing(true);
      }}>
        Rename dayclose
      </Button>
    );
  }

  return <form className="space-y-2" onSubmit={async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.trim()) {
      setError("Enter a dayclose name.");
      input.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await apiClient.patch(`/day-closes/${id}/name`, { name: draft.trim() });
      const savedName = response.data?.data?.name;
      if (typeof savedName !== "string") throw new Error("The server did not return the saved name.");
      onSaved(savedName);
      setEditing(false);
    } catch (error) {
      setError(getApiErrorMessage(error, "Unable to rename this dayclose. Your name is kept; try saving again."));
    } finally {
      setSaving(false);
    }
  }}>
    <Label htmlFor={`day-close-name-${id}`}>Dayclose name</Label>
    <div className="flex flex-wrap gap-2">
      <Input ref={input} id={`day-close-name-${id}`} name="dayclose_name" autoComplete="off" required
        maxLength={120} value={draft} disabled={saving} className="h-11 min-w-0 flex-1 basis-48 focus-visible:ring-2 focus-visible:ring-ring"
        aria-invalid={Boolean(error && !draft.trim())}
        aria-describedby={error ? `day-close-name-error-${id}` : undefined}
        onChange={(event) => { setDraft(event.target.value); setError(null); }} />
      <Button type="submit" className="min-h-11" disabled={saving}>{saving ? "Saving…" : "Save name"}</Button>
      <Button type="button" className="min-h-11" variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
    </div>
    {error && <p id={`day-close-name-error-${id}`} role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
