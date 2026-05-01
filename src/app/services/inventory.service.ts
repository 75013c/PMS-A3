import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { InventoryApiItem, InventoryItem } from '../models/inventory-item.model';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly apiUrl = 'https://prog2005.it.scu.edu.au/ArtGalley';

  constructor(private http: HttpClient) {}

  getAllItems(): Observable<InventoryItem[]> {
    return this.http.get<unknown>(`${this.apiUrl}/`).pipe(
      map(response => this.extractApiItems(response).map(item => this.fromApi(item)))
    );
  }

  /**
   * Return ALL records matching a name.
   *
   * Search must be exact matching only.
   * For example, if the database has "A book" and "B book",
   * searching "book" will return no item.
   */
  searchItemsByName(name: string): Observable<InventoryItem[]> {
    const cleanName = name.trim();

    if (!cleanName) {
      return of([]);
    }

    const target = this.normaliseName(cleanName);

    return this.getAllItems().pipe(
      map(items =>
        items.filter(item => this.normaliseName(item.itemName) === target)
      ),
      switchMap(items => {
        if (items.length > 0) {
          return of(items);
        }

        // Fallback for servers that only expose a useful result through GET /name.
        // Still keep exact matching only.
        return this.http.get<unknown>(`${this.apiUrl}/${encodeURIComponent(cleanName)}`).pipe(
          map(response =>
            this.extractApiItems(response)
              .map(item => this.fromApi(item))
              .filter(item => this.normaliseName(item.itemName) === target)
          )
        );
      })
    );
  }

  /**
   * Return the first matching item. This is used by the update/delete page because the
   * assignment API updates and deletes by name, not by ID.
   */
  getItemByName(name: string): Observable<InventoryItem> {
    return this.searchItemsByName(name).pipe(
      map(items => {
        if (items.length === 0) {
          throw new Error('Item not found');
        }

        return items[0];
      })
    );
  }

  addItem(item: InventoryItem): Observable<any> {
    return this.http.post(`${this.apiUrl}/`, this.toApi(item));
  }

  updateItem(name: string, item: InventoryItem): Observable<any> {
    return this.http.put(`${this.apiUrl}/${encodeURIComponent(name.trim())}`, this.toApi(item));
  }

  deleteItem(name: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${encodeURIComponent(name.trim())}`);
  }

  private extractApiItems(response: unknown): InventoryApiItem[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response as InventoryApiItem[];
    }

    const wrapper = response as Record<string, unknown>;

    if (Array.isArray(wrapper['data'])) {
      return wrapper['data'] as InventoryApiItem[];
    }

    if (Array.isArray(wrapper['items'])) {
      return wrapper['items'] as InventoryApiItem[];
    }

    if (Array.isArray(wrapper['result'])) {
      return wrapper['result'] as InventoryApiItem[];
    }

    if (wrapper['data'] && typeof wrapper['data'] === 'object') {
      return [wrapper['data'] as InventoryApiItem];
    }

    if (wrapper['item'] && typeof wrapper['item'] === 'object') {
      return [wrapper['item'] as InventoryApiItem];
    }

    return [wrapper as InventoryApiItem];
  }

  private normaliseName(name: string | undefined | null): string {
    return String(name ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private fromApi(item: InventoryApiItem): InventoryItem {
    return {
      id: item.id ?? item.item_id,
      item_id: item.item_id ?? item.id,

      itemName: item.itemName ?? item.item_name ?? item.name ?? '',
      item_name: item.item_name ?? item.itemName ?? item.name ?? '',

      category: item.category ?? 'Miscellaneous',

      quantity: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),

      supplierName: item.supplierName ?? item.supplier_name ?? item.supplier ?? '',
      supplier_name: item.supplier_name ?? item.supplierName ?? item.supplier ?? '',

      stockStatus: item.stockStatus ?? item.stock_status ?? 'In Stock',
      stock_status: item.stock_status ?? item.stockStatus ?? 'In Stock',

      featuredItem: Number(item.featuredItem ?? item.featured_item ?? 0),
      featured_item: Number(item.featured_item ?? item.featuredItem ?? 0),

      specialNote: item.specialNote ?? item.special_note ?? '',
      special_note: item.special_note ?? item.specialNote ?? ''
    };
  }

  private toApi(item: InventoryItem): InventoryApiItem {
    return {
      itemName: item.itemName.trim(),
      item_name: item.itemName.trim(),

      category: item.category,

      quantity: Number(item.quantity),
      price: Number(item.price),

      supplierName: item.supplierName.trim(),
      supplier_name: item.supplierName.trim(),

      stockStatus: item.stockStatus,
      stock_status: item.stockStatus,

      featuredItem: Number(item.featuredItem),
      featured_item: Number(item.featuredItem),

      specialNote: item.specialNote?.trim() ?? '',
      special_note: item.specialNote?.trim() ?? ''
    };
  }
}