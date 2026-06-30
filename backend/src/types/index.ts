export type CartItem = {
    name: string;
    quantity: number;
    quantityLabel: string;
    subtotal: number;
    unitPrice: number;
    sell_type: string;
};

export type Cart = {
    items: CartItem[];
    totalAmount: number;
};

export type DBProduct = {
    id: number;
    name: string;
    price: number;
    sell_type: string;
    category: string;
};

export type UserState = {
    step: 'FAST_TRACK' | 'LOCATION_REGION' | 'LOCATION_COMUNA' | 'LOCATION_CITY' | 'BAKERY' | 'CATEGORY' | 'MENU' | 'WEIGHT' | 'CONFIRM' | 'REMOVE_SELECT' | 'EDIT_ACTION' | 'EDIT_AMOUNT';
    locationFilter?: {
        region?: string;
        comuna?: string;
        ciudad?: string;
        categoryList?: string; // JSON String
    };
    bakeryId?: number;
    lastBakeryId?: number;
    lastBakeryName?: string;
    tempProduct?: DBProduct;
    menuProducts?: DBProduct[]; // Todos los productos de la panadería
    filteredProducts?: DBProduct[]; // Productos de la categoría seleccionada
    selectedCategory?: string;
    selectedItemIdx?: number;
    editAction?: 'ADD' | 'REMOVE';
};
