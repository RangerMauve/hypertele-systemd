import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import {
  getSystemdPath,
  getServiceName,
  getReloadCommand,
  getStartCommand,
  getJournalCommand,
} from '../lib/system.js'

describe('getSystemdPath', () => {
  it('defaults to /etc/systemd/system', () => {
    assert.equal(getSystemdPath(), '/etc/systemd/system')
  })

  it('returns user path when user: true', () => {
    const path = getSystemdPath({ user: true })
    assert.equal(path, `${os.homedir()}/.config/systemd/user`)
  })
})

describe('getServiceName', () => {
  it('returns correct format for server', () => {
    assert.equal(getServiceName('server', 'ssh'), 'hypertele-ssh-server.service')
  })

  it('returns correct format for client', () => {
    assert.equal(getServiceName('client', 'myclient'), 'hypertele-myclient-client.service')
  })
})

describe('getReloadCommand', () => {
  it('returns sudo command by default', () => {
    assert.equal(getReloadCommand(), 'sudo systemctl daemon-reload')
  })

  it('returns --user command when user is true', () => {
    assert.equal(getReloadCommand(true), 'systemctl --user daemon-reload')
  })
})

describe('getStartCommand', () => {
  it('returns sudo command by default', () => {
    assert.equal(
      getStartCommand(false, 'hypertele-ssh-server.service'),
      'sudo systemctl enable --now hypertele-ssh-server.service'
    )
  })

  it('returns --user command for user services', () => {
    assert.equal(
      getStartCommand(true, 'hypertele-ssh-server.service'),
      'systemctl --user enable --now hypertele-ssh-server.service'
    )
  })
})

describe('getJournalCommand', () => {
  it('returns sudo command by default', () => {
    assert.equal(
      getJournalCommand(false, 'hypertele-ssh-server.service'),
      'sudo journalctl -u hypertele-ssh-server.service -f'
    )
  })

  it('returns --user command for user services', () => {
    assert.equal(
      getJournalCommand(true, 'hypertele-ssh-server.service'),
      'journalctl --user -u hypertele-ssh-server.service -f'
    )
  })
})
