import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IonicSafeString } from '@ionic/angular';

/* Defines the Angular component metadata for the Privacy and Security page. */
@Component({
  selector: 'app-tab4',
  standalone: false,
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss']
})
export class Tab4Page {
  /* Injects AlertController for displaying the page help popup. */
  constructor(private alertController: AlertController) { }

  /* Shows the help dialog explaining the privacy and security page purpose. */
  async showHelp(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'HELP PAGE',
      cssClass: 'inventory-glass-help-alert',
      message: new IonicSafeString(
        'This page is used to explain the privacy and security issues of the system.<br><br>' +
        '<strong>PRIVACY:</strong> Users can see here how the application protects inventory data, ' +
        'such as collecting only necessary item information, using secure network communication, ' +
        'checking user inputs, and preventing incorrect modifications or deletions of items.<br><br>' +
        '<strong>SECURITY:</strong> Users are also reminded to use their phones safely, ' +
        'such as protecting device passwords and not managing important inventory data in insecure public networks.'
      ),
      buttons: ['OK']
    });

    await alert.present();
  }
}