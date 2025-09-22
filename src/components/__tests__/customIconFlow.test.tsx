import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EditDrawer } from '@/components/EditDrawer'
import { SquareCard } from '@/components/calendar/SquareCard'
import { TooltipProvider } from '@/components/ui/tooltip'
import { usePlannerStore } from '@/store/plannerStore'

function resetStore() {
  const initial = usePlannerStore.getState()
  usePlannerStore.setState({
    items: [],
    undo: null,
    projects: initial.projects,
  })
}

describe('custom icon selection flow', () => {
  beforeEach(() => {
    resetStore()
  })

  test('custom icon selection persists from modal to render', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()

    render(<EditDrawer open itemId={null} onClose={handleClose} />)

    const titleInput = await screen.findByLabelText('Title')
    await user.type(titleInput, 'VIP Visit prep')

    const iconTrigger = await screen.findByLabelText('Icon')
    await user.click(iconTrigger)

    const chooseCustom = await screen.findByTestId('choose-custom-icon')
    await user.click(chooseCustom)

    const sparkButton = await screen.findByRole('button', { name: 'Spark' })
    await user.click(sparkButton)

    const labelInput = await screen.findByLabelText('Display name')
    await user.clear(labelInput)
    await user.type(labelInput, 'VIP Visit')

    const useIcon = await screen.findByTestId('custom-icon-use')
    await user.click(useIcon)

    // Continue flow and verify persistence after save

    const saveButton = await screen.findByRole('button', { name: 'Save' })
    await user.click(saveButton)

    expect(handleClose).toHaveBeenCalled()

    const savedItems = usePlannerStore.getState().items
    expect(savedItems).toHaveLength(1)
    const savedItem = savedItems[0]
    expect(savedItem.icon).toBeUndefined()
    expect(savedItem.iconCustom).toEqual({ key: 'spark', label: 'VIP Visit' })

    const projects = usePlannerStore.getState().projects
    const project = projects.find((entry) => entry.id === savedItem.projectId) ?? null

    const { getByTestId } = render(
      <TooltipProvider>
        <SquareCard
          item={savedItem}
          project={project}
          isSelected={false}
          onActivate={() => {}}
          size={32}
        />
      </TooltipProvider>,
    )

    expect(getByTestId('square-card-icon')).toBeTruthy()
  })
})
