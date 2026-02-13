
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MENU_GALLERY_ITEMS, MenuGalleryCategory, type MenuGalleryItem } from "@/lib/constants/menu-gallery";
export type { MenuGalleryItem };
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Image from "next/image";
import { useState, useMemo } from "react";

interface MenuGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: MenuGalleryItem) => void;
}

export function MenuGalleryDialog({ open, onOpenChange, onSelect }: MenuGalleryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Object.values(MenuGalleryCategory)];

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return MENU_GALLERY_ITEMS;
    return MENU_GALLERY_ITEMS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Choose from Gallery</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-6 py-2 border-b bg-muted/40">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex w-max space-x-2 p-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                  className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 ring-primary transition-all text-left"
                >
                  <Image
                    src={`/${item.assetPath}`}
                    alt={item.label}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 backdrop-blur-sm">
                    <p className="text-white text-xs font-medium truncate">{item.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
