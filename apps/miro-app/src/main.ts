/**
 * Main entry point for Miro SDK initialization
 * Runs on the board (not in the panel)
 */

async function init(): Promise<void> {
  // Register icon click to open the app panel
  miro.board.ui.on('icon:click', async () => {
    await miro.board.ui.openPanel({ url: 'app.html' });
  });
}

init().catch(console.error);
