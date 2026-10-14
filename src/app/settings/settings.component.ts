import { Component, OnInit, EventEmitter, HostListener } from '@angular/core';
import { PostsService } from 'app/posts.services';
import { MatSnackBar } from '@angular/material/snack-bar';
import {DomSanitizer} from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { ArgModifierDialogComponent } from 'app/dialogs/arg-modifier-dialog/arg-modifier-dialog.component';
import { CURRENT_VERSION } from 'app/consts';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { CookiesUploaderDialogComponent } from 'app/dialogs/cookies-uploader-dialog/cookies-uploader-dialog.component';
import { ConfirmDialogComponent } from 'app/dialogs/confirm-dialog/confirm-dialog.component';
import { moveItemInArray, CdkDragDrop } from '@angular/cdk/drag-drop';
import { InputDialogComponent } from 'app/input-dialog/input-dialog.component';
import { EditCategoryDialogComponent } from 'app/dialogs/edit-category-dialog/edit-category-dialog.component';
import { ActivatedRoute, Router } from '@angular/router';
import { Category, DBInfoResponse } from 'api-types';
import { GenerateRssUrlComponent } from 'app/dialogs/generate-rss-url/generate-rss-url.component';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  initial_config = null;
  new_config = null
  loading_config = false;
  generated_bookmarklet_code = null;
  bookmarkletAudioOnly = false;

  db_info: DBInfoResponse = null;
  db_transferring = false;
  testing_connection_string = false;

  _settingsSame = true;

  latestGithubRelease = null;
  CURRENT_VERSION = CURRENT_VERSION

  settingsSections = [
    {
      key: 'main',
      label: $localize`:Main settings label:Main`,
      searchText: $localize`:Main settings search terms@@settingsSearchMainTerms:server connection URL port multi-user mode user access users base path subscriptions base path check interval redownload fresh uploads theme appearance`
    },
    {
      key: 'downloader',
      label: $localize`:Downloader settings label:Downloader`,
      searchText: $localize`:Downloader settings search terms@@settingsSearchDownloaderTerms:audio folder path video folder path default file output global custom arguments categories playlist categorization archive thumbnail metadata concurrent downloads rate limit kill downloads`
    },
    {
      key: 'extra',
      label: $localize`:Extra settings label:Extra`,
      searchText: $localize`:Extra settings search terms@@settingsSearchExtraTerms:title file manager quality download only autoplay downloads manager API key YouTube API Twitch chat SponsorBlock NFO RSS browser extension bookmarklet`
    },
    {
      key: 'database',
      label: $localize`:Database settings label:Database`,
      searchText: $localize`:Database settings search terms@@settingsSearchDatabaseTerms:database records MongoDB connection string test connection transfer local database`
    },
    {
      key: 'notifications',
      label: $localize`:Notifications settings label:Notifications`,
      searchText: $localize`:Notifications settings search terms@@settingsSearchNotificationTerms:notifications allowed notification types webhook Discord Slack ntfy Gotify Telegram server URL token chat ID proxy`
    },
    {
      key: 'advanced',
      label: $localize`:Host settings label:Advanced`,
      searchText: $localize`:Advanced settings search terms@@settingsSearchAdvancedTerms:default downloader download agent log level login expiration advanced download cookies updater restart server`
    },
    {
      key: 'users',
      label: $localize`:Users settings label:Users`,
      searchText: $localize`:Users settings search terms@@settingsSearchUsersTerms:users authentication internal LDAP bind DN credentials search base search filter permissions`
    },
    {
      key: 'logs',
      label: $localize`:Logs settings label:Logs`,
      searchText: $localize`:Logs settings search terms@@settingsSearchLogsTerms:logs server messages errors diagnostics`
    }
  ];
  mainSectionLabels = {
    server: $localize`:Main settings server section@@settingsMainServerSection:Server connection`,
    userAccess: $localize`:Main settings user access section@@settingsMainUserAccessSection:User access`,
    subscriptions: $localize`:Main settings subscriptions section@@settingsMainSubscriptionsSection:Subscriptions`,
    appearance: $localize`:Main settings appearance section@@settingsMainAppearanceSection:Appearance`
  };
  downloaderSectionLabels = {
    paths: $localize`:Downloader paths section@@settingsDownloaderPathsSection:Paths and naming`,
    categories: $localize`:Downloader categories section@@settingsDownloaderCategoriesSection:Categories`,
    files: $localize`:Downloader archive and files section@@settingsDownloaderFilesSection:Archive and sidecar files`,
    limits: $localize`:Downloader limits section@@settingsDownloaderLimitsSection:Limits`
  };
  extraSectionLabels = {
    interface: $localize`:Extra interface section@@settingsExtraInterfaceSection:Interface and playback`,
    publicApi: $localize`:Extra public API section@@settingsExtraPublicApiSection:Public API`,
    integrations: $localize`:Extra integrations section@@settingsExtraIntegrationsSection:Media integrations`,
    rss: $localize`:Extra RSS section@@settingsExtraRssSection:RSS feed`,
    browserTools: $localize`:Extra browser tools section@@settingsExtraBrowserToolsSection:Browser tools`
  };
  databaseSectionLabels = {
    status: $localize`:Database status section@@settingsDatabaseStatusSection:Status and records`,
    connection: $localize`:Database connection section@@settingsDatabaseConnectionSection:MongoDB connection`,
    transfer: $localize`:Database transfer section@@settingsDatabaseTransferSection:Data transfer`
  };
  notificationSectionLabels = {
    scope: $localize`:Notification scope section@@settingsNotificationScopeSection:Notification scope`,
    webhooks: $localize`:Notification webhooks section@@settingsNotificationWebhooksSection:Webhooks`,
    pushServices: $localize`:Notification push services section@@settingsNotificationPushServicesSection:Push services`
  };
  tabs = this.settingsSections.map(section => section.key);
  tabIndex = 0;
  compactNavigation = false;
  settingsSearchQuery = '';
  
  INDEX_TO_TAB = Object.assign({}, this.tabs);
  TAB_TO_INDEX = {};
  
  usersTabDisabledTooltip = $localize`You must enable multi-user mode to access this tab.`;
  dangerZoneLabel = $localize`:Settings danger zone heading@@settingsDangerZone:Danger zone`;
  killAllDownloadsWarning = $localize`:Kill all downloads warning@@settingsKillAllDownloadsWarning:Stops every active download immediately. Subscription and manual downloads are both affected.`;
  restartServerWarning = $localize`:Restart server warning@@settingsRestartServerWarning:The application will be unavailable briefly while the server restarts.`;

  get settingsAreTheSame(): boolean {
    this._settingsSame = this.settingsSame()
    return this._settingsSame;
  }

  set settingsAreTheSame(val: boolean) {
    this._settingsSame = val;
  }

  constructor(public postsService: PostsService, private snackBar: MatSnackBar, private sanitizer: DomSanitizer,
    private dialog: MatDialog, private router: Router, private route: ActivatedRoute) {
      // invert index to tab
      Object.keys(this.INDEX_TO_TAB).forEach(key => { this.TAB_TO_INDEX[this.INDEX_TO_TAB[key]] = key; });
    }

  ngOnInit(): void {
    this.updateNavigationMode();
    if (this.postsService.initialized) {
      this.getConfig();
      this.getDBInfo();
    } else {
      this.postsService.service_initialized.subscribe(init => {
        if (init) {
          this.getConfig();
          this.getDBInfo();
        }
      });
    }

    this.generated_bookmarklet_code = this.sanitizer.bypassSecurityTrustUrl(this.generateBookmarkletCode());

    this.getLatestGithubRelease();

    const tab = this.route.snapshot.paramMap.get('tab');
    this.tabIndex = tab && this.TAB_TO_INDEX[tab] ? Number(this.TAB_TO_INDEX[tab]) : 0;
  }

  @HostListener('window:resize')
  updateNavigationMode(width = window.innerWidth): void {
    this.compactNavigation = width < 650;
  }

  getConfig(): void {
    this.initial_config = this.postsService.config;
    this.new_config = JSON.parse(JSON.stringify(this.initial_config));
  }

  settingsSame(): boolean {
    return JSON.stringify(this.new_config) === JSON.stringify(this.initial_config);
  }

  settingsValid(): boolean {
    const port = Number(this.new_config?.Host?.port);
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  saveSettings(): void {
    if (!this.settingsValid()) return;
    const settingsToSave = {'YoutubeDLMaterial': this.new_config};
    this.postsService.setConfig(settingsToSave).subscribe(res => {
      if (res['success']) {
        if (!this.initial_config['Advanced']['multi_user_mode'] && this.new_config['Advanced']['multi_user_mode']) {
          // multi user mode was enabled, let's check if default admin account exists
          this.postsService.checkAdminCreationStatus(true);
        }
        // sets new config as old config
        this.initial_config = JSON.parse(JSON.stringify(this.new_config));
        this.postsService.reload_config.next(true);
      }
    }, () => {
      console.error('Failed to save config!');
    })
  }

  cancelSettings(): void {
    this.new_config = JSON.parse(JSON.stringify(this.initial_config));
  }

  tabChanged(event): void {
    this.selectSettingsSection(event['index']);
  }

  selectSettingsSection(index: number): void {
    if (index < 0 || index >= this.tabs.length || index === this.tabIndex) return;
    if (this.tabs[index] === 'users' && !this.postsService.config?.Advanced.multi_user_mode) return;
    this.tabIndex = index;
    this.router.navigate(['/settings', {tab: this.INDEX_TO_TAB[index]}]);
  }

  get filteredSettingsSections() {
    const query = this.settingsSearchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const terms = query.split(/\s+/);
    return this.settingsSections.filter(section => {
      const searchableText = `${section.label} ${section.searchText}`.toLocaleLowerCase();
      return terms.every(term => searchableText.includes(term));
    });
  }

  selectSettingsSearchSection(section): void {
    const index = this.settingsSections.indexOf(section);
    if (index < 0 || (section.key === 'users' && !this.postsService.config?.Advanced.multi_user_mode)) return;
    this.settingsSearchQuery = '';
    this.selectSettingsSection(index);
  }

  dropCategory(event: CdkDragDrop<string[]>): void {
    moveItemInArray(this.postsService.categories, event.previousIndex, event.currentIndex);
    this.postsService.updateCategories(this.postsService.categories).subscribe(res => {

    }, () => {
      this.postsService.openSnackBar($localize`Failed to update categories!`);
    });
  }

  openAddCategoryDialog(): void {
    const done = new EventEmitter<boolean>();
    const dialogRef = this.dialog.open(InputDialogComponent, {
      width: '300px',
      data: {
        inputTitle: 'Name the category',
        inputPlaceholder: 'Name',
        submitText: 'Add',
        doneEmitter: done
      }
    });

    done.subscribe(name => {

      // Eventually do additional checks on name
      if (name) {
        this.postsService.createCategory(name).subscribe(res => {
          if (res['success']) {
            this.postsService.reloadCategories();
            dialogRef.close();
            const new_category = res['new_category'];
            this.openEditCategoryDialog(new_category);
          }
        });
      }
    });
  }

  deleteCategory(category: Category): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`Delete category`,
        dialogText: $localize`Would you like to delete ${category['name']}:category name:?`,
        submitText: $localize`Delete`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.postsService.deleteCategory(category['uid']).subscribe(res => {
          if (res['success']) {
            this.postsService.openSnackBar($localize`Successfully deleted ${category['name']}:category name:!`);
            this.postsService.reloadCategories();
          }
        }, () => {
          this.postsService.openSnackBar($localize`Failed to delete ${category['name']}:category name:!`);
        });
      }
    });
  }

  openEditCategoryDialog(category: Category): void {
    this.dialog.open(EditCategoryDialogComponent, {
      data: {
        category: category
      }
    });
  }

  generateAPIKey(): void {
    this.postsService.generateNewAPIKey().subscribe(res => {
      if (res['new_api_key']) {
        this.initial_config.API.API_key = res['new_api_key'];
        this.new_config.API.API_key = res['new_api_key'];
      }
    });
  }

  generateBookmarklet(): void {
    this.bookmarksite('YTDL-Material', this.generated_bookmarklet_code);
  }

  generateBookmarkletCode(): string {
    const currentURL = window.location.href.split('#')[0];
    const homePageWithArgsURL = currentURL + '#/home;url=';
    const audioOnly = this.bookmarkletAudioOnly;
    // tslint:disable-next-line: max-line-length
    const bookmarkletCode = `javascript:(function()%7Bwindow.open('${homePageWithArgsURL}' + encodeURIComponent(window.location) + ';audioOnly=${audioOnly}')%7D)()`;
    return bookmarkletCode;
  }

  bookmarkletAudioOnlyChanged(event:  MatCheckboxChange): void {
    this.bookmarkletAudioOnly = event.checked;
    this.generated_bookmarklet_code = this.sanitizer.bypassSecurityTrustUrl(this.generateBookmarkletCode());
  }

  // not currently functioning on most platforms. hence not in use
  bookmarksite(title: string, url: string): void {
    // Internet Explorer
    if (document.all) {
        window['external']['AddFavorite'](url, title);
    } else if (window['chrome']) {
        // Google Chrome
       this.postsService.openSnackBar($localize`Chrome users must drag the 'Alternate URL' link to your bookmarks.`);
    } else if (window['sidebar']) {
        // Firefox
        window['sidebar'].addPanel(title, url, '');
    } else if (window['opera'] && window.print) {
        // Opera
       const elem = document.createElement('a');
       elem.setAttribute('href', url);
       elem.setAttribute('title', title);
       elem.setAttribute('rel', 'sidebar');
       elem.click();
    }
 }

 openArgsModifierDialog(): void {
   const dialogRef = this.dialog.open(ArgModifierDialogComponent, {
     data: {
      initial_args: this.new_config['Downloader']['custom_args']
     }
   });
   dialogRef.afterClosed().subscribe(new_args => {
    if (new_args !== null && new_args !== undefined) {
      this.new_config['Downloader']['custom_args'] = new_args;
    }
   });
 }

 getLatestGithubRelease(): void {
    this.postsService.getLatestGithubRelease().subscribe(res => {
      this.latestGithubRelease = res;
    });
  }

  openCookiesUploaderDialog(): void {
    this.dialog.open(CookiesUploaderDialogComponent, {
      width: '65vw'
    });
  }

  killAllDownloads(): void {
    const done = new EventEmitter<boolean>();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`:Kill all downloads button:Kill all downloads`,
        dialogText: this.killAllDownloadsWarning,
        submitText: $localize`:Kill all downloads button:Kill all downloads`,
        doneEmitter: done,
        warnSubmitColor: true
      }
    });
    done.subscribe(confirmed => {
      if (confirmed) {
        this.postsService.killAllDownloads().subscribe(res => {
          if (res['success']) {
            dialogRef.close();
            this.postsService.openSnackBar($localize`Successfully killed all downloads!`);
          } else {
            dialogRef.close();
            this.postsService.openSnackBar($localize`Failed to kill all downloads! Check logs for details.`);
          }
        }, () => {
          dialogRef.close();
          this.postsService.openSnackBar($localize`Failed to kill all downloads! Check logs for details.`);
        });
      }
    });
  }

  restartServer(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: $localize`:Restart server button:Restart server`,
        dialogText: this.restartServerWarning,
        submitText: $localize`:Restart server button:Restart server`,
        warnSubmitColor: true
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.postsService.restartServer().subscribe(() => {
        this.postsService.openSnackBar($localize`Restarting!`);
      }, () => {
        this.postsService.openSnackBar($localize`Failed to restart the server.`);
      });
    });
  }

  getDBInfo(): void {
    this.postsService.getDBInfo().subscribe(res => {
      this.db_info = res;
    });
  }

  transferDB(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        dialogTitle: 'Transfer DB',
        dialogText: `Are you sure you want to transfer the DB?`,
        submitText: 'Transfer',
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this._transferDB();
      }
    });
  }

  _transferDB(): void {
    this.db_transferring = true;
    this.postsService.transferDB(this.db_info['using_local_db']).subscribe(res => {
      this.db_transferring = false;
      const success = res['success'];
      if (success) {
        this.postsService.openSnackBar($localize`Successfully transfered DB! Reloading info...`);
        this.getDBInfo();
      } else {
        this.postsService.openSnackBar($localize`Failed to transfer DB -- transfer was aborted. Error: ` + res['error']);
      }
    }, err => {
      this.db_transferring = false;
      this.postsService.openSnackBar($localize`Failed to transfer DB -- API call failed. See browser logs for details.`);
      console.error(err);
    });
  }

  testConnectionString(connection_string: string): void {
    this.testing_connection_string = true;
    this.postsService.testConnectionString(connection_string).subscribe(res => {
      this.testing_connection_string = false;
      if (res['success']) {
        this.postsService.openSnackBar($localize`Connection successful!`);
      } else {
        this.postsService.openSnackBar($localize`Connection failed! Error: ` + res['error']);
      }
    }, () => {
      this.testing_connection_string = false;
      this.postsService.openSnackBar($localize`Connection failed! Error: Server error. See logs for more info.`);
    });
  }

  openGenerateRSSURLDialog(): void {
    this.dialog.open(GenerateRssUrlComponent, {
      width: '80vw',
      maxWidth: '880px'
    });
  }
}
