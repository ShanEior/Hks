import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { GameScene } from './GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

function showError(msg: string): void {
  const el = document.getElementById('error-screen');
  if (el) {
    el.style.display = 'flex';
    const msgEl = el.querySelector('.msg');
    if (msgEl) msgEl.textContent = msg;
  }
}

try {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scene: [
      // 最简测试场景 - 如果这里看不到文字说明 Phaser 渲染失败
      {
        key: 'TestScene',
        create() {
          const t = this.add.text(400, 300, 'TEST OK', { fontSize: '48px', color: '#fff' }).setOrigin(0.5);
          this.time.delayedCall(500, () => { t.destroy(); this.scene.start('MenuScene'); });
        },
      },
      MenuScene,
      GameScene,
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  // 调试：在页面上显示启动状态
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-status';
  debugDiv.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#000;color:#0f0;padding:8px 12px;font:12px monospace;';
  debugDiv.textContent = 'Starting Phaser...';
  document.body.appendChild(debugDiv);

  const game = new Phaser.Game(config);
  debugDiv.textContent = 'Phaser game created ✓';
  console.log('Phaser game created:', game);

  game.events.on('ready', () => {
    debugDiv.textContent = 'Phaser ready event fired ✓';
  });
} catch (err) {
  console.error('Game init error:', err);
  showError('哎呀，出错了，请重启试试吧~');
}

window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled rejection:', e.reason);
});
