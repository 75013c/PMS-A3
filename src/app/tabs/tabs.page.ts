import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

/* Defines the Angular component metadata for the tab navigation page. */
@Component({
  selector: 'app-tabs',
  standalone: false,
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss']
})
export class TabsPage implements OnInit, OnDestroy {
  /* Stores the currently active tab for styling the tab bar highlight. */
  activeTab = 'tab1';

  /* Stores the router event subscription so it can be cleaned up later. */
  private routerSubscription: Subscription | null = null;

  /* Injects Angular Router to detect navigation changes between tabs. */
  constructor(private router: Router) {}

  /* Sets the initial active tab and listens for later route changes. */
  ngOnInit(): void {
    this.updateActiveTab(this.router.url);

    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateActiveTab(event.urlAfterRedirects);
      }
    });
  }

  /* Prevents memory leaks by unsubscribing when the tabs component is destroyed. */
  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  /* Updates the active tab when Ionic reports a tab change event. */
  onTabsDidChange(event: { tab: string }): void {
    if (event.tab) {
      this.activeTab = event.tab;
    }
  }

  /* Extracts the active tab name from the current route URL. */
  private updateActiveTab(url: string): void {
    const match = url.match(/\/tabs\/(tab[1-4])(?:[/?#]|$)/);

    if (match?.[1]) {
      this.activeTab = match[1];
    }
  }
}