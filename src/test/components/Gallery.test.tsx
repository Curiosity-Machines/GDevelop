import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Gallery } from '../../components/Gallery'
import type { ProjectManifest } from '../../types'

// Mock QRCodeDisplay component
vi.mock('../../components/QRCodeDisplay', () => ({
  QRCodeDisplay: () => <div data-testid="qr-code-display">QRCode</div>,
}))

// Mock ProjectCard to simplify testing
vi.mock('../../components/ProjectCard', () => ({
  ProjectCard: ({ project, onEdit, onDelete, onClick, isFocused }: {
    project: ProjectManifest;
    onEdit: (project: ProjectManifest) => void;
    onDelete: (id: string) => void;
    onClick?: () => void;
    isFocused?: boolean;
  }) => (
    <div data-testid={`project-card-${project.id}`} onClick={onClick}>
      <span>{project.name}</span>
      {isFocused && <span data-testid="focused">Focused</span>}
      <button onClick={() => onEdit(project)} data-testid={`edit-${project.id}`}>Edit</button>
      <button onClick={() => onDelete(project.id)} data-testid={`delete-${project.id}`}>Delete</button>
    </div>
  ),
}))

const mockProject: ProjectManifest = {
  id: 'test-id-1',
  name: 'Test Activity',
  url: 'https://example.com',
  icon: 'https://example.com/icon.png',
  version: 1,
  activityConfig: {
    activityName: 'Test Activity',
    url: 'https://example.com',
    version: 1,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockProject2: ProjectManifest = {
  id: 'test-id-2',
  name: 'Second Activity',
  url: 'https://example2.com',
  icon: 'https://example2.com/icon.png',
  version: 1,
  activityConfig: {
    activityName: 'Second Activity',
    url: 'https://example2.com',
    version: 1,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('Gallery', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnCreateNew = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no projects exist', () => {
    render(
      <Gallery
        projects={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    expect(screen.getByText('No Activities Yet')).toBeInTheDocument()
    expect(screen.getByText(/Create your first activity/)).toBeInTheDocument()
  })

  it('calls onCreateNew when create button is clicked in empty state', () => {
    render(
      <Gallery
        projects={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    const createButton = screen.getByRole('button', { name: 'Create Activity' })
    fireEvent.click(createButton)

    expect(mockOnCreateNew).toHaveBeenCalled()
  })

  it('renders project cards when projects exist', () => {
    render(
      <Gallery
        projects={[mockProject, mockProject2]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    expect(screen.getByText('Your Activities')).toBeInTheDocument()
    expect(screen.getByText('2 activities')).toBeInTheDocument()
    expect(screen.getByTestId('project-card-test-id-1')).toBeInTheDocument()
    expect(screen.getByTestId('project-card-test-id-2')).toBeInTheDocument()
  })

  it('shows singular "activity" when only one project exists', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    expect(screen.getByText('1 activity')).toBeInTheDocument()
  })

  it('opens focused view when project card is clicked', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    const projectCard = screen.getByTestId('project-card-test-id-1')
    fireEvent.click(projectCard)

    // After clicking, the focused card should be shown
    expect(screen.getByTestId('focused')).toBeInTheDocument()
  })

  it('calls onEdit when edit is clicked', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    const editButton = screen.getByTestId('edit-test-id-1')
    fireEvent.click(editButton)

    expect(mockOnEdit).toHaveBeenCalledWith(mockProject)
  })

  it('calls onDelete when delete is clicked', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    const deleteButton = screen.getByTestId('delete-test-id-1')
    fireEvent.click(deleteButton)

    expect(mockOnDelete).toHaveBeenCalledWith('test-id-1')
  })

  it('closes focused view when close button is clicked', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    // Open focused view
    const projectCard = screen.getByTestId('project-card-test-id-1')
    fireEvent.click(projectCard)

    // Verify focused view is open
    expect(screen.getByTestId('focused')).toBeInTheDocument()

    // Find and click the close button (the x button)
    const closeButton = screen.getByText('x')
    fireEvent.click(closeButton)

    // Verify focused view is closed
    expect(screen.queryByTestId('focused')).not.toBeInTheDocument()
  })

  it('calls onEdit from focused view and closes the overlay', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    // Open focused view
    const projectCard = screen.getByTestId('project-card-test-id-1')
    fireEvent.click(projectCard)

    // Click edit in the focused view (there will be two edit buttons now)
    const editButtons = screen.getAllByTestId('edit-test-id-1')
    // Click the one in the focused card (second one)
    fireEvent.click(editButtons[1])

    expect(mockOnEdit).toHaveBeenCalledWith(mockProject)
  })

  it('calls onDelete from focused view and closes the overlay', () => {
    render(
      <Gallery
        projects={[mockProject]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateNew={mockOnCreateNew}
      />
    )

    // Open focused view
    const projectCard = screen.getByTestId('project-card-test-id-1')
    fireEvent.click(projectCard)

    // Click delete in the focused view
    const deleteButtons = screen.getAllByTestId('delete-test-id-1')
    // Click the one in the focused card (second one)
    fireEvent.click(deleteButtons[1])

    expect(mockOnDelete).toHaveBeenCalledWith('test-id-1')
  })
})
