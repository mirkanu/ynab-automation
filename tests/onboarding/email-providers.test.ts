import { describe, it, expect } from 'vitest'
import { detectEmailProvider, getForwardingInstructions } from '@/lib/email-providers'

describe('ONBD-02: Email provider detection and instructions', () => {
  it('detectEmailProvider returns gmail for gmail.com and googlemail.com', () => {
    expect(detectEmailProvider('user@gmail.com')).toBe('gmail')
    expect(detectEmailProvider('user@googlemail.com')).toBe('gmail')
  })

  it('detectEmailProvider returns outlook for outlook.com, hotmail.com, live.com', () => {
    expect(detectEmailProvider('user@outlook.com')).toBe('outlook')
    expect(detectEmailProvider('user@hotmail.com')).toBe('outlook')
    expect(detectEmailProvider('user@live.com')).toBe('outlook')
  })

  it('detectEmailProvider returns apple for icloud.com and me.com', () => {
    expect(detectEmailProvider('user@icloud.com')).toBe('apple')
    expect(detectEmailProvider('user@me.com')).toBe('apple')
  })

  it('detectEmailProvider returns other for unknown domains', () => {
    expect(detectEmailProvider('user@company.com')).toBe('other')
    expect(detectEmailProvider('user@example.org')).toBe('other')
    expect(detectEmailProvider('user@work.io')).toBe('other')
  })

  it('getForwardingInstructions returns different steps for each provider', () => {
    const gmailInstructions = getForwardingInstructions('gmail', 'forward@example.com')
    const outlookInstructions = getForwardingInstructions('outlook', 'forward@example.com')
    const appleInstructions = getForwardingInstructions('apple', 'forward@example.com')
    const otherInstructions = getForwardingInstructions('other', 'forward@example.com')

    // Each provider has a unique title
    expect(gmailInstructions.title).not.toBe(outlookInstructions.title)
    expect(gmailInstructions.title).not.toBe(appleInstructions.title)
    expect(outlookInstructions.title).not.toBe(appleInstructions.title)

    // Each has steps
    expect(gmailInstructions.steps.length).toBeGreaterThan(0)
    expect(outlookInstructions.steps.length).toBeGreaterThan(0)
    expect(appleInstructions.steps.length).toBeGreaterThan(0)
    expect(otherInstructions.steps.length).toBeGreaterThan(0)
  })

  it('getForwardingInstructions replaces {address} placeholder with actual forwarding address', () => {
    const forwardingAddress = 'myuser.abc123@inbound.example.com'
    const instructions = getForwardingInstructions('gmail', forwardingAddress)

    // At least one step should contain the actual forwarding address
    const stepsWithAddress = instructions.steps.filter(s => s.includes(forwardingAddress))
    expect(stepsWithAddress.length).toBeGreaterThan(0)

    // No step should contain the raw placeholder
    const stepsWithPlaceholder = instructions.steps.filter(s => s.includes('{address}'))
    expect(stepsWithPlaceholder.length).toBe(0)
  })
})
