import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

try {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scene: [MenuScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  new Phaser.Game(config);
} catch (err) {
  console.error('Game init error:', err);
  const el = document.getElementById('error-screen');
  if (el) el.style.display = 'flex';
}

window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled rejection:', e.reason);
});
