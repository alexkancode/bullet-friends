const { app, BrowserWindow, session } = require('electron')
const path = require('node:path')

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  window.loadFile(path.join(__dirname, '..', 'packages', 'client', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media')
  })
  createWindow()
})

app.on('window-all-closed', () => app.quit())
