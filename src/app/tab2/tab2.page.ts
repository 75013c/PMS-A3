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

/* Defines the data structure used by the Add Item form. */
type AddItemForm = {
  itemName: string;
  category: InventoryCategory | '';
  quantity: number | string | null;
  price: number | string | null;
  supplierName: string;
  stockStatus: StockStatus | '';
  featuredItem: number | '';
  specialNote: string;
};

/* Defines the available custom dropdown menus in the Add Item form. */
type AddSelectMenu = 'category' | 'stockStatus' | 'featuredItem';

/* Defines one display row in the item detail panel. */
type ItemDetailRow = {
  label: string;
  value: string;
  required?: boolean;
  multiline?: boolean;
};

@Component({
  selector: 'app-tab2',
  standalone: false,
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnDestroy {
  /* Enum option lists used by the custom select controls. */
  categories = CATEGORIES;
  stockStatuses = STOCK_STATUSES;

  /* Tracks which dropdown menu is currently open. */
  openSelectMenu: AddSelectMenu | null = null;

  /* Animation state flags for the Add Item form overlay. */
  isAddFormVisible = false;
  isAddFormOverlayOpen = false;
  isAddCardSourceHidden = false;
  isAddFormCoverOpen = false;
  isAddFormContentOpen = false;
  isAddFormClosing = false;

  /* Dynamic style objects used by the Add Item form expansion animation. */
  addFormCoverStyle: { [key: string]: string } = {};
  addFormPanelStyle: { [key: string]: string } = {};

  /* Stores the current add form state and submit loading state. */
  addingItem = false;
  addItemForm: AddItemForm = this.getEmptyAddItemForm();

  /* Stores featured items displayed at the bottom of Tab2. */
  featuredItems: InventoryItem[] = [];
  loadingFeaturedItems = false;

  /* Stores the selected featured item for the detail panel. */
  selectedItem: InventoryItem | null = null;
  selectedItemIndex: number | null = null;

  /* Animation state flags for the featured item detail overlay. */
  isItemDetailVisible = false;
  isItemDetailOverlayOpen = false;
  isItemDetailSourceHidden = false;
  isItemDetailCoverOpen = false;
  isItemDetailContentOpen = false;
  isItemDetailClosing = false;

  /* Dynamic style objects used by the featured item detail animation. */
  itemDetailCoverStyle: { [key: string]: string } = {};
  itemDetailPanelStyle: { [key: string]: string } = {};

  /* Private state used to restore the Add Item card after closing the form. */
  private addFormClosedStyle: { [key: string]: string } = {};
  private addFormTimers: ReturnType<typeof setTimeout>[] = [];
  private selectedAddCardElement: HTMLElement | null = null;
  private isAddFormCloseInProgress = false;

  /* Private state used to restore the selected item card after closing details. */
  private itemDetailClosedStyle: { [key: string]: string } = {};
  private itemDetailTimers: ReturnType<typeof setTimeout>[] = [];
  private selectedItemCardElement: HTMLElement | null = null;
  private isItemDetailCloseInProgress = false;

  /* Shared animation timing values for form and detail transitions. */
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

  /* Clears active timers when the page component is destroyed. */
  ngOnDestroy(): void {
    this.clearAddFormTimers();
    this.clearItemDetailTimers();
  }

  /* Reloads featured items whenever the tab becomes active. */
  ionViewWillEnter(): void {
    this.loadFeaturedItems();
  }

  /* Loads all items and filters only featured records for display. */
  loadFeaturedItems(): void {
    this.loadingFeaturedItems = true;

    this.inventoryService.getAllItems().subscribe({
      next: items => {
        this.featuredItems = items.filter(item => Number(item.featuredItem) === 1);
        this.loadingFeaturedItems = false;
      },
      error: async () => {
        this.featuredItems = [];
        this.loadingFeaturedItems = false;
        await this.showToast('Unable to load featured items.');
      }
    });
  }

  /* Builds the summary text shown above the featured item list. */
  get featuredItemListSummary(): string {
    const count = this.featuredItems.length;
    return count === 1 ? 'Display 1 featured item' : `Display ${count} featured items`;
  }

  /* Converts the selected featured item into labelled rows for the detail panel. */
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

  /* Opens the Add Item form when the user clicks the add card. */
  openAddForm(event: MouseEvent): void {
    const cardElement = event.currentTarget as HTMLElement | null;

    if (!cardElement || this.isAddFormVisible) {
      return;
    }

    this.openAddFormFromCard(cardElement);
  }

  /* Allows keyboard users to open the Add Item form with Enter or Space. */
  onAddCardKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();

    const cardElement = event.currentTarget as HTMLElement | null;

    if (!cardElement || this.isAddFormVisible) {
      return;
    }

    this.openAddFormFromCard(cardElement);
  }

  /* Opens or closes the selected custom dropdown menu. */
  toggleSelectMenu(menu: AddSelectMenu): void {
    this.openSelectMenu = this.openSelectMenu === menu ? null : menu;
  }

  /* Updates the selected category value in the add form. */
  selectCategory(category: InventoryCategory | ''): void {
    this.addItemForm.category = category;
    this.openSelectMenu = null;
  }

  /* Updates the selected stock status value in the add form. */
  selectStockStatus(status: StockStatus | ''): void {
    this.addItemForm.stockStatus = status;
    this.openSelectMenu = null;
  }

  /* Updates the selected featured item value in the add form. */
  selectFeaturedItem(value: number | ''): void {
    this.addItemForm.featuredItem = value;
    this.openSelectMenu = null;
  }

  /* Returns the display text for the Featured dropdown field. */
  getFeaturedItemDisplayText(): string {
    if (this.addItemForm.featuredItem === '') {
      return 'Select Status';
    }

    return this.addItemForm.featuredItem === 1 ? 'Featured' : 'Not Featured';
  }

  /* Closes the Add Item form with the reverse animation sequence. */
  closeAddForm(): void {
    if (!this.isAddFormVisible || this.isAddFormCloseInProgress) {
      return;
    }

    this.openSelectMenu = null;
    this.clearAddFormTimers();

    const currentCardRect = this.selectedAddCardElement?.getBoundingClientRect();

    if (!currentCardRect) {
      this.resetAddFormState();
      return;
    }

    this.isAddFormCloseInProgress = true;
    this.isAddFormClosing = true;
    this.isAddFormContentOpen = false;

    this.addFormClosedStyle = this.getClosedCoverStyle(currentCardRect);
    this.addFormPanelStyle = this.getOpenPanelStyle(currentCardRect);

    this.isAddFormCoverOpen = true;
    this.addFormCoverStyle = this.getOpenCoverStyle(currentCardRect);

    this.setAddFormTimer(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          this.isAddFormCoverOpen = false;
          this.addFormCoverStyle = this.addFormClosedStyle;
        });
      });
    }, this.closeContentExitDelayMs);

    this.setAddFormTimer(() => {
      this.isAddCardSourceHidden = false;
    }, this.closeContentExitDelayMs + this.coverAnimationMs - 40);

    this.setAddFormTimer(() => {
      this.isAddFormOverlayOpen = false;
    }, this.closeContentExitDelayMs + this.coverAnimationMs);

    this.setAddFormTimer(() => {
      this.resetAddFormState();
    }, this.closeContentExitDelayMs + this.coverAnimationMs + 60);
  }

  /* Resets the Add Item form back to its empty default state. */
  clearAddForm(): void {
    this.addItemForm = this.getEmptyAddItemForm();
    this.openSelectMenu = null;
  }

  /* Validates and submits a new inventory item to the API. */
  async addItem(): Promise<void> {
    this.openSelectMenu = null;

    if (!this.isValidAddItemForm()) {
      await this.showToast('Please complete all required fields with valid values.');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Adding item...',
      cssClass: 'inventory-glass-loading'
    });

    this.addingItem = true;
    await loading.present();

    this.inventoryService.addItem(this.buildInventoryItem()).subscribe({
      next: async () => {
        this.addingItem = false;
        await loading.dismiss();

        await this.showToast('Item added successfully.');
        this.clearAddForm();
        this.closeAddForm();
        this.loadFeaturedItems();
      },
      error: async () => {
        this.addingItem = false;
        await loading.dismiss();

        await this.showToast('Unable to add item. The item name may already exist.');
      }
    });
  }

  /* Returns a safe display name when an item name is missing. */
  getItemDisplayName(item: InventoryItem): string {
    const name = String(item.itemName ?? '').trim();
    return name || 'Unnamed Item';
  }

  /* Opens the expanded detail panel for a selected featured item. */
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

  /* Closes the featured item detail panel with a reverse animation. */
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

  /* Displays the Help popup for the Add Item page. */
  async showHelp(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'HELP PAGE',
      cssClass: 'inventory-glass-help-alert',
      message: new IonicSafeString(
        'This page is used for adding new items and displaying featured items.<br><br>' +
        '<strong>ADD ITEM:</strong> The user needs to fill in all the required attribute values for the new item in the form, ' +
        'then the system will check if the attributes are complete and if the data type is correct.' +
        'If the input is correct, new item will be added to the inventory database.<br><br>' +
        '<strong>FEATURED ITEMS:</strong> Featured Items will be displayed at the bottom of the page. ' +
        'Users can click on these item cards to view their detailed information.'
      ),
      buttons: ['OK']
    });

    await alert.present();
  }

  /* Starts the Add Item form animation from the clicked card position. */
  private openAddFormFromCard(cardElement: HTMLElement): void {
    const cardRect = cardElement.getBoundingClientRect();

    this.clearAddFormTimers();

    this.addItemForm = this.getEmptyAddItemForm();
    this.openSelectMenu = null;
    this.selectedAddCardElement = cardElement;
    this.isAddFormCloseInProgress = false;

    this.isAddFormVisible = true;
    this.isAddFormOverlayOpen = false;
    this.isAddCardSourceHidden = false;
    this.isAddFormCoverOpen = false;
    this.isAddFormContentOpen = false;
    this.isAddFormClosing = false;

    this.addFormClosedStyle = this.getClosedCoverStyle(cardRect);
    this.addFormPanelStyle = this.getOpenPanelStyle(cardRect);
    this.addFormCoverStyle = this.addFormClosedStyle;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.isAddFormOverlayOpen = true;
        this.isAddCardSourceHidden = true;
      });
    });

    this.setAddFormTimer(() => {
      this.isAddFormCoverOpen = true;
      this.addFormCoverStyle = this.getOpenCoverStyle(cardRect);
    }, this.sourceExitDelayMs);

    this.setAddFormTimer(() => {
      this.isAddFormContentOpen = true;
    }, this.contentOpenDelayMs);
  }

  /* Creates a blank form object for adding a new item. */
  private getEmptyAddItemForm(): AddItemForm {
    return {
      itemName: '',
      category: '',
      quantity: null,
      price: null,
      supplierName: '',
      stockStatus: '',
      featuredItem: '',
      specialNote: ''
    };
  }

  /* Checks that all required add form fields contain valid values. */
  private isValidAddItemForm(): boolean {
    return Boolean(
      this.addItemForm.itemName.trim() &&
      this.addItemForm.supplierName.trim() &&
      this.addItemForm.category !== '' &&
      this.addItemForm.stockStatus !== '' &&
      this.addItemForm.featuredItem !== '' &&
      this.isValidNonNegativeInteger(this.addItemForm.quantity) &&
      this.isValidNonNegativeInteger(this.addItemForm.price)
    );
  }

  /* Validates that a numeric form value is a non-negative integer. */
  private isValidNonNegativeInteger(value: number | string | null): boolean {
    if (value === null || value === '') {
      return false;
    }

    const numberValue = Number(value);

    return Number.isInteger(numberValue) && numberValue >= 0;
  }

  /* Builds the API payload from the current Add Item form values. */
  private buildInventoryItem(): InventoryItem {
    return {
      itemName: this.addItemForm.itemName.trim(),
      category: this.addItemForm.category as InventoryCategory,
      quantity: Number(this.addItemForm.quantity),
      price: Number(this.addItemForm.price),
      supplierName: this.addItemForm.supplierName.trim(),
      stockStatus: this.addItemForm.stockStatus as StockStatus,
      featuredItem: Number(this.addItemForm.featuredItem),
      specialNote: this.addItemForm.specialNote.trim()
    };
  }

  /* Resets all Add Item form animation and selection states. */
  private resetAddFormState(): void {
    this.isAddFormVisible = false;
    this.isAddFormOverlayOpen = false;
    this.isAddCardSourceHidden = false;
    this.isAddFormCoverOpen = false;
    this.isAddFormContentOpen = false;
    this.isAddFormClosing = false;
    this.isAddFormCloseInProgress = false;

    this.openSelectMenu = null;
    this.selectedAddCardElement = null;

    this.addFormCoverStyle = {};
    this.addFormPanelStyle = {};
    this.addFormClosedStyle = {};
  }

  /* Resets all featured item detail animation states. */
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

  /* Returns the initial closed cover style based on the source card rectangle. */
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

  /* Returns the expanded cover style for form and detail animations. */
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

  /* Returns the final panel style for the opened overlay. */
  private getOpenPanelStyle(cardRect: DOMRect): { [key: string]: string } {
    const targetRect = this.getDetailTargetRect(cardRect);

    return {
      left: `${targetRect.left}px`,
      top: `${targetRect.top}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`
    };
  }

  /* Calculates the overlay panel target area while avoiding the bottom tab bar. */
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

  /* Adds an Add Item form animation timer and stores it for cleanup. */
  private setAddFormTimer(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      this.addFormTimers = this.addFormTimers.filter(item => item !== timer);
      callback();
    }, delay);

    this.addFormTimers.push(timer);
  }

  /* Clears all pending Add Item form animation timers. */
  private clearAddFormTimers(): void {
    this.addFormTimers.forEach(timer => window.clearTimeout(timer));
    this.addFormTimers = [];
  }

  /* Adds an item detail animation timer and stores it for cleanup. */
  private setItemDetailTimer(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      this.itemDetailTimers = this.itemDetailTimers.filter(item => item !== timer);
      callback();
    }, delay);

    this.itemDetailTimers.push(timer);
  }

  /* Clears all pending item detail animation timers. */
  private clearItemDetailTimers(): void {
    this.itemDetailTimers.forEach(timer => window.clearTimeout(timer));
    this.itemDetailTimers = [];
  }

  /* Formats empty text values into a readable fallback. */
  private formatText(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || 'N/A';
  }

  /* Formats a price value for display in the detail panel. */
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

  /* Formats quantity values as whole numbers. */
  private formatQuantity(value: unknown): string {
    const numberValue = Number(value ?? 0);

    if (!Number.isFinite(numberValue)) {
      return '0';
    }

    return numberValue.toLocaleString('en-US', {
      maximumFractionDigits: 0
    });
  }

  /* Displays a short glass-style toast message. */
  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      position: 'middle',
      cssClass: 'inventory-glass-toast'
    });

    await toast.present();
  }
}