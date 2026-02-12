
export interface MenuGalleryItem {
  id: string;
  label: string;
  assetPath: string;
  tags: string[];
  category: string;
}

export const MenuGalleryCategory = {
  POPULAR: 'Popular',
  NEPALI: 'Nepali',
  FAST_FOOD: 'Fast Food',
  DRINKS: 'Drinks',
  SNACKS: 'Snacks',
} as const;

export const MENU_GALLERY_ITEMS: MenuGalleryItem[] = [
  // Popular
  {
    id: 'pop_momo_fry',
    label: 'Fry Momo',
    assetPath: 'assets/menu_gallery/fry momo.webp',
    tags: ['momo', 'fried', 'dumpling', 'popular'],
    category: MenuGalleryCategory.POPULAR,
  },
  {
    id: 'pop_momo_c',
    label: 'Chicken Momo',
    assetPath: 'assets/menu_gallery/chicken momo.webp',
    tags: ['momo', 'chicken', 'steamed', 'popular'],
    category: MenuGalleryCategory.POPULAR,
  },
  {
    id: 'pop_momo_jhol',
    label: 'Jhol Momo',
    assetPath: 'assets/menu_gallery/jholmomo.webp',
    tags: ['momo', 'jhol', 'soup', 'spicy', 'popular'],
    category: MenuGalleryCategory.POPULAR,
  },
  {
    id: 'pop_samosa',
    label: 'Samosa',
    assetPath: 'assets/menu_gallery/samosa.webp',
    tags: ['samosa', 'fried', 'snack', 'popular'],
    category: MenuGalleryCategory.POPULAR,
  },
  {
    id: 'pop_burger_c',
    label: 'Chicken Burger',
    assetPath: 'assets/menu_gallery/chicken burger.webp',
    tags: ['burger', 'chicken', 'fast food', 'popular'],
    category: MenuGalleryCategory.POPULAR,
  },
  {
    id: 'pop_biriyani',
    label: 'Chicken Biriyani',
    assetPath: 'assets/menu_gallery/chicken biriyani.webp',
    tags: ['biriyani', 'rice', 'chicken', 'popular'],
    category: MenuGalleryCategory.POPULAR,
  },

  // Nepali
  {
    id: 'nep_thukpa',
    label: 'Thukpa',
    assetPath: 'assets/menu_gallery/thukpa.webp',
    tags: ['thukpa', 'noodle soup', 'hot', 'nepali'],
    category: MenuGalleryCategory.NEPALI,
  },
  {
    id: 'nep_chowmein',
    label: 'Chicken Chowmein',
    assetPath: 'assets/menu_gallery/chicken chowmein.webp',
    tags: ['chowmein', 'noodles', 'chicken', 'nepali'],
    category: MenuGalleryCategory.NEPALI,
  },
  {
    id: 'nep_sekuwa',
    label: 'Sekuwa',
    assetPath: 'assets/menu_gallery/sekuwa.webp',
    tags: ['sekuwa', 'grilled', 'meat', 'nepali', 'bbq'],
    category: MenuGalleryCategory.NEPALI,
  },
  {
    id: 'nep_sukuti',
    label: 'Sukuti',
    assetPath: 'assets/menu_gallery/sukuti.webp',
    tags: ['sukuti', 'dried meat', 'spicy', 'nepali', 'snack'],
    category: MenuGalleryCategory.NEPALI,
  },
  {
    id: 'nep_keema_noodles',
    label: 'Keema Noodles',
    assetPath: 'assets/menu_gallery/keema noodles.webp',
    tags: ['noodles', 'keema', 'meat', 'nepali'],
    category: MenuGalleryCategory.NEPALI,
  },
  {
    id: 'nep_chatpat',
    label: 'Chatpat',
    assetPath: 'assets/menu_gallery/chatpat.webp',
    tags: ['chatpat', 'snack', 'spicy', 'nepali', 'street food'],
    category: MenuGalleryCategory.NEPALI,
  },
  {
    id: 'nep_thakali',
    label: 'Thakali Set',
    assetPath: 'assets/menu_gallery/thakali.webp',
    tags: ['thakali', 'nepali', 'traditional', 'set'],
    category: MenuGalleryCategory.NEPALI,
  },

  // Fast Food
  {
    id: 'ff_tandoori',
    label: 'Chicken Tandoori',
    assetPath: 'assets/menu_gallery/chicken tandoori.webp',
    tags: ['chicken', 'tandoori', 'grilled', 'spicy'],
    category: MenuGalleryCategory.FAST_FOOD,
  },

  // Drinks
  {
    id: 'dr_coke',
    label: 'Coca Cola',
    assetPath: 'assets/menu_gallery/coca cola.webp',
    tags: ['coke', 'soda', 'cold', 'beverage'],
    category: MenuGalleryCategory.DRINKS,
  },
  {
    id: 'dr_lassi',
    label: 'Lassi',
    assetPath: 'assets/menu_gallery/lassi.webp',
    tags: ['lassi', 'yogurt', 'sweet', 'cold', 'beverage'],
    category: MenuGalleryCategory.DRINKS,
  },
  {
    id: 'dr_americano',
    label: 'Americano',
    assetPath: 'assets/menu_gallery/americano.webp',
    tags: ['coffee', 'americano', 'hot', 'caffeine'],
    category: MenuGalleryCategory.DRINKS,
  },
  {
    id: 'dr_lemon_tea',
    label: 'Lemon Tea',
    assetPath: 'assets/menu_gallery/lemon tea.webp',
    tags: ['tea', 'lemon', 'hot', 'beverage'],
    category: MenuGalleryCategory.DRINKS,
  },
  {
    id: 'dr_milk_tea',
    label: 'Milk Tea',
    assetPath: 'assets/menu_gallery/milk tea.webp',
    tags: ['tea', 'milk', 'hot', 'beverage'],
    category: MenuGalleryCategory.DRINKS,
  },
  {
    id: 'dr_cappuccino',
    label: 'Cappuccino',
    assetPath: 'assets/menu_gallery/cappuccino.webp',
    tags: ['coffee', 'cappuccino', 'hot', 'caffeine'],
    category: MenuGalleryCategory.DRINKS,
  },

  // Snacks
  {
    id: 'sn_aaloo_paratha',
    label: 'Aaloo Paratha',
    assetPath: 'assets/menu_gallery/aaloo paratha.webp',
    tags: ['paratha', 'potato', 'breakfast', 'snack'],
    category: MenuGalleryCategory.SNACKS,
  },
  {
    id: 'sn_aalo_chop',
    label: 'Aalo Chop',
    assetPath: 'assets/menu_gallery/aaloo_chop.webp',
    tags: ['aalo', 'potato', 'fried', 'snack'],
    category: MenuGalleryCategory.SNACKS,
  },
  {
    id: 'sn_pakoda',
    label: 'Pakoda',
    assetPath: 'assets/menu_gallery/pakoda.webp',
    tags: ['pakoda', 'fried', 'snack', 'vegetable'],
    category: MenuGalleryCategory.SNACKS,
  },
];
