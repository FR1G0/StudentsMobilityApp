import { Component } from '@angular/core';


import { App } from '../app'

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-app-home',
  imports: [RouterLink],
  templateUrl: './app-home.html',
  styleUrl: './app-home.css',
})
export class AppHome {
  constructor(
    public app: App
  ){}
}
