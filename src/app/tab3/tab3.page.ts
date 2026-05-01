import { Component, OnDestroy } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import {
  CATEGORIES,
  InventoryCategory,
  InventoryItem,
  STOCK_STATUSES,
  StockStatus
} from '../models/inventory-item.model';
import { InventoryService } from '../services/inventory.service';
import { IonicSafeString } from '@ionic/angular';

/* Defines the current operation mode for the manage page. */
type ManageMode = 'edit' | 'delete';

/* Defines the custom dropdown menus used in the edit form. */
type ManageSelectMenu = 'category' | 'stockStatus' | 'featuredItem';

/* Defines the form data structure used when editing an inventory item. */
type ManageItemForm = {
  itemName: string;
  category: InventoryCategory | '';
  quantity: number | string | null;
  price: number | string | null;
  supplierName: string;
  stockStatus: StockStatus | '';
  featuredItem: number | '';
  specialNote: string;
};

@Component({
  selector: 'app-tab3',
  standalone: false,
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss']
})
export class Tab3Page implements OnDestroy {
  /* Enum options used by category and stock status dropdowns. */
  categories = CATEGORIES;
  stockStatuses = STOCK_STATUSES;

  /* Tracks which dropdown menu is currently open in the edit form. */
  openManageSelectMenu: ManageSelectMenu | null = null;

  /* Controls the front/back flip state of the edit and delete boxes. */
  isAddBoxFlipped = false;
  isDeleteBoxFlipped = false;

  /* Search text values for edit and delete operations. */
  addSearchName = '';
  deleteSearchName = '';

  /* Search result collections for edit and delete item workflows. */
  editSearchResults: InventoryItem[] = [];
  deleteSearchResults: InventoryItem[] = [];

  /* Controls whether search result areas should be displayed. */
  hasEditSearchResults = false;
  hasDeleteSearchResults = false;

  /* Loading states for edit and delete search requests. */
  loadingEditSearch = false;
  loadingDeleteSearch = false;

  /* Stores the selected manage mode and selected item. */
  selectedManageMode: ManageMode | null = null;
  selectedManageItem: InventoryItem | null = null;

  /* Stores the edit form data and the original item name for update requests. */
  editForm: ManageItemForm | null = null;
  private editOriginalName = '';

  /* Submit loading states for update and delete operations. */
  updatingItem = false;
  deletingItem = false;

  /* Animation state flags for the manage detail overlay. */
  isManageDetailVisible = false;
  isManageDetailOverlayOpen = false;
  isManageDetailSourceHidden = false;
  isManageDetailCoverOpen = false;
  isManageDetailContentOpen = false;
  isManageDetailClosing = false;

  /* Dynamic styles used by the animated detail cover and panel. */
  manageDetailCoverStyle: { [key: string]: string } = {};
  manageDetailPanelStyle: { [key: string]: string } = {};

  /* Private state used to restore the selected card after closing the detail panel. */
  private manageDetailClosedStyle: { [key: string]: string } = {};
  private manageDetailTimers: ReturnType<typeof setTimeout>[] = [];
  private selectedManageCardElement: HTMLElement | null = null;
  private isManageDetailCloseInProgress = false;

  /* Timing values used to coordinate open and close animations. */
  private readonly sourceExitDelayMs = 130;
  private readonly closeContentExitDelayMs = 130;
  private readonly coverAnimationMs = 250;
  private readonly contentOpenDelayMs = 400;
  private readonly detailVerticalMarginPx = 88;

