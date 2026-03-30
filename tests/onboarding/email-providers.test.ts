import { describe, it } from 'vitest'
describe('ONBD-02: Email provider detection and instructions', () => {
  it.todo('detectEmailProvider returns gmail for gmail.com and googlemail.com')
  it.todo('detectEmailProvider returns outlook for outlook.com, hotmail.com, live.com')
  it.todo('detectEmailProvider returns apple for icloud.com and me.com')
  it.todo('detectEmailProvider returns other for unknown domains')
  it.todo('getForwardingInstructions returns different steps for each provider')
  it.todo('getForwardingInstructions replaces [address] placeholder with actual forwarding address')
})
