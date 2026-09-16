import {mount} from 'svelte';
import App from './App.svelte';
import '@xyflow/svelte/dist/style.css';
import './base.css';
import './flow.css';
mount(App,{target:document.getElementById('app')});
