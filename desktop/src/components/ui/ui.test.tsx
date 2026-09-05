import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { initialsOf } from '@/components/ui/avatar'
import { DeliveryTicks } from '@/features/chat/DeliveryTicks'

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Ann Karimova')).toBe('AK')
  })

  it('falls back to two letters of a single name', () => {
    expect(initialsOf('ann')).toBe('an')
  })

  it('has something to render for an empty name', () => {
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('DeliveryTicks', () => {
  it('labels each state for screen readers', () => {
    const { rerender } = render(<DeliveryTicks state="sending" />)
    expect(screen.getByLabelText('Sending')).toBeInTheDocument()

    rerender(<DeliveryTicks state="read" />)
    expect(screen.getByLabelText('Read')).toBeInTheDocument()

    rerender(<DeliveryTicks state="failed" />)
    expect(screen.getByLabelText('Failed')).toBeInTheDocument()
  })
})
