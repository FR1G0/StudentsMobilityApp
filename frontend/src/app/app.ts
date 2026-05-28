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
      text: 'Home',
      href: '/home',
      icon: 'home'
    },
    {
      text: 'Applications',
      href: '/application-list',
      icon: 'home'
    },
  ];
}

interface link {
  text: string;
  href: string;
  icon: string;
}
