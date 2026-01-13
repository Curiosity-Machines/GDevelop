import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App from '../App'

// Mock the hooks
const mockSignOut = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}))

const mockActivities = [
  {
    id: 'activity-1',
    name: 'Test Activity 1',
    url: 'https://example.com',
    activityConfig: { activityName: 'Test Activity 1', url: 'https://example.com' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const mockAddActivity = vi.fn()
const mockUpdateActivity = vi.fn()
const mockDeleteActivity = vi.fn()

vi.mock('../hooks/useActivities', () => ({
  useActivities: () => ({
    activities: mockActivities,
    loading: false,
    error: null,
    uploadProgress: null,
    addActivity: mockAddActivity,
    updateActivity: mockUpdateActivity,
    deleteActivity: mockDeleteActivity,
  }),
}))

// Mock components
vi.mock('../components', () => ({
  Gallery: ({ projects, onEdit, onDelete, onCreateNew }: {
    projects: typeof mockActivities;
    onEdit: (activity: typeof mockActivities[0]) => void;
    onDelete: (id: string) => void;
    onCreateNew: () => void;
  }) => (
    <div data-testid="gallery">
      <span>Gallery ({projects.length} activities)</span>
      <button onClick={onCreateNew} data-testid="create-new">Create New</button>
      {projects.map(p => (
        <div key={p.id}>
          <span>{p.name}</span>
          <button onClick={() => onEdit(p)} data-testid={`edit-${p.id}`}>Edit</button>
          <button onClick={() => onDelete(p.id)} data-testid={`delete-${p.id}`}>Delete</button>
        </div>
      ))}
    </div>
  ),
  ProjectForm: ({ onSubmit, onCancel }: {
    onSubmit: (data: object, file?: File) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="project-form">
      <button onClick={() => onSubmit({ name: 'New Activity' })} data-testid="submit">Submit</button>
      <button onClick={onCancel} data-testid="cancel">Cancel</button>
    </div>
  ),
  AccountSettings: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="account-settings">
      <button onClick={onClose} data-testid="close-settings">Close</button>
    </div>
  ),
}))

const renderApp = (initialEntries: string[] = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/create" element={<App initialView="create" />} />
        <Route path="/edit/:id" element={<App initialView="edit" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders gallery view by default', () => {
    renderApp()

    expect(screen.getByTestId('gallery')).toBeInTheDocument()
    expect(screen.getByText('Gallery (1 activities)')).toBeInTheDocument()
  })

  it('shows New Activity button when there are activities', () => {
    renderApp()

    expect(screen.getByText('+ New Activity')).toBeInTheDocument()
  })

  it('shows Account and Sign Out buttons', () => {
    renderApp()

    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('calls signOut when Sign Out button is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByText('Sign Out'))

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('opens account settings when Account button is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByText('Account'))

    expect(screen.getByTestId('account-settings')).toBeInTheDocument()
  })

  it('closes account settings when close is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByText('Account'))
    expect(screen.getByTestId('account-settings')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('close-settings'))
    expect(screen.queryByTestId('account-settings')).not.toBeInTheDocument()
  })

  it('renders project form for create view', () => {
    renderApp(['/create'])

    expect(screen.getByTestId('project-form')).toBeInTheDocument()
  })

  it('calls deleteActivity when delete is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByTestId('delete-activity-1'))

    expect(mockDeleteActivity).toHaveBeenCalledWith('activity-1')
  })

  it('renders footer with app description', () => {
    renderApp()

    expect(screen.getByText(/Dopple Studio - Create and manage/)).toBeInTheDocument()
  })

  it('renders Dopple logo in header', () => {
    renderApp()

    const logo = screen.getByAltText('Dopple')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/dopple_logo.webp')
  })

  it('submits form and calls addActivity for create view', async () => {
    renderApp(['/create'])

    fireEvent.click(screen.getByTestId('submit'))

    expect(mockAddActivity).toHaveBeenCalled()
  })

  it('cancels form and navigates back to gallery', () => {
    renderApp(['/create'])

    fireEvent.click(screen.getByTestId('cancel'))

    // After cancel, should navigate back to gallery view
    expect(screen.getByTestId('gallery')).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByTestId('edit-activity-1'))

    // Should navigate to edit route
    expect(screen.getByTestId('project-form')).toBeInTheDocument()
  })

  it('navigates to create when create new is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByTestId('create-new'))

    expect(screen.getByTestId('project-form')).toBeInTheDocument()
  })

  it('navigates to create when New Activity button is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByText('+ New Activity'))

    expect(screen.getByTestId('project-form')).toBeInTheDocument()
  })
})
