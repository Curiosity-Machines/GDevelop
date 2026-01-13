import { useState } from 'react';
import type { ProjectManifest } from '../types';
import { ProjectCard } from './ProjectCard';

interface GalleryProps {
  projects: ProjectManifest[];
  onEdit: (project: ProjectManifest) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
}

export function Gallery({ projects, onEdit, onDelete, onCreateNew }: GalleryProps) {
  const [focusedProject, setFocusedProject] = useState<ProjectManifest | null>(null);

  if (projects.length === 0) {
    return (
      <div className="text-center py-15 px-5">
        <div className="text-6xl mb-6">🎮</div>
        <h2 className="text-gray-900 m-0 mb-3 text-2xl">No Activities Yet</h2>
        <p className="text-[#6a6a8a] m-0 mb-8">Create your first activity to generate QR codes with custom configurations</p>
        <button
          className="py-3.5 px-8 bg-gradient-to-br from-indigo-500 to-violet-500 text-white border-none rounded-[10px] text-base font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)]"
          onClick={onCreateNew}
        >
          Create Activity
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="m-0 text-gray-900 text-2xl">Your Activities</h2>
        <span className="text-[#6a6a8a] text-sm">{projects.length} activit{projects.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      <div className={`grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6 transition-[filter] duration-300 ease-in-out ${focusedProject ? 'blur-[8px] pointer-events-none' : ''}`}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={() => setFocusedProject(project)}
          />
        ))}
      </div>

      {focusedProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[4px] flex items-center justify-center z-[1000] p-5 animate-[fadeIn_0.2s_ease-out]">
          <div className="relative w-full max-w-[450px] animate-[scaleIn_0.3s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
            <ProjectCard
              project={focusedProject}
              onEdit={(p) => {
                setFocusedProject(null);
                onEdit(p);
              }}
              onDelete={(id) => {
                setFocusedProject(null);
                onDelete(id);
              }}
              isFocused={true}
            />
            <button
              className="absolute -top-[15px] -right-[15px] w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-600 text-2xl flex items-center justify-center cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-10 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 hover:scale-110"
              onClick={() => setFocusedProject(null)}
            >
              x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
