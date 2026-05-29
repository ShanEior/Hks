import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

function showError(): void {
  const el = document.getElementById('error-screen');
  if (el) el.style.display = 'flex';
}

try {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1a1a2e',
    scene: [MenuScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // 移动端输入优化
    input: {
      activePointers: 2,
    },
  };

  new Phaser.Game(config);
} catch (err) {
  console.error('Game init error:', err);
  showError();
}

// 捕获未处理的 Promise 错误
window.addEventListener('unhandledrejection', () => {
  // 非致命错误不显示，但记录日志
  console.warn('Unhandled rejection in game');
});
