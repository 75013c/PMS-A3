export type InventoryCategory =
  | 'Electronics'
  | 'Furniture'
  | 'Clothing'
  | 'Tools'
  | 'Miscellaneous';

export type StockStatus =
  | 'In Stock'
  | 'Low Stock'
  | 'Out of Stock';

export interface InventoryItem {
  id?: number;
  item_id?: number;
  itemName: string;
  item_name?: string;
  category: InventoryCategory;
  quantity: number;
  price: number;
  supplierName: string;
  supplier_name?: string;
  stockStatus: StockStatus;
  stock_status?: StockStatus;
  featuredItem: number;
  featured_item?: number;
  specialNote?: string;
  special_note?: string;
}

export interface InventoryApiItem {
  id?: number;
  item_id?: number;
  itemName?: string;
  item_name?: string;
  name?: string;
  category?: InventoryCategory;
  quantity?: number | string;
  price?: number | string;
  supplierName?: string;
  supplier_name?: string;
  supplier?: string;
  stockStatus?: StockStatus;
  stock_status?: StockStatus;
  featuredItem?: number | string;
  featured_item?: number | string;
  specialNote?: string;
  special_note?: string;
}

export const CATEGORIES: InventoryCategory[] = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Tools',
  'Miscellaneous'
];

export const STOCK_STATUSES: StockStatus[] = [
  'In Stock',
  'Low Stock',
  'Out of Stock'
];
