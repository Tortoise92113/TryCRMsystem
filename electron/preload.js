const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('api', {

  clients: {
    list:          (search) => invoke('clients:list', search),
    get:           (id)     => invoke('clients:get', id),
    create:        (data)   => invoke('clients:create', data),
    update:        (data)   => invoke('clients:update', data),
    delete:        (id)     => invoke('clients:delete', id),
    projectCounts: ()       => invoke('clients:projectCounts'),
  },
  projects: {
    list:      (clientId) => invoke('projects:list', clientId),
    get:       (id)       => invoke('projects:get', id),
    create:    (data)     => invoke('projects:create', data),
    update:    (data)     => invoke('projects:update', data),
    delete:    (id)       => invoke('projects:delete', id),
    dashboard: ()         => invoke('projects:dashboard'),
  },
  quotes: {
    list:             ()       => invoke('quotes:list'),
    get:              (id)     => invoke('quotes:get', id),
    create:           (data)   => invoke('quotes:create', data),
    update:           (data)   => invoke('quotes:update', data),
    delete:           (id)     => invoke('quotes:delete', id),
    statusLogs:       (id)     => invoke('quotes:statusLogs', id),
    updateStatus:     (data)   => invoke('quotes:updateStatus', data),
    versions:         (id)     => invoke('quotes:versions', id),
    saveAsNewVersion: (id)     => invoke('quotes:saveAsNewVersion', id),
  },
  settings: {
    getAll:  ()         => invoke('settings:getAll'),
    set:     (k, v)     => invoke('settings:set', k, v),
    setMany: (obj)      => invoke('settings:setMany', obj),
  },
  notion: {
    syncClients: () => invoke('notion:syncClients'),
  },
  sheets: {
    exportIncome: () => invoke('sheets:exportIncome'),
    exportQuotes: () => invoke('sheets:exportQuotes'),
  },
  db: {
    reseed: () => invoke('db:reseed'),
  },
  guide: {
    open:       () => invoke('app:openNotionGuide'),
    regenerate: () => invoke('app:regenerateGuide'),
  },
  app: {
    quit: () => invoke('app:quit'),
  },
  reminders: {
    check:           ()        => invoke('reminders:check'),
    getLogs:         (limit)   => invoke('reminders:getLogs', limit),
    test:            ()        => invoke('reminders:test'),
    verifyLineToken: (token)   => invoke('reminders:verifyLineToken', token),
    openLineDev:     ()        => invoke('reminders:openLineDev'),
    todaySummary:    ()        => invoke('reminders:todaySummary'),
  },
  // IPC 事件監聽橋接（main → renderer push 事件）
  events: {
    onNavigateToProject:  (cb) => ipcRenderer.on('navigate-to-project', (_e, id) => cb(id)),
    offNavigateToProject: ()   => ipcRenderer.removeAllListeners('navigate-to-project'),
  },
})
