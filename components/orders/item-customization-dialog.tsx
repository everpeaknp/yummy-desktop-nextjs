import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ItemCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  modifierGroups: any[];
  onAddToCart: (item: any, selectedModifiers: any[], notes: string) => void;
  currency: string;
}

export function ItemCustomizationDialog({
  open,
  onOpenChange,
  item,
  modifierGroups,
  onAddToCart,
  currency
}: ItemCustomizationDialogProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, any[]>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedModifiers({});
      setNotes("");
    }
  }, [open, item]);

  if (!item) return null;

  // Filter groups that belong to this item
  const itemGroups = modifierGroups.filter(g => 
    item.modifier_group_ids?.includes(g.id)
  ).sort((a,b) => a.display_order - b.display_order);

  const handleToggleMultiple = (groupId: number, modifier: any, max: number | null) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      const exists = current.find(m => m.id === modifier.id);
      
      if (exists) {
        return { ...prev, [groupId]: current.filter(m => m.id !== modifier.id) };
      } else {
        if (max && current.length >= max) {
          return prev; // Reached max
        }
        return { ...prev, [groupId]: [...current, modifier] };
      }
    });
  };

  const handleSelectSingle = (groupId: number, modifier: any) => {
    setSelectedModifiers(prev => ({
      ...prev,
      [groupId]: [modifier]
    }));
  };

  // Validation
  let isValid = true;
  for (const group of itemGroups) {
    const selected = selectedModifiers[group.id] || [];
    if (group.is_required && selected.length < (group.min_selections || 1)) {
      isValid = false;
      break;
    }
    if (group.min_selections > 0 && selected.length < group.min_selections) {
      isValid = false;
      break;
    }
  }

  const handleAdd = () => {
    // Flatten selected modifiers
    const flatModifiers = Object.values(selectedModifiers).flat();
    onAddToCart(item, flatModifiers, notes);
    onOpenChange(false);
  };

  let totalPrice = item.price || item.item_price || 0;
  Object.values(selectedModifiers).flat().forEach((m: any) => {
    totalPrice += parseFloat(m.price_adjustment || 0);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">{item.name || item.item_name}</DialogTitle>
          <p className="text-muted-foreground text-sm font-medium">
            {currency} {(item.price || item.item_price || 0).toLocaleString()}
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 py-2 border-t border-b">
          <div className="space-y-6">
            {itemGroups.map(group => {
              const isSingle = group.max_selections === 1;
              const selectedCount = (selectedModifiers[group.id] || []).length;
              
              return (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold">{group.name}</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                      {group.is_required ? "Required" : "Optional"} 
                      {group.max_selections ? ` (Max ${group.max_selections})` : ""}
                    </span>
                  </div>
                  
                  {isSingle ? (
                    <RadioGroup 
                      value={(selectedModifiers[group.id]?.[0]?.id || "").toString()}
                      onValueChange={(val) => {
                        const mod = group.modifiers?.find((m:any) => m.id.toString() === val);
                        if(mod) handleSelectSingle(group.id, mod);
                      }}
                      className="space-y-2"
                    >
                      {group.modifiers?.map((mod: any) => (
                        <Label 
                          key={mod.id} 
                          className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={mod.id.toString()} id={`mod-${mod.id}`} />
                            <span className="font-medium">{mod.name}</span>
                          </div>
                          {parseFloat(mod.price_adjustment) > 0 && (
                            <span className="text-sm text-muted-foreground">+{currency}{parseFloat(mod.price_adjustment).toLocaleString()}</span>
                          )}
                        </Label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      {group.modifiers?.map((mod: any) => {
                        const isChecked = (selectedModifiers[group.id] || []).some(m => m.id === mod.id);
                        const isDisabled = !isChecked && group.max_selections !== null && selectedCount >= group.max_selections;
                        
                        return (
                          <Label 
                            key={mod.id} 
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${isChecked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={isChecked}
                                onCheckedChange={() => handleToggleMultiple(group.id, mod, group.max_selections)}
                                disabled={isDisabled}
                              />
                              <span className="font-medium">{mod.name}</span>
                            </div>
                            {parseFloat(mod.price_adjustment) > 0 && (
                              <span className="text-sm text-muted-foreground">+{currency}{parseFloat(mod.price_adjustment).toLocaleString()}</span>
                            )}
                          </Label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="space-y-3 pt-2">
              <h3 className="font-semibold flex items-center justify-between">
                Special Instructions
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">Optional</span>
              </h3>
              <Input 
                placeholder="e.g. No onions, extra spicy..." 
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!isValid} className="gap-2">
            Add to Order
            <span className="bg-primary-foreground/20 px-2 py-0.5 rounded text-xs">
              {currency} {totalPrice.toLocaleString()}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
