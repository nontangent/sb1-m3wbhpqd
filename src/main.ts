import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { MigrationAssistantComponent } from './app/components/migration-assistant/migration-assistant.component';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>携帯ショップデータ移行アシスタント</h1>
    <app-migration-assistant></app-migration-assistant>
  `,
  imports: [MigrationAssistantComponent]
})
export class App {}

bootstrapApplication(App).catch(err => console.error(err));