  constructor(
    private inventoryService: InventoryService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  /* Clears pending animation timers when this page is destroyed. */
  ngOnDestroy(): void {
    this.clearManageDetailTimers();
  }

  /* Flips the edit box to show the search input side. */
  showAddBack(): void {
    this.isAddBoxFlipped = true;
  }

  /* Returns the edit box to the front side and clears edit search results. */
  showAddFront(): void {
    this.isAddBoxFlipped = false;
    this.clearEditSearchResults();
  }

  /* Flips the delete box to show the search input side. */
  showDeleteBack(): void {
    this.isDeleteBoxFlipped = true;
  }

  /* Returns the delete box to the front side and clears delete search results. */
  showDeleteFront(): void {
    this.isDeleteBoxFlipped = false;
    this.clearDeleteSearchResults();
  }

  /* Searches for an item to edit using the entered exact item name. */
  searchEditItem(): void {
    const name = this.addSearchName.trim();

    if (!name) {
      this.showToast('Please enter an item name to search.');
      return;
    }

    this.loadingEditSearch = true;
    this.hasEditSearchResults = true;
    this.editSearchResults = [];
    this.selectedManageItem = null;
    this.selectedManageMode = null;
    this.editForm = null;
    this.editOriginalName = '';

    this.inventoryService.searchItemsByName(name).subscribe({
      next: items => {
        this.editSearchResults = items;
        this.loadingEditSearch = false;
        this.showSearchToast(items.length);
      },
      error: () => {
        this.editSearchResults = [];
        this.loadingEditSearch = false;
        this.showToast('Search failed.');
      }
    });
  }

  /* Searches for an item to delete using the entered exact item name. */
  searchDeleteItem(): void {
    const name = this.deleteSearchName.trim();

    if (!name) {
      this.showToast('Please enter an item name to search.');
      return;
    }

    this.loadingDeleteSearch = true;
    this.hasDeleteSearchResults = true;
    this.deleteSearchResults = [];
    this.selectedManageItem = null;
    this.selectedManageMode = null;

    this.inventoryService.searchItemsByName(name).subscribe({
      next: items => {
        this.deleteSearchResults = items;
        this.loadingDeleteSearch = false;
        this.showSearchToast(items.length);
      },
      error: () => {
        this.deleteSearchResults = [];
        this.loadingDeleteSearch = false;
        this.showToast('Search failed.');
      }
    });
  }

  /* Opens the edit form for the selected search result item. */
  openEditItemForm(item: InventoryItem, event: MouseEvent): void {
    this.openManageDetail(item, 'edit', event);
  }

  /* Opens the delete detail form for the selected search result item. */
  openDeleteItemForm(item: InventoryItem, event: MouseEvent): void {
    this.openManageDetail(item, 'delete', event);
  }

  /* Closes the manage detail panel using the reverse animation sequence. */
  closeManageDetail(): void {
    if (!this.isManageDetailVisible || this.isManageDetailCloseInProgress) {
      return;
    }

    this.clearManageDetailTimers();

    const currentCardRect = this.selectedManageCardElement?.getBoundingClientRect();

    if (!currentCardRect) {
      this.resetManageDetailState();
      return;
    }

    this.isManageDetailCloseInProgress = true;
    this.isManageDetailClosing = true;
    this.isManageDetailContentOpen = false;

    this.manageDetailClosedStyle = this.getClosedCoverStyle(currentCardRect);
    this.manageDetailPanelStyle = this.getOpenPanelStyle(currentCardRect);

    this.isManageDetailCoverOpen = true;
    this.manageDetailCoverStyle = this.getOpenCoverStyle(currentCardRect);

    this.setManageDetailTimer(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          this.isManageDetailCoverOpen = false;
          this.manageDetailCoverStyle = this.manageDetailClosedStyle;
        });
      });
    }, this.closeContentExitDelayMs);

    this.setManageDetailTimer(() => {
      this.isManageDetailSourceHidden = false;
      this.isManageDetailOverlayOpen = false;
    }, this.closeContentExitDelayMs + this.coverAnimationMs + 1);

    this.setManageDetailTimer(() => {
      this.resetManageDetailState();
    }, this.closeContentExitDelayMs + this.coverAnimationMs + 20);
  }

  /* Validates and updates the currently selected item. */
  async updateSelectedItem(): Promise<void> {
    if (!this.editForm || !this.selectedManageItem || this.selectedManageMode !== 'edit') {
      return;
    }

    if (!this.isValidManageForm(this.editForm)) {
      await this.showToast('Please complete all required fields with valid values.');
      return;
    }

    const originalSelectedItem = this.selectedManageItem;
    const updatedItem = this.buildInventoryItemFromForm(this.editForm, originalSelectedItem);

    const loading = await this.loadingController.create({
      message: 'Updating item...',
      cssClass: 'inventory-glass-loading'
    });

    this.updatingItem = true;
    await loading.present();

    this.inventoryService.updateItem(this.editOriginalName, updatedItem).subscribe({
      next: async () => {
        this.updatingItem = false;
        await loading.dismiss();

        this.editSearchResults = this.editSearchResults.map(item =>
          item === originalSelectedItem ? updatedItem : item
        );

        this.addSearchName = updatedItem.itemName;

        await this.showToast('Item updated successfully.');
        this.closeManageDetail();
      },
      error: async () => {
        this.updatingItem = false;
        await loading.dismiss();

        await this.showToast('Unable to update item.');
      }
    });
  }

  /* Shows a confirmation alert before deleting the selected item. */
  async deleteSelectedItem(): Promise<void> {
    if (!this.selectedManageItem || this.selectedManageMode !== 'delete') {
      return;
    }

    const itemName = this.getItemDisplayName(this.selectedManageItem);

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${itemName}"?`,
      cssClass: 'inventory-glass-confirm-alert',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.performDeleteItem(itemName);
          }
        }
      ]
    });

    await alert.present();
  }

  /* Clears edit search results and resets edit-related states. */
  clearEditSearchResults(): void {
    this.clearManageDetailTimers();
    this.resetManageDetailState();

    this.hasEditSearchResults = false;
    this.editSearchResults = [];
    this.addSearchName = '';
    this.loadingEditSearch = false;
    this.updatingItem = false;
  }

  /* Clears delete search results and resets delete-related states. */
  clearDeleteSearchResults(): void {
    this.clearManageDetailTimers();
    this.resetManageDetailState();

    this.hasDeleteSearchResults = false;
    this.deleteSearchResults = [];
    this.deleteSearchName = '';
    this.loadingDeleteSearch = false;
    this.deletingItem = false;
  }

  /* Closes only the current edit form panel. */
  closeEditFormOnly(): void {
    this.closeManageDetail();
  }

  /* Closes only the current delete form panel. */
  closeDeleteFormOnly(): void {
    this.closeManageDetail();
  }

  /* Opens or closes a custom dropdown menu in the edit form. */
  toggleManageSelectMenu(menu: ManageSelectMenu): void {
    this.openManageSelectMenu = this.openManageSelectMenu === menu ? null : menu;
  }

  /* Updates the category value in the edit form. */
  selectEditCategory(category: InventoryCategory | ''): void {
    if (!this.editForm) {
      return;
    }

    this.editForm.category = category;
    this.openManageSelectMenu = null;
  }

  /* Updates the stock status value in the edit form. */
  selectEditStockStatus(status: StockStatus | ''): void {
    if (!this.editForm) {
      return;
    }

    this.editForm.stockStatus = status;
    this.openManageSelectMenu = null;
  }

  /* Updates the featured item value in the edit form. */
  selectEditFeaturedItem(value: number | ''): void {
    if (!this.editForm) {
      return;
    }

    this.editForm.featuredItem = value;
    this.openManageSelectMenu = null;
  }

  /* Returns display text for the featured item dropdown in edit mode. */
  getEditFeaturedItemDisplayText(): string {
    if (!this.editForm || this.editForm.featuredItem === '') {
      return 'Select Status';
    }

    return Number(this.editForm.featuredItem) === 1 ? 'Featured' : 'Not Featured';
  }

  /* Returns a safe item display name with fallback handling. */
  getItemDisplayName(item: InventoryItem): string {
    const name = String(item.itemName ?? item.item_name ?? '').trim();
    return name || 'Unnamed Item';
  }

  /* Converts featured item value into readable display text. */
  getFeaturedDisplayText(item: InventoryItem): string {
    return Number(item.featuredItem ?? item.featured_item) === 1 ? 'Featured' : 'Not Featured';
  }

  /* Shows the Help popup for the manage page. */
  async showHelp(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'HELP PAGE',
      cssClass: 'inventory-glass-help-alert',
      message: new IonicSafeString(
        'This page is used to modify and delete items.<br>' +
        'There are two areas on the page: <strong>EDIT ITEM</strong> and <strong>DELETE ITEM</strong>. ' +
        'Users can perform operations after clicking on the corresponding area.<br><br> ' +
        '<strong>EDIT ITEM:</strong> User can search items by the names, ' +
        'after selecting the item, user can edit its attribute values.<br><br>' +
        '<strong>DELETE ITEM:</strong> User can search items by the names, ' +
        'after selecting the item, user can view item information and delete it.'
      ),
      buttons: ['OK']
    });

    await alert.present();
  }

  /* Opens the animated manage detail panel from the selected result card. */
  private openManageDetail(item: InventoryItem, mode: ManageMode, event: MouseEvent): void {
    const cardElement = event.currentTarget as HTMLElement | null;

    if (!cardElement || this.isManageDetailVisible) {
      return;
    }

    const cardRect = cardElement.getBoundingClientRect();

    this.clearManageDetailTimers();

    this.openManageSelectMenu = null;
    this.selectedManageMode = mode;
    this.selectedManageItem = item;
    this.selectedManageCardElement = cardElement;
    this.isManageDetailCloseInProgress = false;

    if (mode === 'edit') {
      this.editOriginalName = this.getItemDisplayName(item);
      this.editForm = this.itemToManageForm(item);
    } else {
      this.editOriginalName = '';
      this.editForm = null;
    }

    this.isManageDetailVisible = true;
    this.isManageDetailOverlayOpen = false;
    this.isManageDetailSourceHidden = false;
    this.isManageDetailCoverOpen = false;
    this.isManageDetailContentOpen = false;
    this.isManageDetailClosing = false;

    this.manageDetailClosedStyle = this.getClosedCoverStyle(cardRect);
    this.manageDetailPanelStyle = this.getOpenPanelStyle(cardRect);
    this.manageDetailCoverStyle = this.manageDetailClosedStyle;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.isManageDetailOverlayOpen = true;
        this.isManageDetailSourceHidden = true;
      });
    });

    this.setManageDetailTimer(() => {
      this.isManageDetailCoverOpen = true;
      this.manageDetailCoverStyle = this.getOpenCoverStyle(cardRect);
    }, this.sourceExitDelayMs);

    this.setManageDetailTimer(() => {
      this.isManageDetailContentOpen = true;
    }, this.contentOpenDelayMs);
  }

  /* Performs the delete request after the user confirms deletion. */
  private async performDeleteItem(itemName: string): Promise<void> {
    const selectedItem = this.selectedManageItem;

    const loading = await this.loadingController.create({
      message: 'Deleting item...',
      cssClass: 'inventory-glass-loading'
    });

    this.deletingItem = true;
    await loading.present();

    this.inventoryService.deleteItem(itemName).subscribe({
      next: async () => {
        this.deletingItem = false;
        await loading.dismiss();

        this.deleteSearchResults = this.deleteSearchResults.filter(item => item !== selectedItem);

        await this.showToast('Item deleted successfully.');
        this.closeManageDetail();
      },
      error: async () => {
        this.deletingItem = false;
        await loading.dismiss();

        await this.showToast('Unable to delete item. This item may be protected.');
      }
    });
  }

  /* Converts an inventory item into editable form data. */
  private itemToManageForm(item: InventoryItem): ManageItemForm {
    return {
      itemName: this.getItemDisplayName(item),
      category: item.category || '',
      quantity: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),
      supplierName: String(item.supplierName ?? item.supplier_name ?? '').trim(),
      stockStatus: this.normaliseStockStatus(item.stockStatus ?? item.stock_status ?? ''),
      featuredItem: Number(item.featuredItem ?? item.featured_item) === 1 ? 1 : 0,
      specialNote: item.specialNote?.trim() ?? item.special_note?.trim() ?? ''
    };
  }

  /* Builds the API update payload from the edit form values. */
  private buildInventoryItemFromForm(form: ManageItemForm, originalItem: InventoryItem): InventoryItem {
    const stockStatus = this.normaliseStockStatus(form.stockStatus);

    if (stockStatus === '') {
      throw new Error('Invalid stock status');
    }

    return {
      id: originalItem.id,
      item_id: originalItem.item_id,
      itemName: form.itemName.trim(),
      item_name: form.itemName.trim(),
      category: form.category as InventoryCategory,
      quantity: Number(form.quantity),
      price: Number(form.price),
      supplierName: form.supplierName.trim(),
      supplier_name: form.supplierName.trim(),
      stockStatus,
      stock_status: stockStatus,
      featuredItem: Number(form.featuredItem),
      featured_item: Number(form.featuredItem),
      specialNote: form.specialNote.trim(),
      special_note: form.specialNote.trim()
    };
  }

  /* Normalises different stock status formats into valid enum values. */
  private normaliseStockStatus(value: unknown): StockStatus | '' {
    const cleanValue = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');

    if (!cleanValue) {
      return '';
    }

    const matchedStatus = this.stockStatuses.find(status =>
      status.toLowerCase().replace(/\s+/g, ' ') === cleanValue
    );

    if (matchedStatus) {
      return matchedStatus;
    }

    if (cleanValue === 'instock' || cleanValue === 'in stock') {
      return 'In Stock' as StockStatus;
    }

    if (cleanValue === 'lowstock' || cleanValue === 'low stock') {
      return 'Low Stock' as StockStatus;
    }

    if (cleanValue === 'outofstock' || cleanValue === 'out stock' || cleanValue === 'out of stock') {
      return 'Out of Stock' as StockStatus;
    }

    return '';
  }

  /* Checks whether all required edit form fields contain valid values. */
  private isValidManageForm(form: ManageItemForm): boolean {
    return Boolean(
      form.itemName.trim() &&
      form.supplierName.trim() &&
      form.category !== '' &&
      form.stockStatus !== '' &&
      form.featuredItem !== '' &&
      this.isValidNonNegativeInteger(form.quantity) &&
      this.isValidNonNegativeInteger(form.price)
    );
  }

  /* Validates that a value is a non-negative integer. */
  private isValidNonNegativeInteger(value: number | string | null): boolean {
    if (value === null || value === '') {
      return false;
    }

    const numberValue = Number(value);

    return Number.isInteger(numberValue) && numberValue >= 0;
  }

  /* Resets all manage detail states after closing the overlay. */
  private resetManageDetailState(): void {
    this.isManageDetailVisible = false;
    this.isManageDetailOverlayOpen = false;
    this.isManageDetailSourceHidden = false;
    this.isManageDetailCoverOpen = false;
    this.isManageDetailContentOpen = false;
    this.isManageDetailClosing = false;
    this.isManageDetailCloseInProgress = false;

    this.selectedManageMode = null;
    this.selectedManageItem = null;
    this.selectedManageCardElement = null;
    this.openManageSelectMenu = null;

    this.editForm = null;
    this.editOriginalName = '';

    this.manageDetailCoverStyle = {};
    this.manageDetailPanelStyle = {};
    this.manageDetailClosedStyle = {};
  }

  /* Returns the closed cover style based on the selected card position. */
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

  /* Returns the opened cover style used by the expansion animation. */
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

  /* Returns the final open panel style for the manage detail view. */
  private getOpenPanelStyle(cardRect: DOMRect): { [key: string]: string } {
    const targetRect = this.getDetailTargetRect(cardRect);

    return {
      left: `${targetRect.left}px`,
      top: `${targetRect.top}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`
    };
  }

  /* Calculates the target detail panel size while avoiding the bottom tab bar. */
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

  /* Adds an animation timer and stores it for safe cleanup. */
  private setManageDetailTimer(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      this.manageDetailTimers = this.manageDetailTimers.filter(item => item !== timer);
      callback();
    }, delay);

    this.manageDetailTimers.push(timer);
  }

  /* Clears all pending manage detail animation timers. */
  private clearManageDetailTimers(): void {
    this.manageDetailTimers.forEach(timer => window.clearTimeout(timer));
    this.manageDetailTimers = [];
  }

  /* Displays a toast message based on the number of search results. */
  private showSearchToast(count: number): void {
    if (count === 0) {
      this.showToast('No item found with that name.');
      return;
    }

    if (count === 1) {
      this.showToast('1 matching record found.');
      return;
    }

    this.showToast(`${count} matching records found.`);
  }

  /* Shows a short glass-style toast notification. */
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