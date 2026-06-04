import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');

  links : link[] = [
    {
      text: 'Create New Application',
      href: '/form',
      icon: 'mdi mdi-plus-circle-outline'
    },
    {
      text: 'Applications List',
      href: '/applications',
      icon: 'mdi mdi-card-multiple-outline'
    }
  ];
}

interface link {
  text: string;
  href: string;
  icon: string;
}
