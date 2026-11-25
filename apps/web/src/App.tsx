import React, { useEffect } from 'react';
import { useS, state } from './store'; import { Title, Auth, CharSelect, CharCreate, OptionsScreen, Bye } from './ui/Screens'; import { Game } from './ui/Game'; import { applySettings } from './game';
export function App() {
  const screen = useS(s => s.screen); useEffect(() => { applySettings(); const f = () => { /* PWA-Registrierung automatisch via Plugin */ }; f(); }, []);
  return screen === 'title' ? <Title /> : screen === 'auth' ? <Auth /> : screen === 'chars' ? <CharSelect /> : screen === 'create' ? <CharCreate /> : screen === 'options' ? <OptionsScreen /> : screen === 'bye' ? <Bye /> : <Game />;
}
void state;
