import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { InventoryItem } from '../models/inventory-item.model';
import { InventoryService } from '../services/inventory.service';
import { IonicSafeString } from '@ionic/angular';

/* Defines the display structure for each row in the item detail panel. */
type ItemDetailRow = {
  label: string;
  value: string;
  required?: boolean;
  multiline?: boolean;
};

@Component({
  selector: 'app-tab1',
  standalone: false,
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page implements OnInit, OnDestroy {
  /* Stores all inventory items loaded from the API. */
  items: InventoryItem[] = [];
  displayedItems: InventoryItem[] = [];

  searchName = '';
  loading = false;
  isSearchMode = false;

  /* Stores the currently selected item for the expanded detail view. */
  selectedItem: InventoryItem | null = null;
  selectedItemIndex: number | null = null;

  /* Controls the item detail overlay animation state. */
  isItemDetailVisible = false;
  isItemDetailOverlayOpen = false;
  isItemDetailSourceHidden = false;
  isItemDetailCoverOpen = false;
  isItemDetailContentOpen = false;
  isItemDetailClosing = false;

  itemDetailCoverStyle: { [key: string]: string } = {};
  itemDetailPanelStyle: { [key: string]: string } = {};

  private itemDetailClosedStyle: { [key: string]: string } = {};
  private itemDetailTimers: ReturnType<typeof setTimeout>[] = [];
  private selectedItemCardElement: HTMLElement | null = null;
  private isItemDetailCloseInProgress = false;

  /* Timing values used to coordinate the detail expansion and closing animation. */
  private readonly sourceExitDelayMs = 130;
  private readonly closeContentExitDelayMs = 130;
  private readonly coverAnimationMs = 250;
  private readonly contentOpenDelayMs = 400;
  private readonly detailVerticalMarginPx = 88;

  constructor(
    private inventoryService: InventoryService,
    private alertController: AlertController,
    private toastController: ToastController
  ) { }

  ngOnInit(): void {
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.clearItemDetailTimers();
  }

  ionViewWillEnter(): void {
    this.loadItems();
  }

  /* Loads all inventory records and resets the page back to normal list mode. */
  loadItems(): void {
    this.loading = true;
    this.isSearchMode = false;

    this.inventoryService.getAllItems().subscribe({
      next: items => {
        this.items = items;
        this.displayedItems = items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Unable to load inventory records.');
      }
    });
  }

  /* Searches inventory items by the exact name entered by the user. */
  searchItem(): void {
    const name = this.searchName.trim();

    this.loading = true;
    this.isSearchMode = true;

    this.inventoryService.searchItemsByName(name).subscribe({
      next: items => {
        this.displayedItems = items;
        this.loading = false;

        if (!name) {
          this.showToast(`${items.length} unnamed record(s) found.`);
        } else if (items.length === 0) {
          this.showToast('No item found with that name.');
        } else if (items.length === 1) {
          this.showToast('1 matching record found.');
        } else {
          this.showToast(`${items.length} matching records found.`);
        }
      },
      error: () => {
        this.loading = false;
        this.displayedItems = [];
        this.showToast('Search failed.');
      }
    });
  }

  /* Clears search mode and restores the full inventory list. */
  clearSearch(): void {
    this.searchName = '';
    this.isSearchMode = false;
    this.displayedItems = this.items;
  }

  /* Handles pull-to-refresh and reloads inventory records from the API. */
  doRefresh(event: any): void {
    this.inventoryService.getAllItems().subscribe({
      next: items => {
        this.items = items;
        this.displayedItems = items;
        this.isSearchMode = false;
        this.searchName = '';
        event.target.complete();
      },
      error: () => {
        event.target.complete();
        this.showToast('Refresh failed.');
      }
    });
  }

  /* Summary value for the total number of inventory items. */
  get totalItems(): number {
    return this.items.length;
  }

  get inStockCount(): number {
    return this.items.filter(item => this.normaliseStockStatus(item.stockStatus) === 'in stock').length;
  }

  get lowStockCount(): number {
    return this.items.filter(item => this.normaliseStockStatus(item.stockStatus) === 'low stock').length;
  }

  get outOfStockCount(): number {
    return this.items.filter(item => this.normaliseStockStatus(item.stockStatus) === 'out of stock').length;
  }

  get totalQuantity(): number {
    return this.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  }

  get featuredCount(): number {
    return this.items.filter(item => Number(item.featuredItem) === 1).length;
  }

  /* Calculates the estimated inventory value from price and quantity. */
  get inventoryValue(): number {
    return this.items.reduce((total, item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return total + quantity * price;
    }, 0);
  }

  /* Builds the section title based on normal list mode or search mode. */
  get searchResultTitle(): string {
    if (!this.isSearchMode) {
      return 'Inventory Items';
    }

    if (!this.searchName.trim()) {
      return 'Unnamed Items';
    }

    return `Search Results for "${this.searchName.trim()}"`;
  }

  /* Builds the item count summary displayed above the item cards. */
  get itemListSummary(): string {
    const count = this.displayedItems.length;

    if (!this.isSearchMode) {
      return count === 1 ? 'Display 1 item' : `Display ${count} items`;
    }

    if (count === 0) {
      return 'No records found';
    }

    return count === 1 ? '1 record found' : `${count} records found`;
  }

  /* Converts the selected item into rows for the expanded detail form. */
  get selectedItemDetailRows(): ItemDetailRow[] {
    const item = this.selectedItem;

    if (!item) {
      return [];
    }

    return [
      {
        label: 'Item Name',
        value: this.getItemDisplayName(item),
        required: true
      },
      {
        label: 'Item ID',
        value: this.formatText(item.id),
        required: true
      },
      {
        label: 'Category',
        value: this.formatText(item.category || 'Miscellaneous'),
        required: true
      },
      {
        label: 'Featured',
        value: Number(item.featuredItem) === 1 ? 'Yes' : 'No'
      },
      {
        label: 'Supplier',
        value: this.formatText(item.supplierName || 'N/A')
      },
      {
        label: 'Price',
        value: `$ ${this.formatPrice(item.price)}`,
        required: true
      },
      {
        label: 'Quantity',
        value: this.formatQuantity(item.quantity),
        required: true
      },
      {
        label: 'Stock Status',
        value: this.formatText(item.stockStatus || 'Unknown'),
        required: true
      },
      {
        label: 'Note',
        value: item.specialNote && item.specialNote.trim() ? item.specialNote : 'None',
        multiline: true
      }
    ];
  }

  /* Returns a safe display name when the item name is missing. */
  getItemDisplayName(item: InventoryItem): string {
    const name = String(item.itemName ?? '').trim();
    return name || 'Unnamed Item';
  }

  /* Maps stock status text to Ionic color names. */
  getStatusColor(status: string): string {
    const normalisedStatus = this.normaliseStockStatus(status);

    switch (normalisedStatus) {
      case 'in stock':
        return 'success';
      case 'low stock':
        return 'warning';
      case 'out of stock':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getFeaturedText(item: InventoryItem): string {
    return Number(item.featuredItem) === 1 ? 'Featured' : 'Normal';
  }

  getFeaturedColor(item: InventoryItem): string {
    return Number(item.featuredItem) === 1 ? 'tertiary' : 'medium';
  }

  /* Opens the animated detail panel from the selected item card position. */
  openItemDetail(item: InventoryItem, index: number, event: MouseEvent): void {
    const cardElement = event.currentTarget as HTMLElement | null;

    if (!cardElement || this.isItemDetailVisible) {
      return;
    }

    const cardRect = cardElement.getBoundingClientRect();

    this.clearItemDetailTimers();

    this.selectedItem = item;
    this.selectedItemIndex = index;
    this.selectedItemCardElement = cardElement;
    this.isItemDetailCloseInProgress = false;

    this.isItemDetailVisible = true;
    this.isItemDetailOverlayOpen = false;
    this.isItemDetailSourceHidden = false;
    this.isItemDetailCoverOpen = false;
    this.isItemDetailContentOpen = false;
    this.isItemDetailClosing = false;

    this.itemDetailClosedStyle = this.getClosedCoverStyle(cardRect);
    this.itemDetailPanelStyle = this.getOpenPanelStyle(cardRect);
    this.itemDetailCoverStyle = this.itemDetailClosedStyle;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.isItemDetailOverlayOpen = true;
        this.isItemDetailSourceHidden = true;
      });
    });

    this.setItemDetailTimer(() => {
      this.isItemDetailCoverOpen = true;
      this.itemDetailCoverStyle = this.getOpenCoverStyle(cardRect);
    }, this.sourceExitDelayMs);

    this.setItemDetailTimer(() => {
      this.isItemDetailContentOpen = true;
    }, this.contentOpenDelayMs);
  }

  /* Closes the item detail panel using the reverse animation sequence. */
  closeItemDetail(): void {
    if (!this.isItemDetailVisible || this.isItemDetailCloseInProgress) {
      return;
    }

    this.clearItemDetailTimers();

    const currentCardRect = this.selectedItemCardElement?.getBoundingClientRect();

    if (!currentCardRect) {
      this.resetItemDetailState();
      return;
    }

    this.isItemDetailCloseInProgress = true;

    this.isItemDetailContentOpen = false;

    this.itemDetailClosedStyle = this.getClosedCoverStyle(currentCardRect);
    this.itemDetailPanelStyle = this.getOpenPanelStyle(currentCardRect);

    this.isItemDetailCoverOpen = true;
    this.itemDetailCoverStyle = this.getOpenCoverStyle(currentCardRect);

    this.setItemDetailTimer(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          this.isItemDetailCoverOpen = false;
          this.itemDetailCoverStyle = this.itemDetailClosedStyle;
        });
      });
    }, this.closeContentExitDelayMs);

    this.setItemDetailTimer(() => {
      this.isItemDetailSourceHidden = false;
      this.isItemDetailOverlayOpen = false;
    }, this.closeContentExitDelayMs + this.coverAnimationMs + 1);

    this.setItemDetailTimer(() => {
      this.resetItemDetailState();
    }, this.closeContentExitDelayMs + this.coverAnimationMs + 20);
  }

  /* Shows the help popup for explaining how to use the inventory page. */
  async showHelp(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'HELP PAGE',
      cssClass: 'inventory-glass-help-alert',

      message: new IonicSafeString(
        'This page is used for searching and displaying all inventory items.<br><br>' +
        '<strong>SEARCH ITEM:</strong> User could enter an item name in the search bar to search. ' +
        'Click <strong>Clear Search Results</strong> could return to the inventory item list.<br><br>' +
        '<strong>VIEW DETAILS:</strong> Click an item card will open the detailed information page of the item, ' +
        'allowing user to view the complete item attributes.'
      ),

      buttons: ['OK']
    });

    await alert.present();
  }

  /* Resets all detail panel states after the animation is finished. */
  private resetItemDetailState(): void {
    this.isItemDetailVisible = false;
    this.isItemDetailOverlayOpen = false;
    this.isItemDetailSourceHidden = false;
    this.isItemDetailCoverOpen = false;
    this.isItemDetailContentOpen = false;
    this.isItemDetailClosing = false;
    this.isItemDetailCloseInProgress = false;

    this.selectedItem = null;
    this.selectedItemIndex = null;
    this.selectedItemCardElement = null;

    this.itemDetailCoverStyle = {};
    this.itemDetailPanelStyle = {};
    this.itemDetailClosedStyle = {};
  }

  /* Returns the initial style of the animated cover based on the card position. */
  private getClosedCoverStyle(cardRect: DOMRect): { [key: string]: string } {
    return {
      left: `${cardRect.left}px`,
      top: `${cardRect.top}px`,
      width: `${cardRect.width}px`,
      height: `${cardRect.height}px`,
      borderRadius: '12px',
      transformOrigin: '50% 50%',
      transform: 'translate3d(0px, 0px, 0px)'
    };
  }

  /* Returns the expanded cover style for the detail panel animation. */
  private getOpenCoverStyle(cardRect: DOMRect): { [key: string]: string } {
    const targetRect = this.getDetailTargetRect(cardRect);

    return {
      left: `${targetRect.left}px`,
      top: `${targetRect.top}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
      borderRadius: '12px',
      transformOrigin: '50% 50%',
      transform: 'translate3d(0px, 0px, 0px)'
    };
  }

  /* Returns the final panel position for the expanded item detail view. */
  private getOpenPanelStyle(cardRect: DOMRect): { [key: string]: string } {
    const targetRect = this.getDetailTargetRect(cardRect);

    return {
      left: `${targetRect.left}px`,
      top: `${targetRect.top}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`
    };
  }

  /* Calculates a safe detail panel area while avoiding the bottom tab bar. */
  private getDetailTargetRect(cardRect: DOMRect): { left: number; top: number; width: number; height: number } {
    const viewportHeight = window.innerHeight;

    const tabBarElement = document.querySelector('ion-tab-bar') as HTMLElement | null;
    const tabBarRect = tabBarElement?.getBoundingClientRect();

    const compactMode = viewportHeight <= 700;

    const topGap = compactMode ? 12 : 20;
    const bottomGap = compactMode ? 8 : 12;

    const targetTop = topGap;
    const tabBarTop = tabBarRect ? tabBarRect.top : viewportHeight - 82;
    const targetBottom = Math.min(tabBarTop - bottomGap, viewportHeight - bottomGap);

    const availableHeight = Math.max(180, targetBottom - targetTop);

    return {
      left: cardRect.left,
      top: targetTop,
      width: cardRect.width,
      height: availableHeight
    };
  }




  /* Adds a timeout to the detail animation timer list for safe cleanup. */
  private setItemDetailTimer(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      this.itemDetailTimers = this.itemDetailTimers.filter(item => item !== timer);
      callback();
    }, delay);

    this.itemDetailTimers.push(timer);
  }

  /* Clears all pending detail animation timers. */
  private clearItemDetailTimers(): void {
    this.itemDetailTimers.forEach(timer => window.clearTimeout(timer));
    this.itemDetailTimers = [];
  }

  /* Formats empty text values into a readable fallback. */
  private formatText(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || 'N/A';
  }

  /* Formats a price value for display. */
  private formatPrice(value: unknown): string {
    const numberValue = Number(value ?? 0);

    if (!Number.isFinite(numberValue)) {
      return '0';
    }

    return numberValue.toLocaleString('en-US', {
      minimumFractionDigits: numberValue % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  /* Formats quantity as a whole number. */
  private formatQuantity(value: unknown): string {
    const numberValue = Number(value ?? 0);

    if (!Number.isFinite(numberValue)) {
      return '0';
    }

    return numberValue.toLocaleString('en-US', {
      maximumFractionDigits: 0
    });
  }

  /* Normalises stock status strings for comparison. */
  private normaliseStockStatus(status: string | undefined | null): string {
    return String(status ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /* Displays a glass-style toast message. */
  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'middle',
      cssClass: 'inventory-glass-toast'
    });

    await toast.present();
  }
}